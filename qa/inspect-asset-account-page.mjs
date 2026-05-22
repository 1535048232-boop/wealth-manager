import { chromium } from 'playwright';

const baseURL = process.env.APP_URL || 'http://127.0.0.1:8088/';
const email = process.env.TEST_EMAIL || `leo+${Date.now()}@example.com`;
const password = process.env.TEST_PASSWORD || 'Passw0rd!';
const familyName = process.env.FAMILY_NAME || `Leo家庭${Date.now().toString().slice(-4)}`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

async function registerAndCreateFamily() {
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
  await page.getByText(/我的/i).last().click({ force: true });
  await page.waitForURL(/\/profile/, { timeout: 10000 });
  await page.getByText(/创建家庭/i).first().click({ force: true });
  await page.waitForTimeout(500);
  const inputs = await page.locator('input').evaluateAll((elements) =>
    elements
      .map((el, index) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 ? index : -1;
      })
      .filter((index) => index >= 0),
  );
  const nameInput = page.locator('input').nth(inputs[inputs.length - 1]);
  await nameInput.click({ force: true });
  await page.keyboard.type(familyName);
  await page.getByText(/^保存$/).first().click({ force: true });
  await page.waitForTimeout(1500);
}

await registerAndCreateFamily();
await page.getByText(/我的资产账户/i).first().click({ force: true });
await page.waitForTimeout(1000);

const payload = await page.evaluate(() => {
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const uniq = (items) => [...new Set(items.filter(Boolean))];
  return {
    url: location.href,
    bodyText: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 3000),
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
    inputs: [...document.querySelectorAll('input,textarea,select')].map((el) => ({
      type: el.getAttribute('type') || '',
      placeholder: el.getAttribute('placeholder') || '',
    })),
  };
});

console.log(JSON.stringify(payload, null, 2));

await browser.close();
