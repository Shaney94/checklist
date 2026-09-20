import { test, expect } from '@playwright/test';
import { fixtures, login } from '../fixtures/dashboard';
import { guideFields } from '../../src/features/start-guide/fields';

test('Host creates property guides, retains edits on conflict and isolates each property', async ({ page, context, request }, info) => {
  const tokens = await (await request.get('http://127.0.0.1:3101/tokens?role=host')).json();
  await context.setExtraHTTPHeaders({ Cookie: '__Host-turnly-session=' + tokens.session + '; __Host-turnly-refresh=' + tokens.refresh });
  let revision = 0;
  const properties: object[] = [];
  const guides: Record<string, { revision: number; guide: Record<string, string> }> = {};
  let failure = 0;
  await page.route('**/api/dashboard', (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      expect(body.action).toBe('property');
      expect(body.revision).toBe(revision++);
      expect(body.guide).toBeUndefined();
      properties.push({ id: 'property-' + (properties.length + 1), name: body.name, phone: '', notes: '', regular: [], deep: [], faqs: [], checked: { regular: [], deep: [] } });
    }
    return route.fulfill({ json: { revision, data: { properties } } });
  });
  await page.route('**/api/start-guide**', (route) => {
    if (route.request().method() === 'POST') {
      if (failure) return route.fulfill({ status: failure, json: { error: failure === 409 ? 'This guide changed. Reload before saving again.' : 'Access denied.' } });
      const body = route.request().postDataJSON();
      expect(body.revision).toBe(guides[body.id]?.revision || 0);
      guides[body.id] = { revision: body.revision + 1, guide: body.guide };
      return route.fulfill({ json: guides[body.id] });
    }
    const id = new URL(route.request().url()).searchParams.get('id')!;
    return route.fulfill({ json: guides[id] || { revision: 0, guide: {} } });
  });
  await page.goto('/app/host/cleaning-setup');
  await page.getByText('Add a property', { exact: true }).click();
  await page.getByLabel('Property label', { exact: true }).fill('Guide test property');
  await page.getByRole('button', { name: 'Create property' }).click();
  for (const [key, label] of Object.entries(guideFields)) await page.getByLabel(label, { exact: true }).fill('Synthetic ' + key + ' instructions');
  await page.getByRole('button', { name: 'Save Start Guide' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Start Guide saved.' })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Access instructions', { exact: true })).toHaveValue('Synthetic access instructions');
  await page.getByText('Add a property', { exact: true }).click();
  await page.getByLabel('Property label', { exact: true }).fill('Second guide property');
  await page.getByRole('button', { name: 'Create property' }).click();
  await expect(page.getByLabel('Access instructions', { exact: true })).toHaveValue('');
  await page.getByRole('combobox', { name: 'Property', exact: true }).selectOption('property-1');
  await expect(page.getByLabel('Access instructions', { exact: true })).toHaveValue('Synthetic access instructions');
  failure = 409;
  await page.getByLabel('Lock-up procedure', { exact: true }).fill('Synthetic revised procedure');
  await page.getByRole('button', { name: 'Save Start Guide' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'This guide changed.' })).toBeVisible();
  await expect(page.getByLabel('Lock-up procedure', { exact: true })).toHaveValue('Synthetic revised procedure');
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('Synthetic');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('start-guide-editor.png'), fullPage: true });
  failure = 403;
  await page.getByRole('button', { name: 'Save Start Guide' }).click();
  await expect(page.getByText('Access denied.', { exact: true })).toBeVisible();
  await expect(page.locator('.start-guide textarea')).toHaveCount(0);
});

test('Cleaner guide entry exposes no content and real API denies forged property/job claims', async ({ page, context, request }, info) => {
  expect((await request.get('/api/start-guide?id=property-1')).status()).toBe(401);
  await login(context, request);
  await fixtures(page);
  await page.route('**/api/cleaning-jobs', route => route.fulfill({ json: { jobs: [], hasCode: false } }));
  let guideRequests = 0;
  page.on('request', (r) => { if (r.url().includes('/api/start-guide')) guideRequests++; });
  await page.goto('/app#jobs');
  if (info.project.name === 'mobile') await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Start Guide', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Property Start Guide' })).toContainText('Choose a verified assigned job');
  expect(guideRequests).toBe(0);
  const tokens = await (await request.get('http://127.0.0.1:3101/tokens')).json();
  const headers = { Cookie: '__Host-turnly-session=' + tokens.session + '; __Host-turnly-refresh=' + tokens.refresh, Origin: 'https://turnli.vercel.app' };
  const read = await request.get('/api/start-guide?id=property-1&jobId=forged&role=host', { headers });
  expect(read.status()).toBe(403);
  expect(read.headers()['cache-control']).toContain('no-store');
  const write = await request.post('/api/start-guide', { headers, data: { id: 'property-1', role: 'host', jobId: 'forged', revision: 0, guide: {} } });
  expect(write.status()).toBe(403);
});
