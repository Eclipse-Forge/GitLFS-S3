# GitLFS‑S3
<!-- Core Project Metadata -->
![License](https://img.shields.io/badge/license-Apache--2.0-blue)
![Node Version](https://img.shields.io/badge/node-%3E%3D18-green)
![Project Status](https://img.shields.io/badge/status-stable-success)
![Version](https://img.shields.io/github/v/release/Eclipse-Forge/GitLFS-S3)

<!-- Security & Contribution Requirements -->
![Security Policy](https://img.shields.io/badge/security-policy%20enabled-blue)
![Verified PRs](https://img.shields.io/badge/pull%20requests-verified%20only-important)
![SSH Signing](https://img.shields.io/badge/commits-SSH%20signed-blueviolet)

<!-- Compatibility & Design -->
![S3 Compatible](https://img.shields.io/badge/storage-S3%20compatible-orange)
![Backblaze B2 Optimized](https://img.shields.io/badge/optimized-Backblaze%20B2-red)
![Stateless Design](https://img.shields.io/badge/design-stateless-lightgrey)
![Git LFS Basic API](https://img.shields.io/badge/Git%20LFS-basic%20transfer%20API-yellow)

<!-- Repository Health -->
![Issues](https://img.shields.io/github/issues/Eclipse-Forge/GitLFS-S3)
![Pull Requests](https://img.shields.io/github/issues-pr/Eclipse-Forge/GitLFS-S3)
![Contributions Welcome](https://img.shields.io/badge/contributions-welcome-brightgreen)

<!-- Aesthetic / Identity -->
![Made with Node](https://img.shields.io/badge/made%20with-Node.js-6DA55F)
![Open Source](https://img.shields.io/badge/open%20source-%E2%9D%A4-red)

A lightweight, stateless Git LFS “basic” transfer adapter that signs temporary S3‑compatible URLs for uploading and downloading Git LFS objects.
Designed primarily for [Backblaze B2](https://www.backblaze.com/cloud-storage/pricing) S3‑Compatible Storage and deployable on Render, Fly.io, Railway, or any Node.js host. 

---

## Overview
GitLFS‑S3 acts as a **translation layer** between Git LFS and any S3‑compatible backend. It exposes the Git LFS “basic” transfer API and dynamically signs short‑lived upload/download URLs, allowing Git LFS clients to push and pull large objects without requiring your Git hosting provider to support S3 directly. 

The service is intentionally stateless — it does not store metadata, maintain a database, or persist any information between requests. This makes it easy to deploy, scale horizontally, and run cheaply on serverless or ephemeral platforms. 

---

## Features
- Fully compatible with Git LFS “basic” transfer mode 
- Stateless design — no database or persistent storage required
- Supports both upload and download signing
- Works with Backblaze B2 and any S3‑compatible API
- Clean, readable Node.js codebase designed for easy forking and customization 
- Deployable on Render, Fly.io, Railway, Docker, or any Node host

---

## Use Cases
### ✔ Store LFS Objects in Backblaze B2
> Ideal for teams that want cheap, scalable storage without relying on GitHub/GitLab LFS quotas.

### ✔ Self‑hosted Git LFS endpoint
> Use this as your own LFS backend for private repos, on‑prem Git servers, or custom workflows.

### ✔ Stateless deployments
> Perfect for platforms where persistent disks are expensive or unavailable (Render, Fly.io, Railway).

### ✔ Multi‑provider S3 compatibility
> Although optimized for Backblaze B2, the signing logic can be adapted for other S3‑compatible providers.

---

## Known Limitations
> These are current limitations of the implementation:

### ⚠ No protection against concurrent identical uploads
> The service does not prevent two clients from uploading the same object simultaneously.
> Because the proxy is stateless and does not lock or track uploads, duplicate objects may be created if two identical LFS objects are pushed at the same time.

### ⚠ No cryptographic validation of uploaded files
> The proxy **does not hash or verify file contents**. It only compares Git LFS metadata (size, OID string) and trusts the client‑provided values.
> This means:
> - Corrupted uploads are not detected
> - Mismatched content vs. OID is not validated
> - Malicious clients could upload incorrect data

### ⚠ No deduplication logic
> Because no database or object index exists, the service cannot detect whether an object already exists in the bucket unless the S3 provider returns a HEAD match. Backblaze offers a "Data Versioning" control which should be set to "Keep only latest", other providers may or may not have similar logic.

### ⚠ No rate‑limiting or abuse protection beyond what the host provides
> (Unless you add it yourself.)

---

## Deployment
The project includes detailed setup instructions for Backblaze B2 and Render, including required environment variables and `.lfsconfig` usage. You can find this in the wiki

---

## Contributing
Contributions are welcome, especially around documentation, error handling, signing logic, and support for additional storage providers. Contribution guidelines emphasize clarity, English‑language comments, and security considerations. Please read the [contributor agreement](CONTRIBUTING.md) before opening pull requests.

---

## Licence
This project is licensed under the Apache 2.0 License, which provides:
- MIT‑style freedom
- Explicit patent protection
- Compatibility with commercial and open‑source use

See the [LICENSE](https://github.com/Eclipse-Forge/GitLFS-S3/blob/master/LICENSE) file for full terms.

---

# ❤️ Acknowledgements
This project uses:
- **Express** (MIT)
- **aws4** (MIT)
- **@aws-sdk/client-s3** (ASL 2.0)
- **p-limit** (MIT)
- **Backblaze S3‑Compatible API**
- **Git LFS Basic Transfer Protocol**

All dependencies are permissively licensed.
