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

const pageErrors = [];
const consoleErrors = [];
page.on('pageerror', (error) => pageErrors.push(String(error)));
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});

async function register() {
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

  const values = [email, password, password];
  for (const [position, value] of values.entries()) {
    const locator = page.locator('input').nth(visibleIndexes[visibleIndexes.length - 3 + position]);
    await locator.click({ force: true });
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await page.keyboard.type(value);
  }

  await page.getByText(/^注册$/).first().click({ force: true });
  await page.waitForURL((url) => !url.pathname.endsWith('/register'), { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

async function summarize(label) {
  const info = await page.evaluate(() => {
    const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
    const uniq = (items) => [...new Set(items.filter(Boolean))];
    return {
      url: location.href,
      text: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 3000),
      links: uniq(
        [...document.querySelectorAll('a')]
          .map((el) => text(el) || el.getAttribute('href') || '')
          .filter((value) => value && value.length <= 120),
      ),
      inputs: [...document.querySelectorAll('input,textarea,select')].length,
    };
  });
  return { label, ...info };
}

async function clickTab(name) {
  const locator = page.getByText(new RegExp(name, 'i'));
  await locator.last().click({ force: true });
  await page.waitForLoadState('networkidle');
  return summarize(name);
}

await register();

const results = [];
results.push(await summarize('首页'));

for (const tab of ['成员资产', '录入', '我的', '首页']) {
  results.push(await clickTab(tab));
}

const monthToggle = page.getByText(/按月/i).last();
const yearToggle = page.getByText(/按年/i).last();
if (await monthToggle.count()) {
  await monthToggle.click({ force: true });
  await page.waitForTimeout(500);
  results.push(await summarize('首页-按月'));
}
if (await yearToggle.count()) {
  await yearToggle.click({ force: true });
  await page.waitForTimeout(500);
  results.push(await summarize('首页-按年'));
}

const payload = { email, password, results, pageErrors, consoleErrors };
await fs.writeFile(path.join(outDir, 'core-tabs.json'), JSON.stringify(payload, null, 2));
console.log(JSON.stringify(payload, null, 2));

await browser.close();
