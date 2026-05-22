import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.APP_URL || 'http://127.0.0.1:8088/';
const email = process.env.TEST_EMAIL || `leo+${Date.now()}@example.com`;
const password = process.env.TEST_PASSWORD || 'Passw0rd!';
const outDir = path.resolve('qa/artifacts');
const uploadFile = path.resolve('qa/artifacts/homepage.png');

await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

const requests = [];
const responses = [];
const pageErrors = [];
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

await register();
await page.getByText(/我的/i).last().click({ force: true });
await page.waitForURL(/\/profile/, { timeout: 10000 });
await page.getByText(/^编辑$/).first().click({ force: true });
await page.waitForTimeout(1000);

const chooserPromise = page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null);
await page.getByText(/上传头像/i).last().click({ force: true });
const chooser = await chooserPromise;

let chooserOpened = Boolean(chooser);
if (chooser) {
  await chooser.setFiles(uploadFile);
} else {
  const fileInput = page.locator('input[type="file"]');
  if (await fileInput.count()) {
    chooserOpened = true;
    await fileInput.first().setInputFiles(uploadFile);
  }
}

await page.waitForTimeout(2000);
const finish = page.getByText(/^完成$/).or(page.getByRole('button', { name: /^完成$/ }));
if (await finish.count()) {
  await finish.first().click({ force: true });
  await page.waitForTimeout(3000);
  await page.waitForLoadState('networkidle').catch(() => {});
}

const payload = {
  email,
  chooserOpened,
  url: page.url(),
  bodyText: (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 3000),
  requests,
  responses,
  pageErrors,
};

await page.screenshot({ path: path.join(outDir, 'avatar-upload-web.png'), fullPage: true });
await fs.writeFile(path.join(outDir, 'avatar-upload-web.json'), JSON.stringify(payload, null, 2));

console.log(JSON.stringify(payload, null, 2));

await browser.close();
