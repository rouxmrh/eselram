# Eselram protected release builder — Stage 2

This build creates a deployment-ready release that does **not** ship the clean Pages Functions source tree to a customer repository.

The release contains:
- browser assets required by Eselram;
- a minified compiled `_worker.js` generated from `functions/`;
- database migrations for the Provisioner;
- the reminder Worker for buyer-owned Cloudflare deployment;
- a Cloudflare Pages asset manifest with precomputed BLAKE3 hashes;
- release metadata.

The customer will still be able to inspect browser-delivered HTML/CSS/JS and Cloudflare-deployed runtime code they control. This protects the clean master source/distribution path; it is not DRM.

Use GitHub Actions → **Build protected Eselram release** → Run workflow, entering the version requested by the Provisioner.
