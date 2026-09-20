import { test, expect } from '@playwright/test';
import { login } from '../fixtures/dashboard';

test('host routes use server-assigned roles and shared account controls', { tag: '@critical' }, async ({ page, context, request }, info) => {
  const tokens = await (await request.get('http://127.0.0.1:3101/tokens?role=host')).json();
  const cookie = '__Host-turnly-session=' + tokens.session + '; __Host-turnly-refresh=' + tokens.refresh;
  await context.setExtraHTTPHeaders({ Cookie: cookie });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const denied = await request.post('/api/dashboard', {
    headers: { Cookie: cookie, Origin: 'https://turnli.vercel.app' },
    data: { action: 'check', role: 'cleaner', workspaceId: 'foreign', revision: 0 },
  });
  expect(denied.status()).toBe(403);
  await page.goto('/app');
  await expect(page).toHaveURL(/\/app\/host$/);
  await expect(page.locator('#host-title')).toHaveText('Properties');
  await expect(page.locator('#cleaningCalendar')).toHaveCount(0);
  for (const label of ['Reservations', 'Cleaning jobs', 'Cleaning setup', 'Account & settings']) {
    await page.getByRole('link', { name: label, exact: true }).click();
    await expect(page.locator('#host-title')).toHaveText(label);
    await expect(page.getByRole('link', { name: label, exact: true })).toHaveAttribute('aria-current', 'page');
  }
  await page.getByRole('button', { name: /Signed in as/ }).click();
  await expect(page.getByRole('heading', { name: 'Your account' })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('host-workspace.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('cleaners, anonymous users and unsupported roles cannot request host pages', { tag: '@critical' }, async ({ context, request }) => {
  const anonymous = await request.get('/app/host/properties', { maxRedirects: 0 });
  expect(anonymous.status()).toBe(303);
  expect(anonymous.headers().location).toContain('next=%2Fapp%2Fhost%2Fproperties');
  await login(context, request);
  const cleaner = await (await request.get('http://127.0.0.1:3101/tokens')).json();
  const cleanerCookie = '__Host-turnly-session=' + cleaner.session + '; __Host-turnly-refresh=' + cleaner.refresh;
  const denied = await request.get('/app/host/properties?role=host&workspaceId=other', { headers: { Cookie: cleanerCookie } });
  expect(denied.status()).toBe(403);
  expect(await denied.text()).toContain('do not have access');
  const unsupported = await (await request.get('http://127.0.0.1:3101/tokens?role=unsupported')).json();
  const headers = { Cookie: '__Host-turnly-session=' + unsupported.session + '; __Host-turnly-refresh=' + unsupported.refresh };
  for (const route of ['/app', '/app/host', '/api/dashboard-bootstrap', '/api/dashboard', '/api/calendar']) {
    expect((await request.get(route, { headers, maxRedirects: 0 })).status()).toBe(403);
  }
});

import { loginDestination } from '../../src/features/auth/client';
test('shared login keeps supported host destinations and rejects unsafe destinations', () => {
  expect(loginDestination('?next=%2Fapp%2Fhost%2Fcleaning-setup', '')).toBe('/app/host/cleaning-setup');
  expect(loginDestination('?next=https://attacker.example', '')).toBe('/app');
  expect(loginDestination('?next=%2Fapp%2Fhost%2Fpayments', '')).toBe('/app');
  expect(loginDestination('', '#regular')).toBe('/app#regular');
  expect(loginDestination('?next=%2Fquote', '')).toBe('/quote');
  expect(loginDestination('?next=%2Fquote', '#regular')).toBe('/app#regular');
  for (const value of ['/quote?next=https://attacker.example', '//attacker.example/quote', '/quote/other']) expect(loginDestination('?next=' + encodeURIComponent(value), '')).toBe('/app');
});
