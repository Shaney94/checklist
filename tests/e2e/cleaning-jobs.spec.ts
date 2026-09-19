import { test, expect } from '@playwright/test';
import { login } from '../fixtures/dashboard';
const propertyId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const jobId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const code = 'a'.repeat(43);

test('Host creates and renames a property, configures tasks, then creates, assigns and unassigns work', async ({ page, context, request }, info) => {
  const tokens = await (await request.get('http://127.0.0.1:3101/tokens?role=host')).json();
  await context.setExtraHTTPHeaders({ Cookie: '__Host-turnly-session=' + tokens.session + '; __Host-turnly-refresh=' + tokens.refresh });
  let revision = 0;
  const properties: { id: string; name: string; phone: string; notes: string; regular: string[]; deep: string[]; faqs: object[]; checked: { regular: number[]; deep: number[] } }[] = [];
  let job: { id: string; propertyId: string; propertyName: string; date: string; kind: string; state: string; assigned: boolean; revision: number } | null = null;
  await page.route('**/api/dashboard', route => {
    if (route.request().method() === 'POST') {
      const b = route.request().postDataJSON(); expect(b.revision).toBe(revision++);
      if (b.action === 'property') {
        if (b.id) properties[0].name = b.name;
        else properties.push({ id: propertyId, name: b.name, phone: '', notes: '', regular: [], deep: [], faqs: [], checked: { regular: [], deep: [] } });
      } else { expect(b.action).toBe('content'); properties[0].regular = b.items; }
    }
    return route.fulfill({ json: { revision, data: { properties } } });
  });
  await page.route('**/api/cleaning-jobs', route => {
    if (route.request().method() === 'POST') {
      const b = route.request().postDataJSON();
      if (b.action === 'create') {
        expect(b.propertyId).toBe(propertyId);
        job = { id: jobId, propertyId, propertyName: properties[0].name, date: b.date, kind: b.kind, state: 'scheduled', assigned: false, revision: 0 };
      } else {
        expect(b.id).toBe(jobId); expect(b.revision).toBe(job!.revision);
        if (b.action === 'assign') expect(b.code).toBe(code);
        job!.assigned = b.action === 'assign'; job!.revision++;
      }
      return route.fulfill({ json: { saved: true } });
    }
    return route.fulfill({ json: { jobs: job ? [job] : [] } });
  });
  await page.goto('/app/host/properties');
  await page.getByLabel('New property name', { exact: true }).fill('Synthetic property');
  await page.getByRole('button', { name: 'Create property', exact: true }).click();
  await page.getByLabel('Property name', { exact: true }).fill('Renamed property');
  await page.getByRole('button', { name: 'Save property name' }).click();
  await expect(page.getByLabel('Property name', { exact: true })).toHaveValue('Renamed property');
  await page.getByRole('button', { name: 'Regular Clean List', exact: true }).click();
  await page.getByLabel('Checklist items').fill('Synthetic kitchen task\nSynthetic bathroom task');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Synthetic kitchen task', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Cleaning jobs', exact: true }).click();
  await page.getByLabel('Scheduled cleaning date').fill('2026-09-24');
  await page.getByRole('button', { name: 'Create cleaning job', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Renamed property', exact: true })).toBeVisible();
  await page.getByLabel('Private Cleaner assignment code').fill(code);
  await page.getByRole('button', { name: 'Assign Cleaner', exact: true }).click();
  await expect(page.getByText(/Cleaner assigned/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Cleaner assigned/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('host-jobs.png'), fullPage: true });
  await page.getByRole('button', { name: 'Remove assignment', exact: true }).click();
  await expect(page.getByText(/Unassigned/)).toBeVisible();
});

