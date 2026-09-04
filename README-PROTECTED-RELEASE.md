# Eselram protected release builder

The protected-release builder creates the deployment package used by the Eselram Provisioner.

The release contains:

- browser assets required by Eselram;
- a compiled/minified Pages `_worker.js` generated from `functions/`;
- database migrations;
- the reminder Worker used for buyer-owned Cloudflare deployment;
- a Pages asset manifest with precomputed hashes;
- release/version metadata.

The customer can still inspect browser-delivered assets and runtime code deployed into infrastructure they control. Protected releases protect the clean source/distribution path; they are not DRM.

## Build a release

Use GitHub Actions → **Build protected Eselram release** → **Run workflow**.

Enter the intended version explicitly. The workflow must not reuse an existing published version.

After the workflow succeeds:

1. verify the generated artifact;
2. upload the inner protected release ZIP to the private `eselram-releases` R2 bucket;
3. register that release with the Eselram Licensing API;
4. test release resolution before using it for a production installation or update.
