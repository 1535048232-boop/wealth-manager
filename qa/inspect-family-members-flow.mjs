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

async function setup() {
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
  await page.waitForURL((url) => !url.pathname.endsWith('/register'), { timeout: 15000 });
  await page.getByText(/我的/i).last().click({ force: true });
  await page.waitForURL(/\/profile/, { timeout: 10000 });
  await page.getByText(/创建家庭/i).first().click({ force: true });
  await page.waitForTimeout(500);
  const visInputs = await page.locator('input').evaluateAll((els) =>
    els.map((el, i) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 ? i : -1;
    }).filter((i) => i >= 0),
  );
  const familyInput = page.locator('input').nth(visInputs[visInputs.length - 1]);
  await familyInput.click({ force: true });
  await page.keyboard.type(familyName);
  await page.getByText(/^保存$/).first().click({ force: true });
  await page.waitForTimeout(1500);
}

await setup();
await page.getByText(/家庭成员/i).first().click({ force: true });
await page.waitForTimeout(1000);

const payload = await page.evaluate(() => {
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const uniq = (items) => [...new Set(items.filter(Boolean))];
  return {
    url: location.href,
    text: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 3000),
    buttons: uniq([...document.querySelectorAll('button,[role="button"]')].map((el) => text(el)).filter(Boolean)),
    inputs: [...document.querySelectorAll('input,textarea,select')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type') || '',
      placeholder: el.getAttribute('placeholder') || '',
    })),
  };
});

await page.screenshot({ path: path.join(outDir, 'inspect-family-members-flow.png'), fullPage: true });
await fs.writeFile(path.join(outDir, 'inspect-family-members-flow.json'), JSON.stringify(payload, null, 2));
console.log(JSON.stringify(payload, null, 2));

await browser.close();
