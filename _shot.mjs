import { chromium } from 'playwright';

const url = process.env.KCA_REPORT_URL;
if (!url) {
  throw new Error('Set KCA_REPORT_URL to the report URL you want to capture.');
}
const browser = await chromium.launch();
const outdir = '/tmp/report-shots';
import { mkdirSync } from 'fs';
mkdirSync(outdir, { recursive: true });

// Desktop full page
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${outdir}/desktop-full.png`, fullPage: true });
// Capture errors
const fs = await import('fs');
fs.writeFileSync(`${outdir}/console-errors.txt`, errors.join('\n'));

// Above the fold desktop
await page.screenshot({ path: `${outdir}/desktop-fold.png`, fullPage: false });

// Mobile
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
const mpage = await mctx.newPage();
await mpage.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
await mpage.waitForTimeout(2000);
await mpage.screenshot({ path: `${outdir}/mobile-full.png`, fullPage: true });
await mpage.screenshot({ path: `${outdir}/mobile-fold.png`, fullPage: false });

await browser.close();
console.log('Done. Errors:', errors.length);
