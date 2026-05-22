import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.APP_URL || 'http://127.0.0.1:8088/';
const email = process.env.TEST_EMAIL || `leo+${Date.now()}@example.com`;
const password = process.env.TEST_PASSWORD || 'Passw0rd!';
const familyName = process.env.FAMILY_NAME || `Leo家庭${Date.now().toString().slice(-4)}`;
const outDir = path.resolve('qa/artifacts');

await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

const requests = [];
const responses = [];
page.on('request', (request) => {
  if (request.method() !== 'GET') {
    requests.push({ method: request.method(), url: request.url() });
  }
});
page.on('response', (response) => {
  if (response.request().method() !== 'GET') {
    responses.push({
      status: response.status(),
      url: response.url(),
      method: response.request().method(),
    });
  }
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

await register();
await page.getByText(/我的/i).last().click({ force: true });
await page.waitForURL(/\/profile/, { timeout: 10000 });
await page.getByText(/创建家庭/i).first().click({ force: true });
await page.waitForTimeout(500);

const visibleInputs = await page.locator('input').evaluateAll((elements) =>
  elements
    .map((el, index) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 ? index : -1;
    })
    .filter((index) => index >= 0),
);

if (!visibleInputs.length) {
  throw new Error('Family name input not found');
}

const nameInput = page.locator('input').nth(visibleInputs[visibleInputs.length - 1]);
await nameInput.click({ force: true });
await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
await page.keyboard.type(familyName);

await page.getByText(/^保存$/).first().click({ force: true });
await page.waitForTimeout(3000);
await page.waitForLoadState('networkidle').catch(() => {});

const payload = {
  email,
  familyName,
  url: page.url(),
  bodyText: (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 3000),
  requests,
  responses,
};

await page.screenshot({ path: path.join(outDir, 'create-family.png'), fullPage: true });
await fs.writeFile(path.join(outDir, 'create-family.json'), JSON.stringify(payload, null, 2));
console.log(JSON.stringify(payload, null, 2));

await browser.close();
