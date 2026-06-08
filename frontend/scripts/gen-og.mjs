// Rasterize public/og.svg -> public/og.png (1200x630) for social cards.
// X/Twitter and Facebook don't render SVG og:images, so a PNG is required.
// Run: npm run gen-og   (uses @resvg/resvg-js — no system deps).
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../public/', import.meta.url);
const svg = readFileSync(new URL('og.svg', root));

const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: 1200 },
  font: { loadSystemFonts: true },
  background: '#0a0c10',
});
const png = resvg.render().asPng();
writeFileSync(new URL('og.png', root), png);
console.log(`og.png written: ${png.length} bytes`);
