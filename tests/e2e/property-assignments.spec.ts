import { test, expect } from '@playwright/test';
import { login } from '../fixtures/dashboard';
const propertyId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', assignmentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', jobId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

test('Host invites a property Cleaner, adjusts task applicability and revokes access', { tag: '@critical' }, async ({ page, context, request }, info) => {
  const tokens = await (await request.get('http://127.0.0.1:3101/tokens?role=host')).json();
  await context.setExtraHTTPHeaders({ Cookie: '__Host-turnly-session=' + tokens.session + '; __Host-turnly-refresh=' + tokens.refresh });
  let invited = false, revision = 0, excluded: number[] = [];
  const property = () => ({ id: propertyId, name: 'Synthetic home', phone: '', notes: '', regular: ['Clean kitchen', 'Clean oven'], deep: ['Deep clean'], checked: { regular: [], deep: [] }, notApplicable: { regular: excluded, deep: [] }, faqs: [] });
  await page.route('**/api/dashboard', r => { if (r.request().method() === 'POST') { const b = r.request().postDataJSON(); expect(b.action).toBe('applicability'); expect(b.revision).toBe(revision++); excluded = b.applicable ? [] : [b.index]; } return r.fulfill({ json: { revision, data: { properties: [property()] } } }); });
  await page.route('**/api/property-assignments**', r => {
    if (r.request().method() === 'POST') { const b = r.request().postDataJSON(); if (b.action === 'invite') { expect(b.email).toBe('synthetic-cleaner@example.test'); expect(b.propertyId).toBe(propertyId); expect(b.password).toBeUndefined(); invited = true; } else { expect(b.action).toBe('revoke'); expect(b.id).toBe(assignmentId); invited = false; } return r.fulfill({ json: { sent: true } }); }
    return r.fulfill({ json: { assignments: invited ? [{ id: assignmentId, email: 'synthetic-cleaner@example.test', state: 'pending', delivery: 'sent', expiresAt: '2099-01-01' }] : [] } });
  });
  await page.goto('/app/host/properties');
  await page.getByLabel('Cleaner email', { exact: true }).fill('synthetic-cleaner@example.test');
  await page.getByRole('button', { name: 'Invite Cleaner', exact: true }).click();
  await expect(page.getByText(/synthetic-cleaner@example.test · Awaiting acceptance/)).toBeVisible();
  await page.getByRole('button', { name: 'Regular Clean List', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Applicable: Clean oven', exact: true }).uncheck();
  await expect(page.getByText('Clean oven — Not applicable', { exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Applicable: Clean oven', exact: true })).toBeEnabled();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Revoke assignment' })).toBeVisible();
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: 'Revoke assignment' }).click();
  await expect(page.getByRole('button', { name: 'Invite Cleaner', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('host-property-invitation.png'), fullPage: true });
});

test('Cleaner accepts property invitation and receives calendar, job checklist and guide without adding a feed', { tag: '@critical' }, async ({ page, context, request }, info) => {
  await login(context, request);
  let state = 'pending', checked: number[] = [], revision = 0;
  const job = () => ({ id: jobId, propertyId, propertyName: 'Host home', date: '2026-09-21', kind: 'regular', state: 'scheduled', assigned: true, revision, tasks: ['Clean kitchen'], checked, faqs: [] });
  await page.route('**/api/dashboard?*', r => r.fulfill({ json: { sidebarCollapsed: false } }));
  await page.route('**/api/dashboard', r => r.fulfill({ json: { revision: 0, data: { properties: [] } } }));
  await page.route('**/api/calendar?*', r => r.fulfill({ json: { state: 'not-connected', calendars: [], bookings: [] } }));
  await page.route('**/api/cleaning-jobs**', r => {
    if(new URL(r.request().url()).searchParams.get('action')==='properties')return r.fulfill({json:{properties:state==='active'?[{id:propertyId,name:'Host home',source:'assigned',regular:['Clean kitchen'],deep:[],assignmentId}]:[]}});
    if (r.request().method() === 'POST') { const b = r.request().postDataJSON(); if(b.action==='code')return r.fulfill({json:{code:'a'.repeat(43),legacy:false}}); expect(b.action).toBe('check'); expect(b.revision).toBe(revision++); checked = [0]; return r.fulfill({ json: { saved: true } }); }
    return r.fulfill({ json: new URL(r.request().url()).searchParams.has('id') ? job() : { jobs: state === 'active' ? [job()] : [], hasCode: false } });
  });
  await page.route('**/api/property-assignments**', r => {
    const q = new URL(r.request().url()).searchParams;
    if (r.request().method() === 'POST') { const b = r.request().postDataJSON(); expect(b.action).toBe('accept'); expect(b.id).toBe(assignmentId); state = 'active'; return r.fulfill({ json: { saved: true } }); }
    if (q.has('action')) {
      expect(q.get('id')).toBe(q.get('action')==='calendar'?'all':assignmentId);
      if (state !== 'active') return r.fulfill({ status: 404, json: { error: 'Property access is no longer available.' } });
      if (q.get('action') === 'guide') return r.fulfill({ json: { revision: 1, guide: { access: 'Synthetic private instructions' } } });
      const month = q.get('month')!;
      return r.fulfill({ json: { state: 'ready', calendars: [], hasCalendar: true, timeZone: 'Europe/London', bookings: [{ id: 'opaque', propertyId, property: 'Host home', source: 'Airbnb', sourceKey: 'airbnb', guests: 2, arrival: { date: month + '-10', time: '15:00' }, checkout: { date: month + '-13', time: '10:00' } }] } });
    }
    return r.fulfill({ json: { assignments: state === 'revoked' ? [] : [{ id: assignmentId, propertyId, propertyName: 'Host home', state }] } });
  });
  await page.goto('/app');
  await expect(page.getByText('Invitation to clean:', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Accept invitation', exact: true }).click();
  await expect(page.locator('.stay-bar').first()).toBeVisible();
  await page.getByRole('button', { name: 'Hide this assigned property' }).click();
  await expect(page.locator('.stay-bar')).toHaveCount(0);
  await page.getByRole('button', { name: 'Show hidden assigned properties' }).click();
  await expect(page.locator('.stay-bar').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Manage calendars', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Copy iCal Link', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Read property Start Guide' }).click();
  await expect(page.getByText('Synthetic private instructions')).toBeVisible();
  await expect(page.getByRole('dialog').locator('textarea')).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();

  await page.goto('/app#jobs');
  await page.getByRole('checkbox', { name: 'Clean kitchen', exact: true }).check();
  await expect(page.getByRole('button', { name: 'Complete clean', exact: true })).toBeEnabled();
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Clean kitchen', exact: true })).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('assigned-cleaner-workspace.png'), fullPage: true });
  await page.goto('/app');
  await expect(page.locator('.stay-bar').first()).toBeVisible();
  state = 'revoked'; await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('.stay-bar')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Read property Start Guide' })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('Synthetic private');
});

test('new Cleaner sees helpful first use and safe network errors', async ({ page, context, request }) => {
  await login(context, request);
  await page.route('**/api/property-assignments**', r => r.fulfill({ json: { assignments: [] } }));
  await page.route('**/api/cleaning-jobs**', r => r.fulfill({ json: { jobs: [], hasCode: false } }));
  await page.route('**/api/dashboard?*', r => r.fulfill({ json: { sidebarCollapsed: false } }));
  await page.route('**/api/calendar?*', r => r.abort('failed'));
  await page.goto('/app');
  await expect(page.getByText(/No assigned properties yet\./)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Turnli Cleaning Calendar',exact:true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Cleaning calendar' })).toContainText('Check your connection');
  await expect(page.locator('body')).not.toContainText('Failed to fetch');
});

test('secure invitation link is verified through the existing account endpoint before entering workspace', { tag: '@critical' }, async ({ page }) => {
  let verified = false;
  await page.route('**/api/account**', r => {
    if (r.request().method() === 'POST') { expect(r.request().postDataJSON()).toEqual({ action: 'invite-login', token: 'synthetic-link' }); verified = true; return r.fulfill({ json: { user: { role: 'cleaner' } } }); }
    return r.fulfill({ json: { user: null } });
  });
  await page.route('**/app', r => r.fulfill({ contentType: 'text/html', body: '<h1>Synthetic signed-in destination</h1>' }));
  await page.goto('/?join=1&t=synthetic-link');
  await expect(page).not.toHaveURL(/synthetic-link/);
  await page.getByRole('button', { name: 'Continue with secure email link' }).click();
  await expect(page.getByRole('heading', { name: 'Synthetic signed-in destination' })).toBeVisible();
  expect(verified).toBe(true);
});

test('real invitation API rejects anonymous and forged role requests before any delivery', { tag: '@critical' }, async ({ request }) => {
  expect((await request.get('/api/property-assignments')).status()).toBe(401);
  for (const [role, action] of [['cleaner', 'invite'], ['host', 'accept']]) {
    const tokens = await (await request.get('http://127.0.0.1:3101/tokens?role=' + role)).json();
    const headers = { Cookie: '__Host-turnly-session=' + tokens.session + '; __Host-turnly-refresh=' + tokens.refresh, Origin: 'https://turnli.io' };
    expect((await request.post('/api/property-assignments', { headers, data: { action, id: assignmentId, propertyId, email: 'never-send@example.test', role: 'host' } })).status()).toBe(403);
  }
});

test('Host adopts restored templates, including an empty list, and sees persisted applicability', async ({ page, context, request }) => {
  await login(context, request, 'host');
  const { change } = require('../../src/server/handlers/dashboard.js');
  const { templates } = require('../../lib/checklist-templates.cjs');
  let data = { properties: [{ id: propertyId, name: 'Synthetic adoption', phone: '', notes: '', regular: [templates.regular[7]], deep: [], checked: { regular: [], deep: [] }, notApplicable: { regular: [0], deep: [] }, faqs: [] }] }, revision = 0;
  await page.route('**/api/dashboard', r => { if (r.request().method() === 'POST') { const b = r.request().postDataJSON(); expect(b.revision).toBe(revision++); expect(b.action).toBe('template'); data = change(data, b); } return r.fulfill({ json: { revision, data } }); });
  await page.route('**/api/property-assignments**', r => r.fulfill({ json: { assignments: [] } }));
  await page.goto('/app/host/properties');
  await page.getByRole('button', { name: 'Regular Clean List', exact: true }).click();
  await expect(page.getByText('Custom / earlier Regular template · 1 tasks · 1 not applicable', { exact: true })).toBeVisible();
  page.once('dialog', d => d.accept());await page.getByRole('button', { name: 'Use standard template', exact: true }).click();
  await expect(page.getByText('Standard Regular template · 38 tasks · 1 not applicable', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Use standard template', exact: true })).toHaveCount(0);
  await expect(page.getByText(/Choose a list and Use standard template to adopt/)).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: 'Applicable: ' + templates.regular[7], exact: true })).not.toBeChecked();
  await page.reload();await page.getByRole('button', { name: 'Regular Clean List', exact: true }).click();
  await expect(page.getByText('Standard Regular template · 38 tasks · 1 not applicable', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Use standard template', exact: true })).toHaveCount(0);
  await expect(page.getByText(/Choose a list and Use standard template to adopt/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Deep Clean List', exact: true }).click();
  page.once('dialog', d => d.accept());await page.getByRole('button', { name: 'Use standard template', exact: true }).click();
  await expect(page.getByText('Standard Deep template · 109 tasks · 0 not applicable', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Host creates a property with standard lists automatically and no adoption prompt', async ({ page, context, request }) => {
  await login(context, request, 'host');
  const { change } = require('../../src/server/handlers/dashboard.js');
  let data = { properties: [] }, revision = 0;
  await page.route('**/api/dashboard', r => { if (r.request().method() === 'POST') { const b = r.request().postDataJSON(); expect(b.action).toBe('property'); expect(b.revision).toBe(revision++); data = change(data, b); } return r.fulfill({ json: { revision, data } }); });
  await page.route('**/api/property-assignments**', r => r.fulfill({ json: { assignments: [] } }));
  await page.goto('/app/host/properties');await page.getByLabel('New property label', { exact: true }).fill('Synthetic standard property');await page.getByRole('button', { name: 'Create property', exact: true }).click();
  for (const [kind, count] of [['Regular', 38], ['Deep', 109]]) {
    await page.getByRole('button', { name: kind + ' Clean List', exact: true }).click();
    await expect(page.getByText(`Standard ${kind} template · ${count} tasks · 0 not applicable`, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Use standard template', exact: true })).toHaveCount(0);
  }
  await page.reload();await page.getByRole('button', { name: 'Regular Clean List', exact: true }).click();
  await expect(page.getByText('Standard Regular template · 38 tasks · 0 not applicable', { exact: true })).toBeVisible();
});