test('Cleaner generates a code, checks assigned tasks and reads a guide; revoked access clears content', async ({ page, context, request }, info) => {
  await login(context, request);
  let revision = 0, checked: number[] = [], revoked = false, hasCode = false, collapsed = false;
  const job = { id: jobId, propertyId, propertyName: 'Assigned property', date: '2026-09-24', kind: 'regular', state: 'scheduled', assigned: true };
  await page.route('**/api/dashboard?action=preferences', route => route.fulfill({ json: { sidebarCollapsed: collapsed } }));
  await page.route('**/api/dashboard', route => { const b = route.request().postDataJSON(); expect(b.action).toBe('preferences'); collapsed = b.sidebarCollapsed; return route.fulfill({ json: { sidebarCollapsed: collapsed } }); });
  await page.route('**/api/cleaning-jobs**', route => {
    if (route.request().method() === 'POST') {
      const b = route.request().postDataJSON();
      if (b.action === 'code') { hasCode = true; return route.fulfill({ json: { code } }); }
      expect(b.action).toBe('check'); expect(b.id).toBe(jobId); expect(b.revision).toBe(revision++); checked = b.checked ? [b.index] : [];
      return route.fulfill({ json: { saved: true } });
    }
    const id = new URL(route.request().url()).searchParams.get('id');
    if (id) { expect(id).toBe(jobId); return route.fulfill({ json: { ...job, revision, checked, tasks: ['Synthetic cleaning task'], faqs: [] } }); }
    return route.fulfill({ json: { jobs: revoked ? [] : [{ ...job, revision }], hasCode } });
  });
  await page.route('**/api/start-guide**', route => {
    expect(route.request().method()).toBe('GET'); expect(new URL(route.request().url()).searchParams.get('jobId')).toBe(jobId);
    return route.fulfill(revoked ? { status: 404, json: { error: 'Assigned Start Guide not found.' } } : { json: { revision: 1, guide: { access: 'Synthetic restricted instructions' } } });
  });
  await page.goto('/app#jobs');
  await page.getByText('Private assignment code', { exact: true }).click();
  await page.getByRole('button', { name: 'Generate assignment code', exact: true }).click();
  await expect(page.getByLabel('Your assignment code', { exact: false })).toHaveValue(code);
  await page.getByRole('button', { name: 'Open clean list', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Synthetic cleaning task' }).check();
  await expect(page.getByText('Progress saved.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Your assignment code', { exact: false })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: 'Synthetic cleaning task' })).toBeChecked();
  if (info.project.name === 'desktop') {
    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
    await page.getByRole('button', { name: 'Start Guide', exact: true }).focus();
    await expect(page.getByRole('tooltip')).toHaveText('Start Guide');
  } else await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Start Guide', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Property Start Guide' });
  await expect(dialog.getByText('Synthetic restricted instructions', { exact: true })).toBeVisible();
  await expect(dialog.locator('textarea')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('Synthetic');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('assigned-guide.png'), fullPage: true });
  revoked = true;
  await dialog.getByRole('button', { name: 'Reload guide' }).click();
  await expect(dialog.getByText('Assigned Start Guide not found.', { exact: true })).toBeVisible();
  await expect(page.getByText('Synthetic restricted instructions', { exact: true })).toHaveCount(0);
});

test('real HTTP authorization denies legacy membership, forged assignment claims and Host role escalation', async ({ request }) => {
  expect((await request.get('/api/cleaning-jobs')).status()).toBe(401);
  const tokens = await (await request.get('http://127.0.0.1:3101/tokens')).json();
  const headers = { Cookie: '__Host-turnly-session=' + tokens.session + '; __Host-turnly-refresh=' + tokens.refresh, Origin: 'https://turnli.vercel.app' };
  for (const path of ['/api/start-guide?id=' + propertyId]) expect((await request.get(path, { headers })).status()).toBe(403);
  for (const action of ['create', 'assign', 'cancel']) expect((await request.post('/api/cleaning-jobs', { headers, data: { action, id: jobId, propertyId, code, role: 'host', owner: 'foreign', revision: 0 } })).status()).toBe(403);
});


test('unassigned Cleaner stays empty, retains renewed authentication and reduced-motion reminders', async ({ page, context, request }) => {
  const tokens = await (await request.get('http://127.0.0.1:3101/tokens')).json();
  const renewed = await request.get('/app', { headers: { Cookie: '__Host-turnly-session=' + tokens.expired + '; __Host-turnly-refresh=' + tokens.refresh }, maxRedirects: 0 });
  expect(renewed.status()).toBe(200);
  expect(renewed.headersArray().filter(h => h.name.toLowerCase() === 'set-cookie')).toHaveLength(2);
  await login(context, request);
  await page.route('**/api/dashboard?*', route => route.fulfill({ json: { sidebarCollapsed: false } }));
  await page.route('**/api/cleaning-jobs', route => route.fulfill({ json: { jobs: [], hasCode: false } }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/app#jobs');
  await expect(page.getByText(/No assigned jobs/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resume reminders' })).toBeVisible();
  await page.getByRole('button', { name: 'Regular Clean List', exact: true }).click();
  await expect(page.getByText('Choose an assigned job to see its cleaning tasks and guidance.')).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add property' })).toHaveCount(0);
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Your cleaning jobs' })).toBeVisible();
});
