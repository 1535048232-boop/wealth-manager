import { chromium } from 'playwright';

const baseURL = process.env.APP_URL || 'http://127.0.0.1:8088/';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

const failures = [];
const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') {
    consoleErrors.push(msg.text());
  }
});
page.on('pageerror', (error) => failures.push(`pageerror:${String(error)}`));

await page.goto(baseURL, { waitUntil: 'networkidle', timeout: 30000 });

const pageText = await page.locator('body').innerText();
const hasVisibleText = pageText.trim().length > 0;
if (!hasVisibleText) failures.push('body has no visible text');

const monthToggle = page.getByText(/按月/i).or(page.getByRole('button', { name: /按月/i }));
const yearToggle = page.getByText(/按年/i).or(page.getByRole('button', { name: /按年/i }));

if (await monthToggle.count()) {
  await monthToggle.first().click();
}

if (await yearToggle.count()) {
  await yearToggle.first().click();
}

const bodyAfterToggle = await page.locator('body').innerText();
if (!bodyAfterToggle.trim()) failures.push('body became empty after toggle check');

const result = {
  url: page.url(),
  hasVisibleText,
  consoleErrors,
  failures,
  bodyPreview: bodyAfterToggle.replace(/\s+/g, ' ').slice(0, 1000),
};

console.log(JSON.stringify(result, null, 2));

await browser.close();

if (failures.length) {
  process.exitCode = 1;
}
