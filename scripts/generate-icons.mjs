// Renders the PWA / Apple touch icons from SVG with the bundled Chromium (run: npm run icons).
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const symbol = (scale) => `
  <g transform="translate(32 32) scale(${scale}) translate(-32 -32)">
    <path d="M18 40 L28 30 L35 36 L46 23" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="46" cy="23" r="4" fill="#fff"/>
  </g>`;
const gradient = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#10b981"/><stop offset="1" stop-color="#047857"/></linearGradient></defs>`;
// "any": rounded square. Maskable/Apple: full-bleed square, symbol inside the 80 % safe zone.
const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${gradient}<rect width="64" height="64" rx="14" fill="url(#g)"/>${symbol(1.05)}</svg>`;
const fullBleed = (scale) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${gradient}<rect width="64" height="64" fill="url(#g)"/>${symbol(scale)}</svg>`;

const targets = [
  { file: 'public/icons/icon-192.png', size: 192, svg: rounded, transparent: true },
  { file: 'public/icons/icon-512.png', size: 512, svg: rounded, transparent: true },
  { file: 'public/icons/icon-maskable-512.png', size: 512, svg: fullBleed(0.8) },
  { file: 'public/icons/apple-touch-icon.png', size: 180, svg: fullBleed(0.95) },
  { file: 'src/app/favicon.ico', size: 48, svg: rounded, transparent: true, ico: true },
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${t.svg.replace('<svg ', `<svg width="${t.size}" height="${t.size}" `)}</body></html>`);
  const png = await page.screenshot({ omitBackground: !!t.transparent, clip: { x: 0, y: 0, width: t.size, height: t.size } });
  if (t.ico) {
    // ICO container with a single embedded PNG image.
    const header = Buffer.alloc(22);
    header.writeUInt16LE(0, 0);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(1, 4);
    header.writeUInt8(t.size, 6);
    header.writeUInt8(t.size, 7);
    header.writeUInt16LE(1, 10);
    header.writeUInt16LE(32, 12);
    header.writeUInt32LE(png.length, 14);
    header.writeUInt32LE(22, 18);
    await writeFile(t.file, Buffer.concat([header, png]));
  } else {
    await writeFile(t.file, png);
  }
  console.log('wrote', t.file);
}
await browser.close();
