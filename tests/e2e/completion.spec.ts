import { test, expect } from '@playwright/test';
import { login } from '../fixtures/dashboard';
const jobId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const propertyId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZkAAAAASUVORK5CYII=', 'base64');

test('Cleaner opens next turnover, reads guide, reports an issue and submits locked completion', { tag: '@critical' }, async ({ page, context, request }, info) => {
  await login(context, request);
  let state = 'scheduled', revision = 1, checked: number[] = [], photos: { id: string; width: number; height: number; size: number }[] = [];
  const job = () => ({ id: jobId, propertyId, propertyName: 'Synthetic property', date: '2026-09-19', kind: 'regular', state, revision, assigned: true, automatic: true, plannedAfter: '10:00:00', hostPhone: '+447700900123', tasks: ['Synthetic cleaning task'], checked, faqs: [] });
  await page.route('**/api/dashboard?*', r => r.fulfill({ json: { sidebarCollapsed: false } }));
  await page.route('**/api/cleaning-jobs**', r => {
    if(new URL(r.request().url()).searchParams.get('action')==='properties')return r.fulfill({json:{properties:[{id:propertyId,name:'Synthetic property',source:'assigned',regular:['Synthetic cleaning task'],deep:[],jobId}]}});
    if (r.request().method() === 'POST') { const b = r.request().postDataJSON(); if(b.action==='code')return r.fulfill({json:{code:'a'.repeat(43),legacy:false}}); expect(b.action).toBe('check'); expect(b.revision).toBe(revision++); checked = b.checked ? [0] : []; return r.fulfill({ json: { saved: true } }); }
    return r.fulfill({ json: new URL(r.request().url()).searchParams.has('id') ? job() : { jobs: [job()], hasCode: false } });
  });
  await page.route('**/api/completion**', r => {
    const url = new URL(r.request().url());
    if (url.searchParams.has('photoId')) return r.fulfill({ contentType: 'image/png', body: pixel });
    if (r.request().method() === 'POST') {
      const b = r.request().postDataJSON(); expect(b.jobId).toBe(jobId); expect(b.revision).toBe(revision++); expect(state).toBe('scheduled');
      if (b.action === 'upload') { expect(b.type).toBe('image/png'); expect(b.data).toBeTruthy(); expect(b.storageKey).toBeUndefined(); photos.push({ id: `cccccccc-cccc-4ccc-8ccc-${String(photos.length).padStart(12, '0')}`, width: 1, height: 1, size: pixel.length }); }
      else if (b.action === 'submit') { expect(photos).toHaveLength(3); expect(checked).toEqual([0]); state = 'awaiting_review'; }
      else throw Error('Unexpected completion action');
      return r.fulfill({ json: { revision, state } });
    }
    return r.fulfill({ json: { ...job(), photos, submittedAt: state === 'scheduled' ? null : '2026-09-19T12:00:00Z', reviewedAt: null, reviewNote: null, requirements: { minPhotos: 3, maxPhotos: 6, maxUploadBytes: 3145728 } } });
  });
  await page.route('**/api/property-assignments**', r => r.fulfill({ json: { assignments: [] } }));
  let reported = false;
  await page.route('**/api/start-guide**', r => r.fulfill({ json: { revision: 1, guide: { equipment: 'Synthetic equipment instructions' } } }));
  await page.route('**/api/job-issues**', r => {
    if (new URL(r.request().url()).searchParams.has('photoId')) return r.fulfill({ contentType: 'image/png', body: pixel });
    if (r.request().method() === 'POST') {
      const b = r.request().postDataJSON(); expect(b.jobId).toBe(jobId); expect(b.revision).toBe(revision++);
      expect(b.category).toBe('maintenance'); expect(b.description).toBe('Synthetic broken appliance'); expect(b.photo.type).toBe('image/png'); expect(b.photo.data).toBeTruthy(); expect(b.storageKey).toBeUndefined(); reported = true;
      return r.fulfill({ status: 201, json: { id: propertyId } });
    }
    return r.fulfill({ json: { id: jobId, state, revision, issues: reported ? [{ id: propertyId, category: 'maintenance', description: 'Synthetic broken appliance', createdAt: '2026-09-19T10:00:00Z', hasPhoto: true }] : [] } });
  });
  await page.route('**/api/calendars**', r => r.fulfill({ json: { calendars: [] } }));
  await page.route('**/api/calendar**', r => r.fulfill({ json: { bookings: [], calendars: [], connected: false } }));
  await page.goto('/app');
  await expect(page.getByRole('region', { name: 'Next clean', exact: true })).toContainText('Planned after 10:00');
  await expect(page.getByRole('region', { name: 'Next clean', exact: true })).toContainText('Confirm the property is ready');
  await page.getByRole('button', { name: 'Open next clean', exact: true }).click();
  await page.getByRole('button', { name: 'Open Start Guide', exact: true }).click();
  const guide = page.getByRole('dialog', { name: 'Property Start Guide' });
  await expect(guide.getByText('Synthetic equipment instructions')).toBeVisible();
  await expect(guide.locator('textarea')).toHaveCount(0);
  await guide.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Report an issue', exact: true }).click();
  const issue = page.getByRole('dialog', { name: 'Clean issues' });
  await issue.getByLabel('Issue category').selectOption('maintenance');
  await issue.getByLabel('Short description').fill('Synthetic broken appliance');
  const field = await issue.getByLabel('Short description').boundingBox(), form = await issue.locator('form').boundingBox();
  expect(field!.width).toBeGreaterThan(form!.width * 0.9);
  expect(field!.height).toBeGreaterThanOrEqual(110);
  await issue.getByLabel('Optional issue photo').setInputFiles({ name: 'issue.png', mimeType: 'image/png', buffer: pixel });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(issue.getByLabel('Short description')).toHaveValue('Synthetic broken appliance');
  await issue.getByRole('button', { name: 'Save issue', exact: true }).click();
  await expect(issue.getByText('Synthetic broken appliance', { exact: true })).toBeVisible();
  await expect(issue.getByRole('img')).toHaveCount(1);
  expect(photos).toHaveLength(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('cleaner-issue.png'), fullPage: true });
  await issue.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Complete clean', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Can’t make this clean', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('This does not cancel the job.');
  await expect(page.locator('a[href*="wa.me"]')).toHaveCount(0);
  await expect(page.getByRole('dialog')).not.toContainText('+447700900123');
  await expect(page.getByRole('dialog')).toContainText('This does not cancel the job.');
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Synthetic cleaning task' }).check();
  await page.getByRole('button', { name: 'Complete clean', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Clean completion' });
  const review = dialog.getByRole('button', { name: 'Review checklist and evidence' });
  await expect(review).toBeDisabled();
  await dialog.getByLabel('Upload completion photos').setInputFiles([{ name: 'one.png', mimeType: 'image/png', buffer: pixel }, { name: 'two.png', mimeType: 'image/png', buffer: pixel }]);
  await expect(dialog.getByRole('img')).toHaveCount(2);
  await expect(review).toBeDisabled();
  await dialog.getByLabel('Upload completion photos').setInputFiles({ name: 'three.png', mimeType: 'image/png', buffer: pixel });
  await expect(review).toBeEnabled();
  await review.click();
  await expect(dialog.getByText(/Your checklist and evidence will then be locked/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Submit completion', exact: true }).click();
  await expect(dialog.getByText('Completed · Awaiting Host review', { exact: true })).toBeVisible();
  await expect(dialog.locator('input[type=file]')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: /Remove photo/ })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('Synthetic');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('submitted-completion.png'), fullPage: true });
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Synthetic cleaning task' })).toBeDisabled();
  await page.getByRole('button', { name: 'View completion', exact: true }).click();
  await expect(dialog.getByRole('img')).toHaveCount(3);
});

