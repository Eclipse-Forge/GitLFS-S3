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
import bodyParser from 'body-parser';
import crypto from 'crypto';
import aws4 from 'aws4';

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
//   S3_FORCE_PATH_STYLE - "true" or "false" (default "true") - whether to use path-style URLs (bucket in path) vs virtual-hosted-style (bucket in hostname). Backblaze B2 S3 requires path-style, but AWS S3 generally uses virtual-hosted-style.
//   S3_USE_SSL         - "true" or "false" (default "true") - whether to use https or http for signed URLs.
//   PUBLIC_BASE_URL    - e.g. "https://my-lfs-service.onrender.com" - used for the "verify" action URL. Optional but recommended.
//   PORT               - Render injects this automatically; set for a custom port host on different platforms. Default to 3000 for local dev.


const {
  S3_ENDPOINT,
  S3_REGION,
  S3_BUCKET,
  S3_ACCESS_KEY,
  S3_SECRET_KEY,
  S3_FORCE_PATH_STYLE = 'true',
  S3_USE_SSL = 'true',
  PUBLIC_BASE_URL,

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
// Core: sign S3-compatible URLs
// -----------------------------
//
// We use aws4 to sign requests for S3-compatible APIs.
// This works for Backblaze B2 S3 as well, as long as endpoint/region/keys are correct.

function buildS3Url(method, oid) {
  // We store each LFS object as a single object in the bucket.
  // Key strategy: "<oid>" (you can prefix with "lfs/" if you want).
  const objectKey = oid;

  // Host and path depend on path-style vs virtual-hosted-style.
  const host = `${S3_BUCKET}.${S3_ENDPOINT}`;
  const path = `/${encodeURIComponent(oid)}`;   // IMPORTANT: no bucket in path

  const protocol = S3_USE_SSL.toLowerCase() !== 'false' ? 'https:' : 'http:';

  return {
    protocol,
    host,
    path,
    method
  };
}

function signS3Request(method, oid, expiresInSeconds = 3600) {
  const { protocol, host, path } = buildS3Url(method, oid);

  // aws4 signs a "request options" object.
  const opts = {
    host,
    path,
    method,
    service: 's3',
    region: S3_REGION,
    signQuery: true,
    headers: {
      // You can add additional headers here if needed.
      Host: host, // MUST match the virtual-hosted-style URL
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

app.post('/objects/batch', (req, res) => {
  const { operation, transfers, objects } = req.body || {};

  // Basic validation so we fail loudly instead of confusing Git LFS.
  if (!operation || !Array.isArray(objects)) {
    return res.status(422).json({
      message: 'Invalid Git LFS batch request: missing "operation" or "objects".'
    });
  }

  // Git LFS usually sends ["basic"], but we default to "basic" regardless.
  const transfer = 'basic';

  const responseObjects = objects.map(obj => {
    const { oid, size } = obj;

    // Each object in the response must echo oid and size.
    const result = {
      oid,
      size,
      actions: {}
    };

    // For uploads, we provide a signed PUT URL and a verify URL.
    if (operation === 'upload') {
      const upload = signS3Request('PUT', oid);

      result.actions.upload = {
        href: upload.href,
        header: upload.header
      };

      // "verify" is optional but recommended.
      // Git LFS will POST to this after upload to confirm.
      if (PUBLIC_BASE_URL) {
        result.actions.verify = {
          href: `${PUBLIC_BASE_URL}/objects/verify`,
          header: {
            // You can add auth headers here if you later secure this.
          }
        };
      }
    }

    // For downloads, we provide a signed GET URL.
    if (operation === 'download') {
      const download = signS3Request('GET', oid);

      result.actions.download = {
        href: download.href,
        header: download.header
      };
    }

    return result;
  });

  const responseBody = {
    transfer,
    objects: responseObjects
  };

  // Git LFS expects application/json.
  res.status(200).json(responseBody);
});

// -----------------------------
// Optional: verify endpoint
// -----------------------------
//
// If you include a "verify" action in the batch response, Git LFS will
// POST here after upload. You can implement integrity checks if you want.
// For now, we just return 200 OK to satisfy the protocol.

app.post('/objects/verify', (req, res) => {
  // You could inspect req.body.objects here and verify they exist in S3.
  // For now, we assume S3 upload succeeded if Git LFS got a 200 from S3.
  res.status(200).json({ message: 'OK' });
});

// -----------------------------
// Start server
// -----------------------------
//
// Render injects PORT; default to 3000 for local dev.

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Git LFS S3 proxy listening on port ${port}`);
});