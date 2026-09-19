import { test, expect, type Page } from '@playwright/test';

async function account(page: Page, post: (body: Record<string,string>) => { status?: number; body: object }) {
  await page.route('**/api/account**', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: route.request().url().includes('policy') ? { policy: { minLength: 8, uppercase: true, lowercase: true, number: true, nonAlphanumeric: true } } : { user: null } });
    const result = post(route.request().postDataJSON());
    return route.fulfill({ status: result.status || 200, json: result.body });
  });
}

test('signup enters verification even when code delivery fails, then resends successfully', async ({ page }) => {
  let attempts = 0;
  const actions: string[] = [];
  await account(page, body => {
    actions.push(body.action);
    if (body.action === 'register') return { status: 201, body: { accountCreated: true, verificationRequired: true } };
    if (body.action === 'send-code' && ++attempts === 1) return { status: 503, body: { error: 'Delivery temporarily unavailable.' } };
    return { body: { ok: true } };
  });
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Email address').fill('synthetic@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Synthetic-test-123!');
  await page.getByLabel('Confirm password').fill('Synthetic-test-123!');
  await page.getByRole('button', { name: 'Create account →', exact: true }).click();
  await expect(page.getByRole('heading')).toHaveText('Check your email');
  await expect(page.getByRole('status')).toContainText('Your account was created');
  await expect(page.getByLabel('Email code')).toBeFocused();
  await page.getByRole('button', { name: 'Resend code', exact: true }).click();
  await expect(page.locator('#codeSentTo')).toContainText('Code sent to synthetic@example.com');
  expect(actions).toEqual(['register', 'send-code', 'send-code']);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('duplicate signup recovers through password verification and retains safe destination', async ({ page }) => {
  await account(page, body => {
    if (body.action === 'register') return { status: 409, body: { error: 'An account with this email already exists.', nextAction: 'verify-existing' } };
    if (body.action === 'password-login') return { body: { verificationRequired: true } };
    return { body: { ok: true } };
  });
  await page.route('**/app', route => route.fulfill({ contentType: 'text/html', body: '<h1>Authenticated destination</h1>' }));
  await page.goto('/?next=https://attacker.example');
  await page.getByRole('button', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Email address').fill('synthetic@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Synthetic-test-123!');
  await page.getByLabel('Confirm password').fill('Synthetic-test-123!');
  await page.getByRole('button', { name: 'Create account →', exact: true }).click();
  await page.getByRole('button', { name: 'Log in to continue' }).click();
  await expect(page.getByLabel('Email address')).toHaveValue('synthetic@example.com');
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
  await page.getByLabel('Password', { exact: true }).fill('Existing-password-123!');
  await page.getByRole('button', { name: 'Log in →', exact: true }).click();
  await expect(page.getByRole('heading')).toHaveText('Check your email');
  await page.getByLabel('Email code').fill('123456');
  await page.getByRole('button', { name: 'Log in →', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:3100/app');
});

test('password reset preserves the code and mismatch checks', async ({ page }) => {
  const actions: string[] = [];
  await account(page, body => { actions.push(body.action); return { body: { ok: true } }; });
  await page.goto('/');
  await page.getByLabel('Email address').fill('synthetic@example.com');
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await expect(page.getByRole('heading')).toHaveText('Set your password');
  await page.getByLabel('Email code').fill('123456');
  await page.getByLabel('New password', { exact: true }).fill('New-password-123!');
  await page.getByLabel('Confirm password').fill('Different-password-123!');
  await page.getByRole('button', { name: 'Save password and log in' }).click();
  await expect(page.getByRole('status')).toHaveText('The passwords do not match.');
  expect(actions).toEqual(['send-code']);
});

test('production Next route denies anonymous dashboard access and retains privacy headers', async ({ request, page }, testInfo) => {
  const bookmark = await request.get('/index.html?join=1', { maxRedirects: 0 });
  expect(bookmark.status()).toBe(308);
  expect(bookmark.headers()['location']).toBe('/?join=1');
  expect((await request.get('/private/cleaning-content.enc')).status()).toBe(404);
  expect((await request.get('/api/dashboard-bootstrap')).status()).toBe(401);
  expect((await request.get('/calendar.js')).status()).toBe(404);
  const app = await request.get('/app', { maxRedirects: 0 });
  expect(app.status()).toBe(303);
  expect(new URL(app.headers()['location'], 'http://127.0.0.1:3100').pathname + new URL(app.headers()['location'], 'http://127.0.0.1:3100').search).toBe('/?next=%2Fapp');
  expect(app.headers()['cache-control']).toContain('no-store');
  const response = await page.goto('/');
  expect(response?.headers()['content-security-policy']).toContain("'nonce-");
  expect(response?.headers()['x-robots-tag']).toContain('noindex');
  await expect(page.getByRole('heading')).toHaveText('Welcome back');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await page.screenshot({ path: testInfo.outputPath('login.png'), fullPage: true });
});
