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
page.on('pageerror', (error) => pageErrors.push(String(error)));

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

  for (const [position, value] of [email, password, password].entries()) {
    const locator = page.locator('input').nth(visibleIndexes[visibleIndexes.length - 3 + position]);
    await locator.click({ force: true });
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await page.keyboard.type(value);
  }

  await page.getByText(/^注册$/).first().click({ force: true });
  await page.waitForURL((url) => !url.pathname.endsWith('/register'), { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

async function capture(label) {
  await page.waitForLoadState('networkidle').catch(() => {});
  return page.evaluate((label) => ({
    label,
    url: location.href,
    text: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 2500),
    inputCount: document.querySelectorAll('input,textarea,select').length,
  }), label);
}

async function goProfile() {
  await page.getByText(/我的/i).last().click({ force: true });
  await page.waitForURL(/\/profile/, { timeout: 10000 });
}

await register();
await goProfile();

const targets = [
  '创建家庭',
  '家庭成员',
  '数据导入导出',
  '我的资产账户',
];

const results = [await capture('profile')];

for (const target of targets) {
  await goProfile();
  const locator = page.getByText(new RegExp(target));
  if (!(await locator.count())) {
    results.push({ label: target, status: 'missing' });
    continue;
  }
  await locator.first().click({ force: true });
  await page.waitForTimeout(1000);
  results.push(await capture(target));
}

const entry = page.getByText(/录入/i).last();
if (await entry.count()) {
  await entry.click({ force: true });
  await page.waitForTimeout(1000);
  results.push(await capture('录入'));
}

const payload = { email, results, pageErrors };
await fs.writeFile(path.join(outDir, 'secondary-flows.json'), JSON.stringify(payload, null, 2));
console.log(JSON.stringify(payload, null, 2));

await browser.close();
