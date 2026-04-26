#!/usr/bin/env node
/**
 * Build a clean dist/ directory containing exactly what Chrome needs to
 * load the extension as an unpacked dir, and produce a zip artifact.
 *
 * Layout in dist/leetcode-coach-extension/:
 *   manifest.json
 *   icons/icon{16,48,128}.png
 *   src/{components,content,dashboard,lib,background.js}
 *
 * Excluded: test/, scripts/, docs/, *.md, .git/, node_modules/, .github/
 *
 * Usage:
 *   node scripts/build.mjs              # writes dist/ + dist/leetcode-coach-extension-<version>.zip
 *   node scripts/build.mjs --no-zip     # only the unpacked dir
 */
import { mkdirSync, rmSync, copyFileSync, readFileSync, writeFileSync, statSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync, constants } from 'node:zlib';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');
const PKG_NAME = 'leetcode-coach-extension';
const PKG_DIR = join(DIST, PKG_NAME);

const args = new Set(process.argv.slice(2));
const noZip = args.has('--no-zip');

const INCLUDE = [
  'manifest.json',
  'icons',
  'src'
];

const EXCLUDE_PATTERNS = [
  /(^|[\\/])\.git([\\/]|$)/,
  /(^|[\\/])node_modules([\\/]|$)/,
  /(^|[\\/])dist([\\/]|$)/,
  /(^|[\\/])test([\\/]|$)/,
  /(^|[\\/])scripts([\\/]|$)/,
  /(^|[\\/])docs([\\/]|$)/,
  /(^|[\\/])\.github([\\/]|$)/,
  /\.md$/i,
  /^LICENSE$/i,
  /\.DS_Store$/,
  /Thumbs\.db$/i
];

function shouldExclude(rel) {
  return EXCLUDE_PATTERNS.some(re => re.test(rel));
}

function* walk(dir, base = dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(base, full);
    if (shouldExclude(rel)) continue;
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full, base);
    else yield { full, rel };
  }
}

function ensureDir(p) {
  mkdirSync(p, { recursive: true });
}

function copyTree(src, dest) {
  if (!existsSync(src)) {
    throw new Error(`Source not found: ${src}`);
  }
  const st = statSync(src);
  if (st.isFile()) {
    ensureDir(dirname(dest));
    copyFileSync(src, dest);
    return 1;
  }
  let count = 0;
  for (const { full, rel } of walk(src)) {
    const out = join(dest, rel);
    ensureDir(dirname(out));
    copyFileSync(full, out);
    count++;
  }
  return count;
}

function pad(s, n) { return s.padEnd(n); }

function log(msg) { console.log(`[build] ${msg}`); }

// ---- Step 1: Clean dist/ ---------------------------------------------------
log('Cleaning dist/');
rmSync(DIST, { recursive: true, force: true });
ensureDir(PKG_DIR);

// ---- Step 2: Validate manifest ---------------------------------------------
const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
const VERSION = manifest.version;
if (!/^\d+\.\d+\.\d+(\.\d+)?$/.test(VERSION)) {
  console.error(`[build] Invalid manifest.version: "${VERSION}"`);
  process.exit(1);
}
log(`Building ${PKG_NAME} v${VERSION}`);

// Validate referenced files exist
const referenced = [
  manifest.background?.service_worker,
  ...(manifest.content_scripts || []).flatMap(cs => [...(cs.js || []), ...(cs.css || [])]),
  manifest.action?.default_popup,
  ...Object.values(manifest.action?.default_icon || {}),
  ...Object.values(manifest.icons || {})
].filter(Boolean);

const missing = referenced.filter(p => !existsSync(join(ROOT, p)));
if (missing.length) {
  console.error('[build] Missing files referenced by manifest.json:');
  missing.forEach(m => console.error(`   - ${m}`));
  process.exit(1);
}

// ---- Step 3: Copy files ----------------------------------------------------
let totalFiles = 0;
for (const item of INCLUDE) {
  const src = join(ROOT, item);
  const dest = join(PKG_DIR, item);
  const n = copyTree(src, dest);
  log(`Copied ${pad(item, 20)} ${n} file(s)`);
  totalFiles += n;
}

// ---- Step 4: Compute size & checksum --------------------------------------
let totalBytes = 0;
const allFiles = [];
for (const { full, rel } of walk(PKG_DIR)) {
  const data = readFileSync(full);
  totalBytes += data.length;
  allFiles.push({ rel: rel.split(sep).join('/'), data, mtime: statSync(full).mtime });
}
log(`Total: ${totalFiles} files, ${(totalBytes / 1024).toFixed(1)} KB unpacked`);

