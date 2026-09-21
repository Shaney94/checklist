import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { login } from '../fixtures/dashboard';
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
test('roleless account setup shows only intended invitations and preserves failed acceptance for retry', { tag: '@critical' }, async ({ page, context, request }) => {
  await login(context, request, "roleless");
  let attempts = 0;
  await page.route('**/api/property-assignments**', async route => {
    if (route.request().method() === 'GET') {
      expect(new URL(route.request().url()).searchParams.get('action')).toBe('onboarding');
      return route.fulfill({ json: { invitations: [{ id, propertyName: 'Synthetic home' }] } });
    }
    expect(route.request().postDataJSON()).toEqual({ action: 'accept', id });
    attempts++;
    if (attempts === 1) return route.fulfill({ status: 503, json: { error: 'Account setup incomplete. Your invitation has not been accepted. Try Accept invitation again, or contact support if this continues.' } });
    const tokens = await (await request.get('http://127.0.0.1:3101/tokens?role=cleaner')).json();
    await context.setExtraHTTPHeaders({ Cookie: '__Host-turnly-session=' + tokens.session + '; __Host-turnly-refresh=' + tokens.refresh });
    return route.fulfill({ json: { saved: true } });
  });
  const response = await page.goto('/app/setup');
  expect(response?.headers()['x-robots-tag']).toContain('noindex');
  await expect(page.getByRole('heading', { name: 'Account setup incomplete', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Accept invitation' })).toBeEnabled();
  await expect(page.getByRole('link', { name: 'My customers' })).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Accept invitation' }).click();
  await expect(page.getByRole('status')).toContainText('Account setup incomplete');
  await expect(page).toHaveURL(/\/app\/setup$/);
  await page.getByRole('button', { name: 'Accept invitation' }).click();
  await expect(page).toHaveURL(/\/app$/);
});
test('roleless account without invitations gets support and sign-out, never a role picker', { tag: '@critical' }, async ({ page, context, request }) => {
  await login(context, request, "roleless");
  await page.route('**/api/property-assignments?action=onboarding', r => r.fulfill({ json: { invitations: [] } }));
  await page.goto('/app/setup');
  await expect(page.getByText(/No pending invitations for your signed-in email/)).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(0);
  await page.getByRole('button', { name: 'Check setup again' }).click();
  await expect(page.getByRole('button', { name: 'Check setup again' })).toBeEnabled();
  await expect(page.getByRole('status')).toContainText('Setup checked. Your workspace role is still unconfirmed');
  await expect(page).toHaveURL(/\/app\/setup$/);
  await context.setExtraHTTPHeaders({});
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('real roleless sessions redirect to setup and deny operational APIs before persistence', { tag: '@critical' }, async ({ request }) => {
  const tokens = await (await request.get('http://127.0.0.1:3101/tokens?role=roleless')).json();
  for (const session of [tokens.session, tokens.expired]) {
    const headers = { Cookie: '__Host-turnly-session=' + session + '; __Host-turnly-refresh=' + tokens.refresh, Origin: 'http://127.0.0.1:3100' };
    const account = await (await request.get('/api/account', { headers })).json();
    expect(account.user.role).toBeNull();
    expect(account.user.authorizationState).toBe('roleless');
    const workspace = await request.get('/app', { headers, maxRedirects: 0 });
    expect(workspace.status()).toBe(303);
    expect(workspace.headers().location).toContain('/app/setup');
    for (const route of ['/api/dashboard-bootstrap', '/api/dashboard', '/api/calendar', '/api/cleaning-jobs', '/api/start-guide', '/api/completion', '/api/job-issues', '/api/property-assignments?action=guide&id=' + id, '/api/property-assignments?action=calendar&id=all']) {
      expect((await request.get(route, { headers })).status(), route).toBe(403);
    }
    const invitation = await request.post('/api/account', { headers, data: { action: 'invite', email: 'synthetic@example.test' } });
    expect(invitation.status()).toBe(403);
  }
});

test('setup recheck reads current explicit authorization and opens the Cleaner workspace', { tag: '@critical' }, async ({ page, context, request }) => {
  await login(context, request, 'roleless');
  await page.route('**/api/property-assignments?action=onboarding', r => r.fulfill({ json: { invitations: [] } }));
  await page.goto('/app/setup');
  await expect(page.getByText(/No pending invitations for your signed-in email/)).toBeVisible();
  await login(context, request, 'cleaner');
  await page.getByRole('button', { name: 'Check setup again' }).click();
  await expect(page).toHaveURL(/\/app$/);
});
