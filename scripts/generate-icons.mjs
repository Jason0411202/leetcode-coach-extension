#!/usr/bin/env node
/**
 * Generate icon16.png, icon48.png, icon128.png from a single SVG source
 * — using only Node built-ins (no sharp / canvas dependency).
 *
 * Strategy: hand-render a stylized book glyph onto an RGBA pixel buffer,
 * then write a valid PNG using zlib for IDAT compression.
 *
 * Output:  icons/icon{16,48,128}.png
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { deflateSync, constants } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = join(__dirname, '..', 'icons');
mkdirSync(ICONS_DIR, { recursive: true });

const PRIMARY = [0x5b, 0x8d, 0xef]; // brand blue
const WHITE = [0xff, 0xff, 0xff];
const SHADOW = [0x3d, 0x69, 0xc8];

function makeIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.46;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let r = 0, g = 0, b = 0, a = 0;

      if (dist <= radius) {
        // Filled circle in primary blue
        r = PRIMARY[0]; g = PRIMARY[1]; b = PRIMARY[2]; a = 255;

        // Render a stylised "book": two white pages with a divider
        const bookW = size * 0.55;
        const bookH = size * 0.42;
        const bookX0 = cx - bookW / 2;
        const bookY0 = cy - bookH / 2;
        const bookX1 = cx + bookW / 2;
        const bookY1 = cy + bookH / 2;

        if (x >= bookX0 && x <= bookX1 && y >= bookY0 && y <= bookY1) {
          r = WHITE[0]; g = WHITE[1]; b = WHITE[2];
          // spine line in middle
          if (Math.abs(x - cx) < Math.max(1, size * 0.012)) {
            r = SHADOW[0]; g = SHADOW[1]; b = SHADOW[2];
          }
          // horizontal text-mock lines
          const textRow = (y - bookY0) / bookH;
          const inLine =
            (textRow > 0.25 && textRow < 0.32) ||
            (textRow > 0.5 && textRow < 0.57) ||
            (textRow > 0.72 && textRow < 0.79);
          if (inLine) {
            const onPage = (x < cx && x > bookX0 + size * 0.05 && x < cx - size * 0.04) ||
                           (x > cx && x < bookX1 - size * 0.05 && x > cx + size * 0.04);
            if (onPage) {
              r = PRIMARY[0]; g = PRIMARY[1]; b = PRIMARY[2];
            }
          }
        }

        // Edge antialiasing
        const edge = radius - dist;
        if (edge < 1.2) {
          a = Math.max(0, Math.round(255 * (edge / 1.2)));
        }
      }

      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
      buf[i + 3] = a;
    }
  }
  return buf;
}

function encodePng(rgba, width, height) {
  // IHDR data
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace

  // Filter rows: prefix each row with 0 (no filter)
  const rowSize = width * 4;
  const filtered = Buffer.alloc((rowSize + 1) * height);
  for (let y = 0; y < height; y++) {
    filtered[y * (rowSize + 1)] = 0;
    rgba.copy(filtered, y * (rowSize + 1) + 1, y * rowSize, (y + 1) * rowSize);
  }
  const compressed = deflateSync(filtered, { level: constants.Z_BEST_COMPRESSION });

  const chunks = [
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // signature
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ];
  return Buffer.concat(chunks);
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const SIZES = [16, 48, 128];
for (const size of SIZES) {
  const rgba = makeIcon(size);
  const png = encodePng(rgba, size, size);
  const path = join(ICONS_DIR, `icon${size}.png`);
  writeFileSync(path, png);
  const hash = createHash('sha256').update(png).digest('hex').slice(0, 8);
  console.log(`✓ ${path}  (${png.length} bytes, sha256=${hash})`);
}
console.log('Done.');
