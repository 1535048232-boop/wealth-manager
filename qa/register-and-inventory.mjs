import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.APP_URL || 'http://127.0.0.1:8088/';
const email = process.env.TEST_EMAIL || `leo+${Date.now()}@example.com`;
const password = process.env.TEST_PASSWORD || 'Passw0rd!';
const outDir = path.resolve('qa/artifacts');

await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

const requests = [];
const responses = [];
const consoleErrors = [];
page.on('request', (request) => {
  if (request.url().includes('/api/') || request.method() !== 'GET') {
    requests.push({ method: request.method(), url: request.url() });
  }
});
page.on('response', async (response) => {
  if (response.url().includes('/api/') || response.request().method() !== 'GET') {
    responses.push({
      status: response.status(),
      url: response.url(),
      method: response.request().method(),
    });
  }
});
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});

await page.goto(baseURL, { waitUntil: 'networkidle', timeout: 30000 });
await page.getByText(/立即注册/i).first().click();
await page.waitForURL(/\/register/, { timeout: 10000 });

const visibleIndexes = await page.locator('input').evaluateAll((elements) =>
  elements
    .map((el, index) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 ? index : -1;
    })
    .filter((index) => index >= 0),
);

if (visibleIndexes.length < 3) {
  throw new Error(`Expected at least 3 visible inputs, found ${visibleIndexes.length}`);
}

const values = [email, password, password];
for (const [position, value] of values.entries()) {
  const locator = page.locator('input').nth(visibleIndexes[visibleIndexes.length - 3 + position]);
  await locator.click({ force: true });
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.type(value);
}

const clickCandidates = [
  page.getByRole('button', { name: /^注册$/ }),
  page.getByText(/^注册$/),
];

let clicked = false;
for (const locator of clickCandidates) {
  if (await locator.count()) {
    await locator.first().click({ force: true });
    clicked = true;
    break;
  }
}

if (!clicked) {
  throw new Error('Register submit control not found');
}

await page.waitForTimeout(4000);
await page.waitForLoadState('networkidle').catch(() => {});

const summary = await page.evaluate(() => {
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const uniq = (items) => [...new Set(items.filter(Boolean))];
  return {
    url: location.href,
    title: document.title,
    bodyText: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 4000),
    buttons: uniq(
      [...document.querySelectorAll('button,[role="button"]')]
        .map((el) => text(el))
        .filter((value) => value && value.length <= 80),
    ),
    links: uniq(
      [...document.querySelectorAll('a')]
        .map((el) => text(el) || el.getAttribute('href') || '')
        .filter((value) => value && value.length <= 120),
    ),
  };
});

await page.screenshot({ path: path.join(outDir, 'post-register.png'), fullPage: true });
await fs.writeFile(
  path.join(outDir, 'register-session.json'),
  JSON.stringify({ email, password, summary, requests, responses, consoleErrors }, null, 2),
);

console.log(JSON.stringify({ email, password, summary, requests, responses, consoleErrors }, null, 2));

await browser.close();