if (noZip) {
  log(`Done. Unpacked extension at: ${PKG_DIR}`);
  process.exit(0);
}

// ---- Step 5: Build ZIP (no external deps) ---------------------------------
const zipName = `${PKG_NAME}-v${VERSION}.zip`;
const zipPath = join(DIST, zipName);

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosTime(d) {
  const t = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((Math.floor(d.getSeconds() / 2)) & 0x1f);
  const date = (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0x0f) << 5) | (d.getDate() & 0x1f);
  return { dosTime: t, dosDate: date };
}

function zipFiles(entries) {
  const localChunks = [];
  const central = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.rel, 'utf8');
    const data = entry.data;
    const compressed = deflateRawSync(data, { level: constants.Z_BEST_COMPRESSION });
    const useCompression = compressed.length < data.length;
    const stored = useCompression ? compressed : data;
    const method = useCompression ? 8 : 0;
    const crc = crc32(data);
    const { dosTime: dt, dosDate: dd } = dosTime(entry.mtime);

    // Local file header
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);          // version needed
    local.writeUInt16LE(0x0800, 6);      // flag: UTF-8 names
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(dt, 10);
    local.writeUInt16LE(dd, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(stored.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    localChunks.push(local, nameBuf, stored);

    const localSize = local.length + nameBuf.length + stored.length;

    // Central directory entry
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);              // version made by
    c.writeUInt16LE(20, 6);              // version needed
    c.writeUInt16LE(0x0800, 8);          // flag: UTF-8
    c.writeUInt16LE(method, 10);
    c.writeUInt16LE(dt, 12);
    c.writeUInt16LE(dd, 14);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(stored.length, 20);
    c.writeUInt32LE(data.length, 24);
    c.writeUInt16LE(nameBuf.length, 28);
    c.writeUInt16LE(0, 30);              // extra field len
    c.writeUInt16LE(0, 32);              // comment len
    c.writeUInt16LE(0, 34);              // disk number
    c.writeUInt16LE(0, 36);              // internal attrs
    c.writeUInt32LE(0, 38);              // external attrs
    c.writeUInt32LE(offset, 42);         // offset of local header
    central.push(c, nameBuf);

    offset += localSize;
  }

  const cdStart = offset;
  const cdBuf = Buffer.concat(central);
  const cdSize = cdBuf.length;

  // End-of-central-directory
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);              // disk
  eocd.writeUInt16LE(0, 6);              // start disk
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdStart, 16);
  eocd.writeUInt16LE(0, 20);             // comment len

  return Buffer.concat([...localChunks, cdBuf, eocd]);
}

// Sort entries deterministically for reproducible builds
allFiles.sort((a, b) => a.rel.localeCompare(b.rel));
// Files live at the zip root (NOT nested under a folder).
// Reason: Windows Explorer and macOS Finder auto-create a wrapper folder
// named after the zip when extracting (e.g. "leetcode-coach-extension-v0.1.0/"),
// so the user ends up with that folder containing manifest.json directly —
// ready to load via Chrome's "Load unpacked".
// If we also nested inside the zip, users would get
//   Downloads/leetcode-coach-extension-v0.1.0/leetcode-coach-extension/manifest.json
// and Chrome (pointed at the outer folder) would say "manifest file is missing".
const zipEntries = allFiles.map(f => ({
  rel: f.rel,
  data: f.data,
  mtime: f.mtime
}));

const zipBuffer = zipFiles(zipEntries);
writeFileSync(zipPath, zipBuffer);
const sha256 = createHash('sha256').update(zipBuffer).digest('hex');

log(`✓ Wrote ${zipName} (${(zipBuffer.length / 1024).toFixed(1)} KB)`);
log(`  sha256: ${sha256}`);
log(`Done.`);

// Emit a small metadata file alongside the zip
const meta = {
  name: PKG_NAME,
  version: VERSION,
  built_at: new Date().toISOString(),
  zip_filename: zipName,
  zip_size_bytes: zipBuffer.length,
  zip_sha256: sha256,
  total_files: allFiles.length,
  unpacked_size_bytes: totalBytes
};
writeFileSync(join(DIST, 'release.json'), JSON.stringify(meta, null, 2));
log(`  metadata: dist/release.json`);
