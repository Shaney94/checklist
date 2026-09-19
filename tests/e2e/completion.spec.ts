import { test, expect } from '@playwright/test';
import { login } from '../fixtures/dashboard';
const jobId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const propertyId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZkAAAAASUVORK5CYII=', 'base64');

test('Cleaner reviews required photos, submits once and can only read submitted evidence', async ({ page, context, request }, info) => {
  await login(context, request);
  let state = 'scheduled', revision = 1, checked: number[] = [], photos: { id: string; width: number; height: number; size: number }[] = [];
  const job = () => ({ id: jobId, propertyId, propertyName: 'Synthetic property', date: '2026-09-19', kind: 'regular', state, revision, assigned: true, hostPhone: '+447700900123', tasks: ['Synthetic cleaning task'], checked, faqs: [] });
  await page.route('**/api/dashboard?*', r => r.fulfill({ json: { sidebarCollapsed: false } }));
  await page.route('**/api/cleaning-jobs**', r => {
    if (r.request().method() === 'POST') { const b = r.request().postDataJSON(); expect(b.action).toBe('check'); expect(b.revision).toBe(revision++); checked = b.checked ? [0] : []; return r.fulfill({ json: { saved: true } }); }
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
  await page.goto('/app#regular');
  await expect(page.getByRole('button', { name: 'Complete clean', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Can’t make this clean', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Contact host on WhatsApp' })).toHaveAttribute('href', /wa\.me\/447700900123/);
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

for (const decision of ['approve', 'issue'] as const) test(`Host can ${decision} pending completion while preserving submitted evidence`, async ({ page, context, request }, info) => {
  const tokens = await (await request.get('http://127.0.0.1:3101/tokens?role=host')).json();
  await context.setExtraHTTPHeaders({ Cookie: '__Host-turnly-session=' + tokens.session + '; __Host-turnly-refresh=' + tokens.refresh });
  let state = 'awaiting_review', revision = 5, reviewNote: string | null = null;
  const job = () => ({ id: jobId, propertyId, propertyName: 'Submitted property', date: '2026-09-19', kind: 'regular', state, revision, assigned: true });
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
  await page.goto('/app/host/cleaning-jobs');
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

test('real completion endpoint denies anonymous photo reads and role escalation', async ({ request }) => {
  expect((await request.get('/api/completion?jobId=' + jobId + '&photoId=' + propertyId)).status()).toBe(401);
  for (const [role, action] of [['cleaner', 'approve'], ['host', 'upload']]) {
    const tokens = await (await request.get('http://127.0.0.1:3101/tokens?role=' + role)).json();
    const headers = { Cookie: '__Host-turnly-session=' + tokens.session + '; __Host-turnly-refresh=' + tokens.refresh, Origin: 'https://turnli.vercel.app' };
    expect((await request.post('/api/completion', { headers, data: { action, jobId, revision: 0, role: 'host', workspaceId: 'foreign', storageKey: 'forged' } })).status()).toBe(403);
  }
});
