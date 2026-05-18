# Security Policy

GitLFS‑S3 is a stateless signing proxy that interacts with external storage systems.  
Security is a top priority, and we appreciate responsible disclosures.

---

## 🔐 Reporting a Vulnerability

This project uses **GitHub’s built‑in private security reporting system**.

If you discover a vulnerability:

1. Go to the repository’s **Security** tab.
2. Select **“Report a vulnerability”**.
3. Submit a private advisory with:
   - A clear description of the issue
   - Steps to reproduce
   - Potential impact
   - Suggested fixes (if known)

Your report will be visible **only to maintainers** until resolved.

Please **do not** open public issues for security concerns.

---

## 🛠 Supported Versions

Only the **latest commit on `master`** is actively supported.  
Older versions may not receive security patches.

---

## 🧭 Scope

We are primarily concerned with:
- Incorrect or unsafe S3 signing logic  
- Leaks of sensitive metadata  
- Authentication bypasses  
- Upload or download URL escalation  
- Logic flaws that could corrupt or overwrite objects  
- Denial‑of‑service vectors caused by malformed LFS requests  

Out of scope:
- Issues caused by misconfigured Backblaze/S3 credentials  
- Rate‑limiting or quota exhaustion on third‑party providers  
- Vulnerabilities in Git LFS itself  

---

## 🤝 Responsible Disclosure

We will:
- Acknowledge your report promptly  
- Work with you to validate and resolve the issue  
- Credit you in the security advisory (optional)  

Thank you for helping keep the ecosystem safe.
