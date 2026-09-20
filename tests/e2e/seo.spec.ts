import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { login } from '../fixtures/dashboard';

const origin = 'https://turnli.io';
const routes = ['/', '/airbnb-cleaning', '/software/airbnb-cleaning', '/cleaners/airbnb-cleaning-jobs/'];

test('public SEO is server rendered, canonical, crawlable and describes only real entities', { tag: '@critical' }, async ({ browser, request }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  for (const route of routes) {
    const response = await page.goto(`http://127.0.0.1:3100${route}?utm_source=synthetic`);
    expect(response?.status()).toBe(200);
    expect(response?.headers()['x-robots-tag'] || '').not.toMatch(/noindex/);
    const title = await page.title(); titles.add(title);
    const description = await page.locator('meta[name="description"]').getAttribute('content'); descriptions.add(description!);
    expect(title).toContain('Turnli'); expect(description!.length).toBeGreaterThan(60);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', origin + route);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', origin + route);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', title);
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', description!);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('banner')).toHaveCount(1);
    await expect(page.getByRole('contentinfo')).toHaveCount(1);
    for (const target of routes.slice(1)) await expect(page.locator(`footer a[href="${target}"]`)).toBeVisible();
    const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').innerText());
    expect(ld['@context']).toBe('https://schema.org');
    expect(await page.locator('script[type="application/ld+json"]').evaluate(el => (el as HTMLScriptElement).nonce)).toBe(response?.headers()['content-security-policy'].match(/'nonce-([^']+)'/)?.[1]);
    if (route === '/') {
      expect(ld['@graph'].map((entity: { '@type': string }) => entity['@type'])).toEqual(['Organization', 'WebSite']);
      expect(ld['@graph'][0].url).toBe(origin + '/');
      expect(ld['@graph'][1].name).toBe('Turnli');
    } else {
      expect(ld['@type']).toBe('BreadcrumbList');
      expect(ld.itemListElement.map((item: { position: number }) => item.position)).toEqual([1, 2]);
      expect(ld.itemListElement[1].item).toBe(origin + route);
      await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText(ld.itemListElement[1].name);
    }
    if (route !== '/') {
      const variant = route.endsWith('/') ? route.slice(0, -1) : route + '/';
      const redirect = await request.get(variant, { maxRedirects: 0 });
      expect(redirect.status()).toBe(308); expect(redirect.headers().location).toBe(route);
    }
  }
  expect(titles.size).toBe(4); expect(descriptions.size).toBe(4);
  expect((await request.get('/icons/icon-512.png')).status()).toBe(200);
  await context.close();
});

test('sitemap and robots expose only intended public URLs; auth and private routes stay protected', { tag: '@critical' }, async ({ page, request, context }) => {
  const sitemap = await request.get('/sitemap.xml'); expect(sitemap.status()).toBe(200);
  expect([...((await sitemap.text()).matchAll(/<loc>(.*?)<\/loc>/g))].map(match => match[1])).toEqual(routes.map(route => origin + route));
  const robots = await request.get('/robots.txt'); expect(robots.status()).toBe(200);
  const text = await robots.text(); expect(text).toContain('Allow: /'); expect(text).not.toMatch(/^Disallow: \/$/m);
  expect(text).toContain(`Sitemap: ${origin}/sitemap.xml`); expect(text).not.toMatch(/Disallow: \/(?:_next|icons|login|register)/);
  for (const route of ['/login', '/register', '/?join=1', '/?t=synthetic', '/?reset=1', '/?next=%2Fapp']) {
    const response = await page.goto(route);
    expect(response?.headers()['x-robots-tag']).toContain('noindex');
    expect(response?.headers()['cache-control']).toContain('no-store');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
  }
  for (const route of ['/app', '/app/host/properties', '/api/start-guide?propertyId=other', '/api/completion?jobId=other']) {
    const response = await request.get(route, { maxRedirects: 0 });
    expect([303, 401]).toContain(response.status()); expect(response.headers()['x-robots-tag']).toContain('noindex');
  }
  for (const role of ['cleaner', 'host']) {
    await login(context, request, role === 'host' ? 'host' : undefined);
    const response = await page.goto(role === 'host' ? '/app/host' : '/app');
    expect(response?.status()).toBe(200); expect(response?.headers()['x-robots-tag']).toContain('noindex');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await context.clearCookies();
  }
  expect((await request.get('/private/cleaning-content.enc')).status()).toBe(404);
});

test('cornerstones support accessible navigation, mobile reflow, reduced motion and 200% text', { tag: '@critical' }, async ({ page }, info) => {
  const viewport = page.viewportSize()!;
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [index, route] of routes.slice(1).entries()) {
    await page.setViewportSize(viewport);
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
    await page.keyboard.press('Tab'); await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
    await page.keyboard.press('Enter'); await expect(page.getByRole('main')).toBeFocused();
    expect(await page.getByRole('main').evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
    expect(await page.locator('h1').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
    await page.screenshot({ path: info.outputPath(`cornerstone-${index}.png`), fullPage: true });
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => document.documentElement.style.fontSize = '200%');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.evaluate(() => document.documentElement.style.fontSize = '');
    await page.setViewportSize({ width: 375, height: 812 });
    const menu = page.locator('.mobile-navigation summary'); await menu.focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
    await page.keyboard.press('Tab'); await expect(page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'How it works' })).toBeFocused();
    await page.keyboard.press('Escape'); await expect(menu).toBeFocused();
    await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeHidden();
    await page.locator('.hero-copy .public-button').click();
    await expect(page).toHaveURL(/\/register$/); await expect(page.getByLabel('Confirm password')).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('Cleaner acquisition canonical resolves directly and other route normalisation is unchanged', { tag: '@critical' }, async ({ request }) => {
  const path = '/cleaners/airbnb-cleaning-jobs/';
  const response = await request.get(path, { maxRedirects: 0 });
  expect(response.status()).toBe(200);
  expect(response.headers()['x-robots-tag'] || '').not.toContain('noindex');
  expect(response.headers()['content-security-policy']).toContain("'nonce-");
  const html = await response.text();
  expect(html).toContain('Find Airbnb cleaning jobs');
  expect(html).toContain(`rel="canonical" href="${origin}${path}"`);
  expect(html).toContain('name="robots" content="index, follow"');
  const variant = await request.get(path.slice(0, -1) + '?utm_source=synthetic', { maxRedirects: 0 });
  expect(variant.status()).toBe(308);
  expect(variant.headers().location).toBe(path + '?utm_source=synthetic');
  for (const route of ['/airbnb-cleaning', '/software/airbnb-cleaning', '/login', '/register', '/app', '/app/host', '/api/account']) {
    const other = await request.get(route + '/?test=1', { maxRedirects: 0 });
    expect(other.status()).toBe(308);
    expect(other.headers().location).toBe(route + '?test=1');
  }
});
