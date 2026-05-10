# Git LFS → Backblaze S3 Proxy (Node.js / Render)

A lightweight, stateless Git LFS “basic” transfer adapter that signs temporary S3‑compatible URLs for uploading and downloading Git LFS objects.  
Designed for **Backblaze B2 S3‑Compatible Storage** and deployable on **Render.com** with zero persistent state.

This service acts as a translation layer between Git LFS and Backblaze’s S3 API, allowing you to store large files efficiently and cheaply without modifying your Git hosting provider.

---

## ✨ Features

- Fully compatible with Git LFS “basic” transfer mode  
- Stateless — no database required  
- Uses Backblaze’s **S3‑Compatible API**  
- Supports both upload and download signing  
- Works on Render, Fly.io, Railway, or any Node host  
- Clean, readable, well‑commented code  
- Easy to fork and customise  

---

# 🚀 Deploying on Render.com

This section walks you through setting up Backblaze and deploying the proxy on Render.

---

## 1. Create a Backblaze B2 Bucket

1. Log in to Backblaze  
2. Go to **Buckets**  
3. Create a new bucket  
4. **IMPORTANT:**  
   - Bucket name must be **lowercase**, **DNS‑compatible**, and may include hyphens  
   - Example:  
     ```
     my-lfs-bucket
     project-lfs-storage
     ```

Backblaze S3 API **does not support uppercase or underscores** in bucket names.

---

## 2. Create an Application Key

1. Go to **App Keys**  
2. Click **Add a New Application Key**  
3. Choose:
   - **Permissions:** Read/Write  
   - **Bucket:** your new bucket  
4. Save the following values:

You will need:

- **KeyID** → `S3_ACCESS_KEY`  
- **Application Key** → `S3_SECRET_KEY`  
- **Bucket Name** → `S3_BUCKET`  
- **Region:** eg. `us-west-004`  
- **Endpoint:** eg. `s3.us-west-004.backblazeb2.com`

---

## 3. Deploy the Proxy on Render

1. Create a new **Web Service**  
2. Connect your GitHub repo  
3. Use these settings:

### **Build Command**
```npm install```

### **Start Command**
```npm start```

### **Environment Variables**

| Variable | Example | Description |
|---------|---------|-------------|
| `S3_ENDPOINT` | `s3.us-west-004.backblazeb2.com` | Backblaze S3 endpoint |
| `S3_REGION` | `us-west-004` | Backblaze region |
| `S3_BUCKET` | `my-lfs-bucket` | Your bucket name |
| `S3_ACCESS_KEY` | `xxxx` | KeyID |
| `S3_SECRET_KEY` | `xxxx` | Application Key |
| `PUBLIC_BASE_URL` | `https://your-service.onrender.com` | Used for LFS verify endpoint |
| `S3_USE_SSL` | `true` | Always true unless debugging |
| `S3_FORCE_PATH_STYLE` | `false` | Must be **false** for Backblaze |

Click **Deploy**.

---

## 4. Configure Your Git Repository

Inside your project:
```git lfs install```

```git config -f .lfsconfig lfs.url "https://your-service.onrender.com/"```

Test with:
```git add <large-file>```

```git commit -m "Test LFS"```

```git push```

You should see LFS uploading via your Render proxy.

---

# 📦 Understanding the `.env` Files

This project uses environment variables to configure:

- Backblaze credentials  
- Bucket name  
- Region  
- Endpoint  
- Public URL for verify callbacks  

### Why `.env` files matter

Different hosts handle environment variables differently:

| Platform | How env vars are stored |
|----------|--------------------------|
| **Render** | Dashboard → Environment tab |
| **Fly.io** | `fly secrets set KEY=value` |
| **Railway** | Project Variables UI |
| **Docker** | `.env` file or `-e KEY=value` |
| **Local dev** | `.env` + `dotenv` |

### What you should *not* commit

Never commit:
```
S3_ACCESS_KEY
S3_SECRET_KEY
```

These belong **only** in your hosting provider’s environment settings.

### What you *can* commit

A template file:
```.env.example```
Containing:
```
S3_ENDPOINT=
S3_REGION=
S3_BUCKET=
S3_ACCESS_KEY=
S3_SECRET_KEY=
PUBLIC_BASE_URL=
```

This helps contributors understand what variables they need.

---

# 🤝 Contributing

Pull requests are welcome — especially improvements to:

- Documentation  
- Error handling  
- Signing logic  
- Additional storage provider support  
- Performance or clarity  

### Contribution Requirements

To maintain quality and readability:

1. **All code must be clearly commented**  
   - Comments must be in **English**  
   - Grammar and spelling must be correct  
   - Comments must explain *why*, not just *what*

2. **Pull requests must include a detailed summary**  
   - What changed  
   - Why it changed  
   - How it was tested  
   - Any breaking changes  

3. **No unreviewed dependencies**  
   - New packages must be justified  
   - Security implications must be considered  

4. **Follow the existing code style**  
   - Consistent formatting  
   - Consistent naming  
   - Consistent structure  

High‑quality contributions are always appreciated.

---

# 📄 Licence

This project is licensed under the **Apache 2.0 Licence**, providing:

- MIT‑style freedom  
- Explicit patent protection  
- Compatibility with commercial and open‑source use  

See the `LICENSE` file for details.

---

# ❤️ Acknowledgements

This project uses:

- **Express** (MIT)  
- **aws4** (MIT)  
- **Backblaze S3‑Compatible API**  
- **Git LFS Basic Transfer Protocol**  

All dependencies are permissively licensed.
