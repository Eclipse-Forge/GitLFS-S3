// server.js
//
// Git LFS "basic" transfer adapter implemented as a Node/Express server,
// designed to run on Render and proxy to any S3-compatible backend
// (including Backblaze B2's S3 API).
//
// This is intentionally verbose and heavily commented for collaborators.
//
// High-level flow:
//
// 1. Git LFS client sends POST /objects/batch with JSON body:
//    {
//      "operation": "upload" | "download",
//      "transfers": ["basic"],
//      "objects": [{ "oid": "<sha256>", "size": 12345 }, ...]
//    }
//
// 2. We respond with JSON describing how to upload/download each object:
//    {
//      "transfer": "basic",
//      "objects": [
//        {
//          "oid": "<sha256>",
//          "size": 12345,
//          "actions": {
//            "upload": { "href": "<signed PUT URL>", "header": { ... } },
//            "download": { "href": "<signed GET URL>", "header": { ... } },
//            "verify": { "href": "<our verify endpoint>" }
//          }
//        },
//        ...
//      ]
//    }
//
// 3. Git LFS then directly talks to S3/B2 using the signed URLs.
//    This server is stateless and only signs requests.

import express from 'express';
import aws4 from 'aws4';

import pLimit from 'p-limit';
import {
  S3Client,
  HeadObjectCommand
} from '@aws-sdk/client-s3';

// -----------------------------
// Configuration via env vars
// -----------------------------
//
// These should be set in Render's "Environment" tab.
//
// Required:
//   S3_ENDPOINT       - e.g. "s3.us-west-004.backblazeb2.com"
//   S3_REGION         - e.g. "us-west-004" (or whatever your S3-compatible region is)
//   S3_BUCKET         - e.g. "my-lfs-bucket"
//   S3_ACCESS_KEY     - S3/B2 key ID
//   S3_SECRET_KEY     - S3/B2 application key
//
// Optional:
//   S3_FORCE_PATH_STYLE - "true" or "false" (default "true") - whether to use path-style URLs (bucket in path) vs virtual-hosted-style (bucket in hostname). GitLFS requires virtual-style for S3-compatible APIs, but some providers prefer path-style, so we default to virtual-hosted-style for compatibility but allow switching to path-style if needed.
//   S3_USE_SSL         - "true" or "false" (default "true") - whether to use https or http for signed URLs.
//   PUBLIC_BASE_URL    - e.g. "https://my-lfs-service.onrender.com" - used for the "verify" action URL. Optional but recommended.
//   S3_AUTH_EXPIRATION - seconds until signed URLs expire (default 3600, i.e. 1 hour). Adjust as needed for your use case and security requirements.
//   UPLOAD_RATELIMIT   - Use to define maximum concurrent uploads to prevent overwhelming the server or S3 backend. Default 30.
//   PORT               - Render injects this automatically; set for a custom port host on different platforms. Default to 3000 for local dev.


const {
  S3_ENDPOINT,
  S3_REGION,
  S3_BUCKET,
  S3_ACCESS_KEY,
  S3_SECRET_KEY,
  S3_FORCE_PATH_STYLE = 'false',
  S3_USE_SSL = 'true',
  S3_AUTH_EXPIRATION = 3600,
  UPLOAD_RATELIMIT = 30,
  PUBLIC_BASE_URL,
  PORT,

} = process.env;

if (!S3_ENDPOINT || !S3_REGION || !S3_BUCKET || !S3_ACCESS_KEY || !S3_SECRET_KEY) {
  console.error('Missing required S3_* environment variables.');
  process.exit(1);
}

// -----------------------------
// Express setup
// -----------------------------
const app = express();

// Git LFS always sends JSON for batch requests.
app.use(express.json({
  type: [
    "application/json",
    "application/vnd.git-lfs+json"
  ]
}));

// Simple health check
app.get('/health', (_req, res) => {
  res.status(200).send('OK');
});

// -----------------------------
// S3 CLIENT
// -----------------------------
//
// ONLY used for checking whether objects exist.
const s3 = new S3Client({
  region: S3_REGION,

  endpoint:
    `${S3_USE_SSL.toLowerCase() !== 'false'
      ? 'https'
      : 'http'}://${S3_ENDPOINT}`,

  credentials: {
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY
  },

  // Current implementation uses:
  //   bucket.endpoint/key
  //
  // so we keep virtual-hosted style.
  forcePathStyle:
    S3_FORCE_PATH_STYLE.toLowerCase() === 'true'
});


// -----------------------------
// OBJECT EXISTENCE CHECK
// -----------------------------
async function objectExists(oid) {
  try {
    await s3.send(
      new HeadObjectCommand({
        Bucket: S3_BUCKET,
        Key: oid
      })
    );

    return true;

  } catch (err) {
    const status =
      err?.$metadata?.httpStatusCode || err?.statusCode;
    // Missing object
    if (
      status === 404 ||
      err?.name === 'NotFound'
    ) {
      return false;
    }

    // Backblaze B2 occasionally
    // returns 400 for weird HEAD cases.
    //
    // Safest behavior:
    // assume object missing.
    if (status === 400) {
      console.warn(
        `HEAD returned 400 for ${oid}, treating as missing`
      );

      return false;
    }

    console.error(
      `HEAD failed for ${oid}`,
      err
    );

    throw err;
  }
}

