import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const path = '/airbnb-cleaning/glasgow';
const canonical = `https://turnli.io${path}`;

test('Glasgow is a public server-rendered local page with canonical metadata and parent breadcrumbs', { tag: '@critical' }, async ({ browser, request }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const response = await page.goto(`http://127.0.0.1:3100${path}`);
  expect(response?.status()).toBe(200);
  expect(response?.headers()['x-robots-tag'] || '').not.toContain('noindex');
  await expect(page).toHaveTitle('Airbnb cleaning Glasgow | Turnli');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Glasgow.*reference prices/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonical);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', 'Airbnb cleaning Glasgow | Turnli');
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Airbnb cleaning in Glasgow');
  const breadcrumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
  await expect(breadcrumbs.locator('li')).toHaveText(['Home', 'Airbnb cleaning', 'Glasgow']);
  await expect(breadcrumbs.getByRole('link', { name: 'Airbnb cleaning', exact: true })).toHaveAttribute('href', '/airbnb-cleaning');
  const schema = JSON.parse(await page.locator('script[type="application/ld+json"]').innerText());
  expect(schema).toEqual({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://turnli.io/' },
    { '@type': 'ListItem', position: 2, name: 'Airbnb cleaning', item: 'https://turnli.io/airbnb-cleaning' },
    { '@type': 'ListItem', position: 3, name: 'Glasgow', item: canonical },
  ] });
  expect(await page.locator('script[type="application/ld+json"]').evaluate(el => (el as HTMLScriptElement).nonce)).toBe(response?.headers()['content-security-policy'].match(/'nonce-([^']+)'/)?.[1]);
  const redirect = await request.get(path + '/', { maxRedirects: 0 });
  expect(redirect.status()).toBe(308); expect(redirect.headers().location).toBe(path);
  for (const city of ['edinburgh', 'london']) expect((await request.get(`/airbnb-cleaning/${city}`)).status()).toBe(404);
  await context.close();
});

test('Glasgow pricing is qualified and the real registration and related-page paths remain usable', { tag: '@critical' }, async ({ page }) => {
  await page.goto('/airbnb-cleaning');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Find reliable Airbnb cleaners');
  await page.getByRole('link', { name: 'Explore Airbnb cleaning in Glasgow' }).click();
  await expect(page).toHaveURL(new RegExp(path + '$'));
  const prices = page.locator('#reference-prices');
  await expect(prices.locator('.local-price')).toHaveText(['From £60', 'From £130']);
  for (const text of ['52 m²', '2 bedrooms', '1 bathroom', '38-task', '109-task', '2–2.25 hours', '4–4.5 hours', 'Cleaner supplies and linen/towel wash and dry']) await expect(prices).toContainText(text);
  for (const type of ['flats and apartments', 'houses', 'cottages', 'serviced accommodation']) await expect(page.locator('.hero-copy .public-lead')).toContainText(type);
  await expect(page.locator('#price-next-step')).toContainText('your price shown before an account is needed');
  for (const note of ['#price-next-step', '#final-price-note']) await expect(page.locator(note)).toContainText('For now, this button opens registration; it does not calculate a quote');
  await expect(prices.locator('.local-brief')).toContainText('before creating an account or logging in');
  await expect(prices.locator('.local-brief')).toContainText('An account will only be needed to save, post or proceed with your requirement.');
  await expect(page.locator('main form')).toHaveCount(0);
  await page.getByRole('link', { name: 'Get your cleaning price', exact: true }).first().click();
  await expect(page).toHaveURL(/\/register$/); await expect(page.getByLabel('Confirm password')).toBeVisible();
  await page.goto(path);
  await expect(page.getByRole('link', { name: 'Explore the cleaning software' })).toHaveAttribute('href', '/software/airbnb-cleaning');
  await expect(page.getByRole('link', { name: 'Explore Turnli for Cleaners' })).toHaveAttribute('href', '/cleaners/airbnb-cleaning-jobs/');
  await expect(page.getByRole('link', { name: 'See Turnli’s standard checklist approach' })).toHaveAttribute('href', '/#operations');
  await page.getByRole('link', { name: 'Invite them to Turnli free' }).click();
  await expect(page).toHaveURL(/\/register$/);
});

test('Glasgow is accessible and readable across mobile, desktop, reduced motion and enlarged text', { tag: '@critical' }, async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(path);
  for (const width of [320, 390, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole('link', { name: 'Get your cleaning price', exact: true }).first()).toBeVisible();
    if (width === 390 || width === 1440) {
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
      await page.screenshot({ path: info.outputPath(`glasgow-${width}.png`), fullPage: true });
      await page.screenshot({ path: info.outputPath(`glasgow-hero-${width}.png`) });
    }
    await page.evaluate(() => document.documentElement.style.fontSize = '200%');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => document.documentElement.style.fontSize = '');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.keyboard.press('Tab'); await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.getByRole('main')).toBeFocused();
  expect(await page.getByRole('main').evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
  const menu = page.locator('.mobile-navigation summary'); await menu.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(menu).toBeFocused();
  const question = page.locator('.local-questions summary').first(); await question.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.local-questions details').first()).toHaveAttribute('open', '');
  expect(await question.evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  expect(await page.locator('h1').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  expect(errors).toEqual([]);
});
