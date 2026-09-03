Eselram protected release RC3 build fix

Replace these files in rouxmrh/eselram:
- scripts/build-protected-release.mjs
- .github/workflows/build-protected-release.yml

What changed:
- Builds Pages Functions with Wrangler --outdir instead of --outfile.
- Copies worker-build/index.js as payload/_worker.js.
- Rejects multipart/form-data output before a release can be packaged.
- GitHub Actions extracts payload/_worker.js, rejects multipart output, and runs node --check.
- Default release version advanced to 1.0.0-rc3.

After committing, run the GitHub Actions workflow with version 1.0.0-rc3.
Do not overwrite the published rc2 object/release record.
