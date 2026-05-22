import { chromium } from 'playwright';

const baseURL = process.env.APP_URL || 'http://127.0.0.1:8088/';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

const snapshots = [];
const interactions = [];

async function capture(label) {
  await page.waitForLoadState('networkidle');
  const data = await page.evaluate(() => {
    const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
    const uniq = (items) => [...new Set(items.filter(Boolean))];
    return {
      url: location.href,
      title: document.title,
      text: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 3000),
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
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type') || '',
        placeholder: el.getAttribute('placeholder') || '',
      })),
    };
  });
  snapshots.push({ label, ...data });
}

async function tryClick(label, locator) {
  if (!(await locator.count())) {
    interactions.push({ label, status: 'missing' });
    return false;
  }
  try {
    await locator.first().click({ force: true, timeout: 5000 });
    interactions.push({ label, status: 'clicked' });
    return true;
  } catch (error) {
    interactions.push({ label, status: 'failed', error: String(error) });
    return false;
  }
}

await page.goto(baseURL, { waitUntil: 'networkidle', timeout: 30000 });
await capture('landing');

const registerLink = page.getByText(/立即注册/i).or(page.getByRole('link', { name: /立即注册/i }));
if (await tryClick('register', registerLink)) {
  await capture('register');
}

const forgotPassword = page.getByText(/忘记密码/i).or(page.getByRole('button', { name: /忘记密码/i }));
if (await tryClick('forgot-password', forgotPassword)) {
  await capture('forgot-password');
}

console.log(JSON.stringify({ snapshots, interactions }, null, 2));

await browser.close();