// -----------------------------
// Core: sign S3-compatible URLs
// -----------------------------
//
// We use aws4 to sign requests for S3-compatible APIs.
// This works for Backblaze B2 S3 as well, as long as endpoint/region/keys are correct.
function buildS3Url(method, oid) {
  // We store each LFS object as a single object in the bucket.
  // Key strategy: "<oid>" (you can prefix with "lfs/" if you want).
  const usePathStyle =
    S3_FORCE_PATH_STYLE.toLowerCase() === 'true';

  let host;
  let path;

  // Host and path depend on path-style vs virtual-hosted-style.
  if (usePathStyle) {
    // Path-style:
    // endpoint/bucket/object
    host = S3_ENDPOINT;
    path = `/${S3_BUCKET}/${encodeURIComponent(oid)}`;

  } else {
    // Virtual-hosted-style:
    // bucket.endpoint/object
    host = `${S3_BUCKET}.${S3_ENDPOINT}`;
    path = `/${encodeURIComponent(oid)}`;
  }

  const protocol =
    S3_USE_SSL.toLowerCase() !== 'false'
      ? 'https:'
      : 'http:';

  return {
    protocol,
    host,
    path,
    method
  };
}

function signS3Request(method, oid, expiresInSeconds = S3_AUTH_EXPIRATION) {
  const { protocol, host, path } =
    buildS3Url(method, oid);

  // aws4 signs a "request options" object.
  const opts = {
    host,
    path,
    method,

    service: 's3',
    region: S3_REGION,
    signQuery: true,
    expires: expiresInSeconds,

    headers: {
      // You can add additional headers here if needed.
      Host: host, // MUST match the virtual-hosted-style URL

      // Improves compatibility with some S3 providers
      'x-amz-content-sha256': 'UNSIGNED-PAYLOAD'
    }
  };

  // Sign with temporary query params (presigned URL).
  aws4.sign(opts, {
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY
  });

  // aws4.sign will add "headers" and "path" with query params.
  // We need to construct the full URL.
  const href = `${protocol}//${host}${opts.path}`;

  return {
    href,
    header: opts.headers
  };
}

// -----------------------------
// Git LFS Batch API
// -----------------------------
//
// Route: POST /objects/batch
// This is the main entrypoint Git LFS uses.
//
// You can point your repo at this by setting, for example:
//   git config -f .lfsconfig lfs.url "https://<your-render-service>/"
// Then Git LFS will call POST /objects/batch on that base URL.
app.post('/objects/batch', async (req, res) => {

  try {

    const { operation, transfers, objects } = req.body || {};

  // Basic validation so we fail loudly instead of confusing Git LFS.
    if (!operation || !Array.isArray(objects)) {
      return res.status(422).json({
        message: 'Invalid Git LFS batch request: missing "operation" or "objects".'
      });
    }

    // Git LFS usually sends ["basic"], but we default to "basic" regardless.
    const transfer = 'basic';

    // Prevent Render from exploding on huge batches
    const limit = pLimit(Number(UPLOAD_RATELIMIT));

    const responseObjects = await Promise.all(
      objects.map(obj =>
        limit(async () => {
          const { oid, size } = obj;
          // Each object in the response must echo oid and size.
          const result = {
            oid,
            size,
            actions: {}
          };
          if (!/^[a-f0-9]{64}$/i.test(oid)) {
            throw new Error(`Invalid oid: ${oid}`);
          }

          // -----------------------------
          // UPLOAD
          // For uploads, we provide a signed PUT URL and a verify URL.
          // -----------------------------
          if (operation === 'upload') {
            // NEW LAYER:
            // Skip uploads if object already exists.
            const exists = await objectExists(oid);

            if (!exists) {
              const upload = signS3Request('PUT', oid);
              result.actions.upload = {
                href: upload.href,
                header: upload.header
              };
              console.log(`UPLOAD REQUIRED: ${oid}`);
            } else {
              console.log(`ALREADY EXISTS: ${oid}`);
            }

            // "verify" is optional but recommended.
            // Git LFS will POST to this after upload to confirm.
            if (PUBLIC_BASE_URL) {
              result.actions.verify = {
                href: `${PUBLIC_BASE_URL}/objects/verify`,
                header: {}
              };
            }
          }

          // -----------------------------
          // DOWNLOAD
          // -----------------------------
          if (operation === 'download') {

            const download = signS3Request('GET', oid);

            result.actions.download = {
              href: download.href,
              header: download.header
            };
          }

          return result;
        })
      )
    );

    const responseBody = {
      transfer,
      objects: responseObjects
    };
    // Git LFS expects application/json.
    res.status(200).json(responseBody);

  } catch (err) {

    console.error('Batch handler failed:', err);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
});

app.post('/objects/verify', async (req, res) => {
  try {
    const { oid } = req.body || {};

    if (!oid) {
      return res.status(400).json({ error: 'missing oid' });
    }
    const meta = await s3.send(
      new HeadObjectCommand({
        Bucket: S3_BUCKET,
        Key: oid
      })
    );

    // basic integrity check
    if (typeof meta.ContentLength !== 'number') {
      throw new Error(`Missing size for ${oid}`);
    }
    res.status(200).json({ ok: true });

  } catch (err) {
    console.error('VERIFY FAILED:', err);
    res.status(500).json({ error: 'verify failed' });
  }
});

// -----------------------------
// Start server
// -----------------------------
//
// Render injects PORT; default to 3000 for local dev.
const port = Number(PORT) || 3000;

app.listen(port, () => {
  console.log(`Git LFS S3 proxy listening on port ${port}`);
});