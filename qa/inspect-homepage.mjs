import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.APP_URL || 'http://127.0.0.1:8088/';
const outDir = path.resolve('qa/artifacts');

await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

const consoleMessages = [];
const pageErrors = [];
page.on('console', (msg) => {
  const type = msg.type();
  if (type === 'error' || type === 'warning') {
    consoleMessages.push({ type, text: msg.text() });
  }
});
page.on('pageerror', (error) => {
  pageErrors.push(String(error));
});

await page.goto(baseURL, { waitUntil: 'networkidle', timeout: 30000 });

const summary = await page.evaluate(() => {
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const uniq = (items) => [...new Set(items.filter(Boolean))];
  const buttons = uniq(
    [...document.querySelectorAll('button,[role="button"]')]
      .map((el) => text(el))
      .filter((value) => value && value.length <= 80),
  );
  const headings = uniq(
    [...document.querySelectorAll('h1,h2,h3,[role="heading"]')]
      .map((el) => text(el))
      .filter((value) => value && value.length <= 120),
  );
  const links = uniq(
    [...document.querySelectorAll('a')]
      .map((el) => text(el) || el.getAttribute('href') || '')
      .filter((value) => value && value.length <= 120),
  );
  const inputs = [...document.querySelectorAll('input,textarea,select')].map((el) => ({
    tag: el.tagName.toLowerCase(),
    type: el.getAttribute('type') || '',
    name: el.getAttribute('name') || '',
    placeholder: el.getAttribute('placeholder') || '',
  }));
  return {
    title: document.title,
    url: location.href,
    bodyText: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 4000),
    headings,
    buttons,
    links,
    inputs,
  };
});

await page.screenshot({ path: path.join(outDir, 'homepage.png'), fullPage: true });
await fs.writeFile(
  path.join(outDir, 'homepage-summary.json'),
  JSON.stringify({ summary, consoleMessages, pageErrors }, null, 2),
);

console.log(JSON.stringify({ summary, consoleMessages, pageErrors }, null, 2));

await browser.close();
