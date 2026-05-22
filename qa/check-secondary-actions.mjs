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
  if (request.method() !== 'GET') requests.push({ method: request.method(), url: request.url() });
});
page.on('response', (response) => {
  if (response.request().method() !== 'GET') {
    responses.push({ method: response.request().method(), url: response.url(), status: response.status() });
  }
});

async function signupAndCreateFamily() {
  await page.goto(baseURL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.getByText(/立即注册/i).first().click();
  await page.waitForURL(/\/register/, { timeout: 10000 });
  const visible = await page.locator('input').evaluateAll((els) =>
    els.map((el, i) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 ? i : -1;
    }).filter((i) => i >= 0),
  );
  for (const [idx, value] of [email, password, password].entries()) {
    const input = page.locator('input').nth(visible[visible.length - 3 + idx]);
    await input.click({ force: true });
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await page.keyboard.type(value);
  }
  await page.getByText(/^注册$/).first().click({ force: true });
  await page.waitForTimeout(2500);
  await page.getByText(/我的/i).last().click({ force: true });
  await page.waitForTimeout(600);
  await page.getByText(/创建家庭/i).first().click({ force: true });
  await page.waitForTimeout(500);
  const visibleInputs = await page.locator('input').evaluateAll((els) =>
    els.map((el, i) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 ? i : -1;
    }).filter((i) => i >= 0),
  );
  const familyInput = page.locator('input').nth(visibleInputs[visibleInputs.length - 1]);
  await familyInput.click({ force: true });
  await page.keyboard.type(familyName);
  await page.getByText(/^保存$/).first().click({ force: true });
  await page.waitForTimeout(1500);
}

async function snap(label) {
  return page.evaluate((label) => ({
    label,
    url: location.href,
    text: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 3000),
  }), label);
}

await signupAndCreateFamily();

const results = [];

await page.getByText(/家庭成员/i).first().click({ force: true });
await page.waitForTimeout(800);
results.push(await snap('family-members'));

const addMember = page.getByText(/添加成员/i);
if (await addMember.count()) {
  await addMember.first().click({ force: true });
  await page.waitForTimeout(800);
  results.push(await snap('family-members-add-member'));
}

await page.getByText(/我的/i).last().click({ force: true });
await page.waitForTimeout(500);
await page.getByText(/数据导入导出/i).first().click({ force: true });
await page.waitForTimeout(800);
results.push(await snap('import-export'));

for (const action of ['导入 Excel', '导出 Excel']) {
  const locator = page.getByText(new RegExp(action));
  if (await locator.count()) {
    await locator.first().click({ force: true });
    await page.waitForTimeout(1500);
    results.push(await snap(`import-export-${action}`));
  }
}

const payload = { results, requests, responses };
await fs.writeFile(path.join(outDir, 'check-secondary-actions.json'), JSON.stringify(payload, null, 2));
console.log(JSON.stringify(payload, null, 2));

await browser.close();
