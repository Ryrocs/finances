// Renders the app icons (SVG → PNG) with Playwright's Chromium. Run: npm run icons
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

// A donut-chart mark: a white arc and a green arc on a near-black square.
const R = 14;
const C = 2 * Math.PI * R;
const mark = (scale) => `
  <g transform="translate(32 32) scale(${scale}) rotate(-90)">
    <circle r="${R}" fill="none" stroke="#ffffff" stroke-opacity="0.16" stroke-width="7"/>
    <circle r="${R}" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round"
      stroke-dasharray="${(C * 0.56).toFixed(2)} ${C.toFixed(2)}"/>
    <circle r="${R}" fill="none" stroke="#10B981" stroke-width="7" stroke-linecap="round"
      stroke-dasharray="${(C * 0.2).toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${(-C * 0.66).toFixed(2)}"/>
  </g>`;

const svg = ({ rounded, scale }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
  `<rect width="64" height="64" ${rounded ? 'rx="14"' : ''} fill="#111111"/>${mark(scale)}</svg>`;

const targets = [
  // "any" icons: rounded square on transparent background.
  { file: 'public/icons/icon.svg', svg: svg({ rounded: true, scale: 1 }) },
  { file: 'public/icons/icon-192.png', size: 192, svg: svg({ rounded: true, scale: 1 }), transparent: true },
  { file: 'public/icons/icon-512.png', size: 512, svg: svg({ rounded: true, scale: 1 }), transparent: true },
  // Maskable and Apple: full-bleed square, the mark inside the safe zone (the OS rounds the corners).
  { file: 'public/icons/icon-maskable-512.png', size: 512, svg: svg({ rounded: false, scale: 0.78 }) },
  { file: 'public/icons/apple-touch-icon.png', size: 180, svg: svg({ rounded: false, scale: 0.92 }) },
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
for (const t of targets) {
  if (!t.size) {
    await writeFile(t.file, `${t.svg}\n`);
    console.log('wrote', t.file);
    continue;
  }
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${t.svg.replace('<svg ', `<svg width="${t.size}" height="${t.size}" `)}</body></html>`);
  const png = await page.screenshot({ omitBackground: !!t.transparent, clip: { x: 0, y: 0, width: t.size, height: t.size } });
  await writeFile(t.file, png);
  console.log('wrote', t.file);
}
await browser.close();