for (const decision of ['approve', 'issue'] as const) test(`Host can ${decision} pending completion while preserving submitted evidence`, { tag: '@critical' }, async ({ page, context, request }, info) => {
  const tokens = await (await request.get('http://127.0.0.1:3101/tokens?role=host')).json();
  await context.setExtraHTTPHeaders({ Cookie: '__Host-turnly-session=' + tokens.session + '; __Host-turnly-refresh=' + tokens.refresh });
  let state = 'awaiting_review', revision = 5, reviewNote: string | null = null;
  const job = () => ({ id: jobId, propertyId, propertyName: 'Submitted property', date: '2026-09-19', kind: 'regular', state, revision, assigned: true, issueCount: 1 });
  await page.route('**/api/dashboard', r => r.fulfill({ json: { revision: 0, data: { properties: [] } } }));
  await page.route('**/api/cleaning-jobs', r => r.fulfill({ json: { jobs: [job()] } }));
  await page.route('**/api/completion**', r => {
    if (new URL(r.request().url()).searchParams.has('photoId')) return r.fulfill({ contentType: 'image/png', body: pixel });
    if (r.request().method() === 'POST') {
      const b = r.request().postDataJSON(); expect(b.action).toBe(decision); expect(b.revision).toBe(revision++); expect(state).toBe('awaiting_review');
      state = decision === 'approve' ? 'approved' : 'issue_reported'; reviewNote = b.note || null;
      return r.fulfill({ json: { state, revision } });
    }
    return r.fulfill({ json: { ...job(), tasks: ['Submitted task'], checked: [0], photos: [0, 1, 2].map(i => ({ id: `cccccccc-cccc-4ccc-8ccc-${String(i).padStart(12, '0')}`, width: 1, height: 1, size: pixel.length })), submittedAt: '2026-09-19T12:00:00Z', reviewedAt: state === 'awaiting_review' ? null : '2026-09-19T13:00:00Z', reviewNote, requirements: { minPhotos: 3, maxPhotos: 6, maxUploadBytes: 3145728 } } });
  });
  await page.route('**/api/property-assignments**', r => r.fulfill({ json: { assignments: [] } }));
  await page.route('**/api/job-issues**', r => {
    expect(r.request().method()).toBe('GET');
    if (new URL(r.request().url()).searchParams.has('photoId')) return r.fulfill({ contentType: 'image/png', body: pixel });
    return r.fulfill({ json: { id: jobId, state, revision, issues: [{ id: propertyId, category: 'maintenance', description: 'Synthetic Cleaner report', createdAt: '2026-09-19T10:00:00Z', hasPhoto: true }] } });
  });
  await page.goto('/app/host/cleaning-jobs');
  await page.getByRole('button', { name: 'View reported issues (1)' }).click();
  const issues = page.getByRole('dialog', { name: 'Clean issues' });
  await expect(issues.getByText('Synthetic Cleaner report')).toBeVisible();
  await expect(issues.getByRole('img')).toHaveCount(1);
  await expect(issues.getByLabel('Short description')).toHaveCount(0);
  await issues.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'View completion' }).click();
  const dialog = page.getByRole('dialog', { name: 'Clean completion' });
  await expect(dialog.getByRole('img')).toHaveCount(3);
  await expect(dialog.getByText('✓ Submitted task', { exact: true })).toBeVisible();
  await expect(dialog.locator('input[type=file]')).toHaveCount(0);
  if (decision === 'issue') { await expect(dialog.getByRole('button', { name: 'Report issue' })).toBeDisabled(); await dialog.getByLabel('Issue details').fill('Synthetic issue for follow-up'); }
  await dialog.getByRole('button', { name: decision === 'approve' ? 'Approve clean' : 'Report issue', exact: true }).click();
  await expect(page.getByText(decision === 'approve' ? /Clean approved/ : /Issue reported · Evidence locked/)).toBeVisible();
  await page.getByRole('button', { name: 'View completion' }).click();
  await expect(dialog.getByRole('img')).toHaveCount(3);
  await expect(dialog.getByRole('button', { name: 'Approve clean' })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Report issue' })).toHaveCount(0);
  if (decision === 'issue') await expect(dialog.getByText(/Synthetic issue for follow-up/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('host-review.png'), fullPage: true });
});

test('real completion endpoint denies anonymous photo reads and role escalation', { tag: '@critical' }, async ({ request }) => {
  expect((await request.get('/api/completion?jobId=' + jobId + '&photoId=' + propertyId)).status()).toBe(401);
  expect((await request.get('/api/job-issues?jobId=' + jobId + '&photoId=' + propertyId)).status()).toBe(401);
  for (const [role, action] of [['cleaner', 'approve'], ['host', 'upload']]) {
    const tokens = await (await request.get('http://127.0.0.1:3101/tokens?role=' + role)).json();
    const headers = { Cookie: '__Host-turnly-session=' + tokens.session + '; __Host-turnly-refresh=' + tokens.refresh, Origin: 'https://turnli.vercel.app' };
    if (role === 'host') expect((await request.post('/api/job-issues', { headers, data: { jobId, id: propertyId, revision: 0, category: 'damage', description: 'Forged report', role: 'cleaner' } })).status()).toBe(403);
    expect((await request.post('/api/completion', { headers, data: { action, jobId, revision: 0, role: 'host', workspaceId: 'foreign', storageKey: 'forged' } })).status()).toBe(403);
  }
});
