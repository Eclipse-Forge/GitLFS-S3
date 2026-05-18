# Contributing to GitLFS‑S3

Thank you for your interest in contributing!  
This project is intentionally lightweight, stateless, and easy to understand.  
Contributions that improve clarity, reliability, security, or documentation are especially welcome.

---

## 🧭 How to Contribute

### 1. Fork & Branch
- Fork the repository to your own GitHub account.
- Create a feature branch with a clear name:
  - `feat/custom-endpoint-support`
  - `fix/b2-head-request-handling`
  - `docs/readme-improvements`

### 2. Make Your Changes
- Keep changes focused and atomic.
- Update documentation when behavior changes.
- Add comments where logic may be non‑obvious.
- Ensure no secrets or credentials appear in commits.

### 3. Submit a Pull Request
To maintain project integrity and contributor authenticity:

#### ✔ Your PR **must** be signed in one of the following ways:
- **A verified SSH‑signed commit**, OR  
- **A GitHub Web UI commit**, which automatically receives the “Verified” badge.

Unsigned or unverified commits will not be accepted.

### 4. PR Requirements
- Provide a clear description of the change.
- Explain the motivation or issue being solved.
- Include reproduction steps for bug fixes.
- Keep PRs small and focused — large PRs may be rejected or requested to be split.

---

## 🧩 Coding Standards

### JavaScript / Node.js Style
- Use modern ES syntax (imports, async/await).
- Keep functions small, explicit, and readable.
- Prefer pure functions and stateless logic.
- Avoid unnecessary dependencies.

### Error Handling
- Fail loudly and clearly.
- Return meaningful HTTP status codes.
- Never leak secrets in error messages.

### Security
- Validate all environment variables.
- Do not log sensitive information.
- Avoid exposing bucket names or internal paths unless necessary.

### Project Philosophy
This project is intentionally:
- **Stateless**
- **Simple**
- **Auditable**
- **Easy to deploy**

Please avoid:
- Adding databases or persistent state.
- Adding heavy frameworks.
- Over‑engineering the signing logic.

---

## 🧪 Testing
If you modify logic that affects uploads, downloads, or signing:
- Test against at least one S3‑compatible provider (Backblaze B2 recommended).
- Include tests or manual reproduction steps.

---

## 📄 Licensing
By contributing, you agree that your contributions will be licensed under the **Apache‑2.0 License**, the same license as the project.

---

## 🤝 Thank You
Your time and effort help make this project better for everyone.
