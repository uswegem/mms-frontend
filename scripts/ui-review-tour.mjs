import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const OUT = 'C:/Users/user/AppData/Local/Temp/ui-review-screens';
const errors = [];

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log(`shot: ${name}`);
}

async function main() {
  const uniq = Date.now().toString().slice(-8);
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[console] ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`));

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await shot(page, '01-login');

  await page.fill('input[type="email"]', 'admin@mms.local');
  await page.fill('input[type="password"]', 'Admin@12345678');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 45000 });
  await page.waitForTimeout(1000);
  await shot(page, '02-dashboard');

  await page.goto(`${BASE}/merchants`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await shot(page, '03-merchants-list');

  // --- Merchant status maker-checker flow ---
  const rowMenuBtn = page.locator('button[aria-label="Row actions"]').first();
  if (await rowMenuBtn.count() > 0) {
    await rowMenuBtn.click();
    await page.waitForTimeout(200);
    await shot(page, '03a-merchant-row-actions-menu');

    const firstOption = page.locator('div.absolute button:not([disabled])').first();
    if (await firstOption.count() > 0) {
      await firstOption.click();
      await page.waitForTimeout(300);
      await shot(page, '03b-request-status-change-modal');

      await page.fill('#reason', 'UI tour smoke test request');
      await page.click('button:has-text("Submit for Approval")');
      await page.waitForTimeout(800);
      await shot(page, '03c-merchant-list-pending-state');
    }
  } else {
    console.log('no row-actions menu available (no merchant in a requestable status) — skipping');
  }

  await page.goto(`${BASE}/approvals`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await shot(page, '03d-approvals-inbox-with-merchant-task');

  await page.goto(`${BASE}/onboarding`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await shot(page, '04-onboarding-list');

  await page.goto(`${BASE}/onboarding/new`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await shot(page, '05-wizard-step0-type');

  // Step 0 -> pick merchant, go to step 1
  await page.click('button:has-text("Merchant")');
  await page.click('button:has-text("Next")');
  await page.waitForTimeout(400);
  await shot(page, '06-wizard-step1-profile');

  async function fillByLabel(labelText, value) {
    const input = page.locator('label', { hasText: labelText }).locator('xpath=..').locator('input').first();
    await input.fill(value);
    await input.blur();
  }

  // touch-but-leave-invalid check: focus+blur email with a bad value first
  await fillByLabel('Legal Name', 'UI Review Test Co');
  await fillByLabel('Trading / Display Name', 'UI Review Test');
  await fillByLabel('Contact Email', 'not-an-email');
  await page.locator('label', { hasText: 'Contact Email' }).locator('xpath=..').locator('input').first().blur();
  await shot(page, '06a-wizard-inline-validation-error');

  await fillByLabel('Postcode', '12345');
  await fillByLabel('Contact Mobile', `07${uniq}`);
  await fillByLabel('Contact Email', `test${uniq}@example.com`);
  await shot(page, '06b-wizard-step1-filled');

  await page.click('button:has-text("Next")');
  await page.waitForTimeout(600);
  await shot(page, '07-wizard-step2-settlement');

  // use the wizard's own Back button (not browser nav) to verify persistence
  await page.click('button:has-text("Back")');
  await page.waitForTimeout(400);
  await shot(page, '08-wizard-back-nav-persist-check');
  await page.click('button:has-text("Next")');
  await page.waitForTimeout(400);

  await fillByLabel('Account Number', '1234567890123');
  await fillByLabel('Account Name', 'UI Review Test Co');
  await page.click('button:has-text("Next")');
  await page.waitForTimeout(600);
  await shot(page, '07b-wizard-step2-filled');

  await page.setInputFiles('#kyc-file', 'public/letshego-faidika-logo.png');
  await page.waitForTimeout(300);
  await shot(page, '08b-wizard-step3-kyc-dropzone-filled');
  await page.click('button:has-text("Next")');
  await page.waitForTimeout(400);
  await shot(page, '08c-wizard-step4-review');

  await page.click('button:has-text("Submit Application")');
  await page.waitForTimeout(1200);
  await shot(page, '08d-wizard-confirmation');

  await page.goto(`${BASE}/roles`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await shot(page, '09-roles');

  await page.goto(`${BASE}/users`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await shot(page, '10-users');

  await page.goto(`${BASE}/approvals`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await shot(page, '11-approvals');

  // --- Second-user approval + detail-page tab verification ---
  const approveBtn = page.locator('button:has-text("Approve")').first();
  if (await approveBtn.count() > 0) {
    const checkerContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const checkerPage = await checkerContext.newPage();
    await checkerPage.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await checkerPage.fill('input[type="email"]', 'checker@mms.local');
    await checkerPage.fill('input[type="password"]', '5UZkAkMFYUSNXp6C');
    await checkerPage.click('button[type="submit"]');
    await checkerPage.waitForURL('**/dashboard', { timeout: 45000 });
    await checkerPage.goto(`${BASE}/approvals`, { waitUntil: 'networkidle' });
    await checkerPage.waitForTimeout(500);
    const checkerApproveBtn = checkerPage.locator('button:has-text("Approve")').first();
    let merchantHref = null;
    if (await checkerApproveBtn.count() > 0) {
      const viewLink = checkerPage.locator('a:has-text("View")').first();
      merchantHref = await viewLink.getAttribute('href').catch(() => null);
      await checkerApproveBtn.click();
      await checkerPage.waitForTimeout(600);
      await shot(checkerPage, '11a-checker-approved-task');
    }
    await checkerContext.close();

    if (merchantHref && merchantHref.startsWith('/merchants/')) {
      await page.goto(`${BASE}${merchantHref}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      await shot(page, '11b-merchant-detail-after-approval');
    }
  } else {
    console.log('no approvable task found — skipping second-user approval check');
  }

  await page.goto(`${BASE}/qr`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await shot(page, '12-stub-qr');

  // sidebar collapsed
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  const collapseBtn = page.locator('button:has-text("Collapse")');
  await collapseBtn.click().catch(() => {});
  await page.waitForTimeout(300);
  await shot(page, '13-sidebar-collapsed');

  await browser.close();

  console.log('---CONSOLE/PAGE ERRORS---');
  console.log(errors.length ? errors.join('\n') : 'none');
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
