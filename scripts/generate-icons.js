// scripts/generate-icons.js - Generates valid PNG icons without external dependencies using Node.js zlib
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPNG(width, height, r, g, b, a = 255) {
  // Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // 8-bit depth
  ihdrData.writeUInt8(6, 9); // RGBA
  ihdrData.writeUInt8(0, 10); // Deflate
  ihdrData.writeUInt8(0, 11); // Filter
  ihdrData.writeUInt8(0, 12); // Interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // IDAT - Scanlines with filter byte 0
  const scanlineLength = width * 4 + 1;
  const rawData = Buffer.alloc(height * scanlineLength);

  for (let y = 0; y < height; y++) {
    const offset = y * scanlineLength;
    rawData[offset] = 0; // filter None
    for (let x = 0; x < width; x++) {
      const pixelOffset = offset + 1 + x * 4;
      // create a sleek gradient with emerald / dark slate tones
      const cx = width / 2;
      const cy = height / 2;
      const dist = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) / (width / 2);
      const factor = Math.max(0, Math.min(1, 1 - dist));

      rawData[pixelOffset] = Math.floor(r * (0.6 + 0.4 * factor));     // R
      rawData[pixelOffset + 1] = Math.floor(g * (0.6 + 0.4 * factor)); // G
      rawData[pixelOffset + 2] = Math.floor(b * (0.6 + 0.4 * factor)); // B
      rawData[pixelOffset + 3] = a;                                    // A
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);

  // IEND
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = (c >>> 8) ^ crcTable[(c ^ buf[i]) & 0xff];
  }
  return (c ^ 0xffffffff) >>> 0;
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function makeChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(12 + len);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const typeAndData = buf.subarray(4, 8 + len);
  const crc = crc32(typeAndData);
  buf.writeUInt32BE(crc, 8 + len);
  return buf;
}

const publicDir = path.resolve('public');
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPNG(192, 192, 16, 185, 129));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPNG(512, 512, 16, 185, 129));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPNG(512, 512, 14, 165, 233));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPNG(180, 180, 16, 185, 129));
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), createPNG(32, 32, 16, 185, 129));

console.log('Successfully generated PWA and Apple Touch PNG icons in /public.');
