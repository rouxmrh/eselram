import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { blake3 } from "@noble/hashes/blake3";
import archiver from "archiver";

const VERSION = process.argv[2] || process.env.RELEASE_VERSION || "1.0.0-rc2";
const ROOT = process.cwd();
const BUILD = path.join(ROOT, ".release-build");
const PACKAGE = path.join(BUILD, "package");
const PAYLOAD = path.join(PACKAGE, "payload");
const OUT = path.join(ROOT, `eselram-release-${VERSION}.zip`);

const EXCLUDED_ROOTS = new Set([
  ".git", ".github", ".release-build", "node_modules", "functions", "lib",
  "database", "workers", "docs", "scripts"
]);
const EXCLUDED_ROOT_FILES = new Set([
  "README.md", "package.json", "package-lock.json", "wrangler.jsonc", "wrangler.toml"
]);
const SPECIAL = new Set(["_worker.js", "_routes.json", "_headers", "_redirects"]);

const MIME = {
  ".html": "text/html; charset=UTF-8", ".js": "application/javascript; charset=UTF-8",
  ".css": "text/css; charset=UTF-8", ".json": "application/json; charset=UTF-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".ico": "image/x-icon", ".txt": "text/plain; charset=UTF-8"
};

function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status || 1);
}
function base64(bytes) { return Buffer.from(bytes).toString("base64"); }
function pagesHash(bytes, filename) {
  const ext = path.extname(filename).slice(1);
  const input = Buffer.from(base64(bytes) + ext, "utf8");
  return Buffer.from(blake3(input)).toString("hex").slice(0, 32);
}
function contentType(filename) { return MIME[path.extname(filename).toLowerCase()] || "application/octet-stream"; }

async function copyDir(src, dst) {
  await fsp.mkdir(dst, { recursive: true });
  for (const entry of await fsp.readdir(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dst, entry.name);
    if (entry.isDirectory()) await copyDir(from, to);
    else if (entry.isFile()) await fsp.copyFile(from, to);
  }
}
async function walk(dir, base = dir, out = []) {
  for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, base, out);
    else if (entry.isFile()) out.push(path.relative(base, full).replaceAll(path.sep, "/"));
  }
  return out;
}

await fsp.rm(BUILD, { recursive: true, force: true });
await fsp.mkdir(PAYLOAD, { recursive: true });

for (const entry of await fsp.readdir(ROOT, { withFileTypes: true })) {
  if (entry.isDirectory()) {
    if (!EXCLUDED_ROOTS.has(entry.name)) await copyDir(path.join(ROOT, entry.name), path.join(PAYLOAD, entry.name));
  } else if (entry.isFile() && !EXCLUDED_ROOT_FILES.has(entry.name) && !entry.name.startsWith("eselram-release-")) {
    await fsp.copyFile(path.join(ROOT, entry.name), path.join(PAYLOAD, entry.name));
  }
}

run("npx", ["wrangler", "pages", "functions", "build", "functions", "--outfile", path.join(PAYLOAD, "_worker.js"), "--project-directory", ROOT, "--output-routes-path", path.join(PAYLOAD, "_routes.json"), "--minify"]);

await fsp.mkdir(path.join(PACKAGE, "database", "migrations"), { recursive: true });
await copyDir(path.join(ROOT, "database", "migrations"), path.join(PACKAGE, "database", "migrations"));
await fsp.mkdir(path.join(PACKAGE, "workers"), { recursive: true });
await fsp.copyFile(path.join(ROOT, "workers", "eselram-reminders.js"), path.join(PACKAGE, "workers", "eselram-reminders.js"));

const manifest = {};
for (const rel of await walk(PAYLOAD)) {
  if (SPECIAL.has(rel)) continue;
  const bytes = await fsp.readFile(path.join(PAYLOAD, rel));
  manifest[rel] = { hash: pagesHash(bytes, rel), size: bytes.length, content_type: contentType(rel) };
}
await fsp.writeFile(path.join(PACKAGE, "ESELRAM-DEPLOY.json"), JSON.stringify({ format: 2, product: "Eselram", version: VERSION, distribution: "protected-release", files: manifest }, null, 2));
await fsp.writeFile(path.join(PACKAGE, "ESELRAM-RELEASE.json"), JSON.stringify({ product: "Eselram", version: VERSION, format: 2, generated_at: new Date().toISOString() }, null, 2));
await fsp.writeFile(path.join(PACKAGE, "PROPRIETARY-NOTICE.txt"), "Eselram proprietary release. Licensed installation only. Redistribution is not permitted.\n");

await new Promise((resolve, reject) => {
  const output = fs.createWriteStream(OUT);
  const zip = archiver("zip", { zlib: { level: 9 } });
  output.on("close", resolve); output.on("error", reject); zip.on("error", reject);
  zip.pipe(output); zip.directory(PACKAGE, false); zip.finalize();
});
const digest = crypto.createHash("sha256").update(await fsp.readFile(OUT)).digest("hex");
await fsp.writeFile(`${OUT}.sha256.txt`, `${digest}  ${path.basename(OUT)}\n`);
console.log(`\nProtected release built: ${OUT}`);
console.log(`SHA-256: ${digest}`);
