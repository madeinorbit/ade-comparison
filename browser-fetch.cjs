#!/usr/bin/env node
// browser-fetch.cjs — rendered (JS-executed) page fetch for ADE catalog research.
// Branch-only working tool for the 554-queue effort. DELETE BEFORE MERGE to main.
//
// Usage:
//   LD_LIBRARY_PATH="$HOME/.cache/ade-browser-libs/usr/lib/x86_64-linux-gnu" \
//     node browser-fetch.cjs "https://example.com/docs" /tmp/out-prefix [--dismiss-cookies]
//
// Output: JSON on stdout { url, finalUrl, status, title, text, links[], screenshot }.
// Screenshot is saved to <out-prefix>.png. Exit 0 on success, 3 with BROWSER_FAIL on stderr on failure.
//
// Why this exists: curl/wget only see the pre-JS shell of JS-rendered marketing/docs
// sites. This drives headless Chromium (playwright-core + cached headless shell) so
// researchers read what a user actually sees. It is a fetch tool, not evidence by
// itself: record URL, retrieval date and findings in the evidence ledger per AGENTS.md.
const { chromium } = require('/home/mgw/src/podium/node_modules/playwright-core');
const fs = require('fs');

const HEADLESS_SHELL = '/home/mgw/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';

async function main() {
  const [url, outPrefix, ...flags] = process.argv.slice(2);
  if (!url || !outPrefix) {
    console.error('usage: node browser-fetch.cjs "<url>" <out-prefix> [--dismiss-cookies]');
    process.exit(2);
  }
  const browser = await chromium.launch({
    executablePath: HEADLESS_SHELL,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    if (flags.includes('--dismiss-cookies')) {
      // Best-effort consent dismissal so content underneath is readable. Record it in notes.
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const deny = btns.find(b => /^(deny|reject( all)?|necessary only)$/i.test(b.innerText.trim()));
        if (deny) deny.click();
      });
      await page.waitForTimeout(1500);
    }
    const title = await page.title();
    const text = await page.evaluate(() => document.body ? document.body.innerText.slice(0, 8000) : '');
    const links = await page.evaluate(() => Array.from(document.querySelectorAll('a[href]'))
      .map(a => a.href).filter(h => /^https?:/.test(h)).slice(0, 40));
    const shotPath = outPrefix + '.png';
    await page.screenshot({ path: shotPath });
    console.log(JSON.stringify({ url, finalUrl: page.url(), status: resp ? resp.status() : null, title, text, links, screenshot: shotPath }, null, 1));
  } finally {
    await browser.close();
  }
}

main().catch(e => { console.error('BROWSER_FAIL: ' + (e && e.message ? e.message.split('\n')[0] : e)); process.exit(3); });
