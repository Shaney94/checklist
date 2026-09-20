import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function fill(page: Page) {
  await page.getByLabel('Town, area or postcode').fill('Glasgow G12');
  await page.getByLabel('Bedrooms', { exact: true }).fill('2');
  await page.getByLabel('Beds', { exact: true }).fill('2');
  await page.getByLabel('Bathrooms', { exact: true }).fill('1');
  await page.getByLabel('Size in square metres').fill('52');
}
test('anonymous quote uses real server prices for Both, Regular, Deep and unknown size', { tag: '@critical' }, async ({ page, request }) => {
  await page.goto('/');
  await page.locator('.hero-copy').getByRole('link', { name: 'Get your cleaning price' }).click();
  await expect(page).toHaveURL(/\/quote$/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  expect(await (await request.get('/sitemap.xml')).text()).not.toContain('/quote');
  await fill(page); await page.getByRole('button', { name: 'See your fixed price' }).click();
  await expect(page.locator('.quote-amount')).toHaveText(['£60', '£130']);
  await expect(page.locator('.quote-result')).toContainText('Approx. 2 hours');
  await expect(page.locator('.quote-result')).toContainText('Approx. 4–4.5 hours');
  await expect(page.getByRole('heading', { name: 'Your fixed cleaning price' })).toBeFocused();
  expect(await page.evaluate(() => sessionStorage.getItem('turnli-quote-draft'))).toBeNull();
  await page.locator('.quote-standards summary').first().click(); await expect(page.locator('.quote-standards details').first().locator('li')).toHaveCount(38);
  await page.getByRole('button', { name: 'Edit property details' }).click();
    await expect(page.getByLabel('Town, area or postcode')).toBeFocused();
  await page.getByLabel('Size in square metres').fill('70');
  await page.getByLabel('Beds', { exact: true }).fill('3');
  await page.getByRole('button', { name: 'See your fixed price' }).click();
  await expect(page.locator('.quote-amount')).toHaveText(['£75', '£170']);
  for (const [kind, amount] of [['Regular Clean', '£60'], ['Deep Clean', '£130']]) {
    await page.getByRole('button', { name: 'Edit property details' }).click();
    await expect(page.getByLabel('Town, area or postcode')).toBeFocused();
    await page.getByLabel('Beds', { exact: true }).fill('2');
    await page.getByRole('radio', { name: kind, exact: true }).check();
    await page.getByLabel('Property size', { exact: true }).selectOption('unknown');
    await page.getByRole('button', { name: 'See your fixed price' }).click();
    await expect(page.locator('.quote-amount')).toHaveText([amount]);
    await expect(page.locator('.quote-size-note')).toContainText('Adding property size improves quote accuracy');
  }
  const details = { location: 'Synthetic', bedrooms: 2, beds: 2, bathrooms: 1, sizeUnit: 'm2', size: 52, kind: 'both' };
  expect((await request.post('/api/quote', { headers: { origin: 'https://turnli.io' }, data: { ...details, price: 1 } })).status()).toBe(400);
  expect((await request.post('/api/quote', { headers: { origin: 'https://evil.example' }, data: details })).status()).toBe(403);
  expect((await request.post('/api/quote/save', { headers: { origin: 'https://turnli.io' }, data: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', details } })).status()).toBe(401);
});

test('quote survives existing account login and explicitly saves; refresh reads saved server state', { tag: '@critical' }, async ({ page }) => {
  let signedIn = false;
  await page.route('**/api/account**', route => {
    if (route.request().method() === 'POST') { signedIn = true; return route.fulfill({ json: { ok: true } }); }
    return route.fulfill({ json: route.request().url().includes('policy') ? { policy: { minLength: 8 } } : { user: signedIn ? { id: 'synthetic-host' } : null } });
  });
  let saved: object | null = null;
  await page.route('**/api/quote/save**', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ status: route.request().url().includes('?') ? 404 : 200, json: { quotes: saved ? [saved] : [] } });
    const body = route.request().postDataJSON(); expect(Object.keys(body).sort()).toEqual(['details', 'id']);
    const response = await page.request.post('/api/quote', { headers: { origin: 'https://turnli.io' }, data: body.details });
    saved = { propertyId: 'synthetic-property', workspace: '/app/host', quote: await response.json() };
    return route.fulfill({ status: 201, json: saved });
  });
  await page.goto('/quote'); await fill(page); await page.getByRole('button', { name: 'See your fixed price' }).click();
  await page.getByRole('button', { name: 'Continue with Turnli' }).click();
  await expect(page).toHaveURL(/\/register\?next=%2Fquote$/);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.getByLabel('Email address')).toBeFocused();
  await page.getByLabel('Email address').fill('synthetic@example.com'); await page.getByLabel('Password', { exact: true }).fill('Synthetic123!');
  await page.getByRole('button', { name: 'Log in →', exact: true }).click();
  await expect(page).toHaveURL(/\/quote$/); await expect(page.locator('.quote-amount')).toHaveText(['£60', '£130']); expect(saved).toBeNull();
  await page.getByRole('button', { name: 'Save property and quote' }).click();
  await expect(page.getByRole('heading', { name: 'Property and quote saved.' })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('turnli-quote-draft'))).toBeNull();
  await page.reload(); await page.getByText('Your saved properties and prices', { exact: true }).click();
  await page.getByRole('button', { name: /Glasgow G12 — Regular £60/ }).click();
  await expect(page.locator('.quote-amount')).toHaveText(['£60', '£130']);
  await expect(page.getByRole('link', { name: 'Open your workspace' })).toHaveAttribute('href', '/app/host');
});

