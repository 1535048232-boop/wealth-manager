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

const before = await page.locator('body').innerText();

const editControl = page.getByText(/^编辑$/).or(page.getByRole('button', { name: /^编辑$/ }));
let editClicked = false;
if (await editControl.count()) {
  await editControl.first().click({ force: true });
  editClicked = true;
  await page.waitForTimeout(1000);
  await page.waitForLoadState('networkidle').catch(() => {});
}

const after = await page.locator('body').innerText();
const fileInputs = await page.locator('input[type="file"]').count();

const payload = {
  email,
  password,
  editClicked,
  url: page.url(),
  fileInputs,
  before: before.replace(/\s+/g, ' ').slice(0, 3000),
  after: after.replace(/\s+/g, ' ').slice(0, 3000),
};

await page.screenshot({ path: path.join(outDir, 'profile-avatar-flow.png'), fullPage: true });
await fs.writeFile(path.join(outDir, 'profile-avatar-flow.json'), JSON.stringify(payload, null, 2));

console.log(JSON.stringify(payload, null, 2));

await browser.close();