test('quote validation, keyboard operation, responsive text and accessibility', { tag: '@critical' }, async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/quote');
  await page.getByRole('button', { name: 'See your fixed price' }).click(); await expect(page.getByLabel('Town, area or postcode')).toBeFocused();
  await fill(page); await page.getByLabel('Town, area or postcode').fill('<invalid>');
  await page.getByRole('button', { name: 'See your fixed price' }).click();
  await expect(page.locator('#quote-error')).toContainText('Enter a town'); await expect(page.getByLabel('Town, area or postcode')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Town, area or postcode')).toBeFocused();
  await expect(page.getByLabel('Beds', { exact: true })).toHaveValue('2');
  await page.getByLabel('Town, area or postcode').fill('Glasgow G12');
  for (const state of ['form', 'result']) {
    if (state === 'result') await page.getByRole('button', { name: 'See your fixed price' }).click();
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => document.documentElement.style.fontSize = '200%');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.evaluate(() => document.documentElement.style.fontSize = '');
      if (width === 390 || width === 1440) {
        expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
        await page.screenshot({ path: info.outputPath(`quote-${state}-${width}.png`), fullPage: true });
      }
    }
  }
  const standard = page.locator('.quote-standards summary').first(); await standard.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.quote-standards details').first()).toHaveAttribute('open', '');
  expect(await standard.evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  expect(errors).toEqual([]);
});

test('exact localhost quote works anonymously without Origin rewriting', { tag: '@critical' }, async ({ page }) => {
  await page.goto('/quote');
  await fill(page);
  await page.getByLabel('Town, area or postcode').fill('G13 1DF');
  await page.getByLabel('Bathrooms', { exact: true }).fill('2');
  await page.getByLabel('Size in square metres').fill('60');
  await page.getByLabel('Approximate cleans per month (optional)').fill('4');
  const responsePromise = page.waitForResponse(r => r.url().endsWith('/api/quote') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'See your fixed price' }).click();
  const response = await responsePromise;
  expect(response.request().postDataJSON()).toEqual({ location: 'G13 1DF', bedrooms: 2, beds: 2, bathrooms: 2, sizeUnit: 'm2', size: 60, kind: 'both', cleansPerMonth: 4 });
  expect(response.status(), await response.text()).toBe(200);
  await expect(page.locator('.quote-amount')).toHaveText(['£80', '£175']);
  await expect(page.locator('.quote-result')).toContainText('Approx. 2.5–2.75 hours');
  await expect(page.locator('.quote-result')).toContainText('Approx. 5.5–6 hours');
  await page.getByRole('button', { name: 'Edit property details' }).click();
  await expect(page.getByLabel('Town, area or postcode')).toBeFocused();
  await page.getByLabel('Property size', { exact: true }).selectOption('ft2');
  await page.getByLabel('Size in square feet').fill(String(60 / 0.09290304));
  await page.getByLabel('Approximate cleans per month (optional)').fill('12');
  await page.getByRole('button', { name: 'See your fixed price' }).click();
  await expect(page.locator('.quote-amount')).toHaveText(['£80', '£175']);
});
