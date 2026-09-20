import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const cities = ['Edinburgh', 'London'];
const route = (city: string) => '/airbnb-cleaning/' + city.toLowerCase();
test('new local pages render public metadata and matching breadcrumbs without JavaScript', { tag: '@critical' }, async ({ browser, request }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const descriptions = new Set<string>();
  for (const city of cities) {
    const path = route(city), canonical = 'https://turnli.io' + path;
    const response = await page.goto('http://127.0.0.1:3100' + path);
    expect(response?.status()).toBe(200); expect(response?.headers()['x-robots-tag'] || '').not.toContain('noindex');
    await expect(page).toHaveTitle(`Airbnb cleaning ${city} | Turnli`);
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description).toContain(city); descriptions.add(description!);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonical);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', `Airbnb cleaning ${city} | Turnli`);
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', description!);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(`Airbnb cleaning in ${city}`);
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).locator('li')).toHaveText(['Home', 'Airbnb cleaning', city]);
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
    expect(JSON.parse(await page.locator('script[type="application/ld+json"]').innerText())).toEqual({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://turnli.io/' },
      { '@type': 'ListItem', position: 2, name: 'Airbnb cleaning', item: 'https://turnli.io/airbnb-cleaning' },
      { '@type': 'ListItem', position: 3, name: city, item: canonical },
    ] });
    expect(await page.locator('script[type="application/ld+json"]').evaluate(el => (el as HTMLScriptElement).nonce)).toBe(response?.headers()['content-security-policy'].match(/'nonce-([^']+)'/)?.[1]);
    const redirect = await request.get(path + '/', { maxRedirects: 0 }); expect(redirect.status()).toBe(308); expect(redirect.headers().location).toBe(path);
    await expect(page.locator('main form')).toHaveCount(0);
  }
  expect(descriptions.size).toBe(2);
  await context.close();
});

test('national city links lead to distinct guidance and the real anonymous shared quote', { tag: '@critical' }, async ({ page }) => {
  for (const city of cities) {
    await page.goto('/airbnb-cleaning');
    const cards = page.locator('section[aria-labelledby="local-title"] .acquisition-grid');
    await expect(cards.locator('article')).toHaveCount(3);
    for (const name of ['Glasgow', ...cities]) await expect(cards.getByRole('link', { name: `Explore Airbnb cleaning in ${name}` })).toHaveAttribute('href', route(name));
    await cards.getByRole('link', { name: `Explore Airbnb cleaning in ${city}` }).click();
    await expect(page).toHaveURL(new RegExp(route(city) + '$'));
    await expect(page.locator('.local-price')).toHaveText(['From £60', 'From £130']);
    await expect(page.locator('#reference-prices')).toContainText('38-task'); await expect(page.locator('#reference-prices')).toContainText('109-task');
    await expect(page.locator('#reference-prices')).toContainText('Cleaning supplies and normal linen/towel wash and dry are included');
    if (city === 'Edinburgh') {
      await expect(page.locator('.local-context')).toContainText('bed sizes');
      await expect(page.getByRole('link', { name: 'official short-term-let licensing and planning guidance' })).toHaveAttribute('href', 'https://www.edinburgh.gov.uk/licences-permits/licences-permits-applications/10');
      await expect(page.locator('.local-questions')).toContainText('festival stay');
    } else {
      await expect(page.locator('.local-context')).toContainText('Label clean sets by property');
      await expect(page.getByRole('link', { name: 'TfL’s journey planner' })).toHaveAttribute('href', 'https://tfl.gov.uk/plan-a-journey/');
      await expect(page.locator('.local-questions')).toContainText('same Cleaner cover two properties');
    }
    await expect(page.getByRole('link', { name: 'Invite your existing Cleaner to Turnli' })).toHaveAttribute('href', '/register');
    await expect(page.locator('#your-cleaner')).toContainText('Host workspace access is required');
    await expect(page.getByRole('link', { name: 'Explore Turnli for Cleaners' })).toHaveAttribute('href', '/cleaners/airbnb-cleaning-jobs/');
    await expect(page.locator('main a[href="/software/airbnb-cleaning"]')).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Explore Airbnb cleaning with Turnli' })).toHaveAttribute('href', '/airbnb-cleaning');
    await page.getByRole('link', { name: 'Get your cleaning price', exact: true }).first().click();
    await expect(page).toHaveURL(/\/quote$/);
    await page.getByLabel('Town, area or postcode').fill(city);
    await page.getByLabel('Bedrooms', { exact: true }).fill('2'); await page.getByLabel('Beds', { exact: true }).fill('2');
    await page.getByLabel('Bathrooms', { exact: true }).fill('1'); await page.getByLabel('Size in square metres').fill('52');
    await page.getByRole('button', { name: 'See your fixed price' }).click();
    await expect(page.locator('.quote-amount')).toHaveText(['£60', '£130']);
  }
});

test('local pages preserve responsive accessibility, keyboard access and reduced motion', { tag: '@critical' }, async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const city of cities) {
    await page.goto(route(city));
    for (const width of [320, 390, 430, 768, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width === 390 || width === 1440) {
        await page.evaluate(() => scrollTo(0, 0));
        await expect(page.getByRole('link', { name: 'Get your cleaning price', exact: true }).first()).toBeInViewport();
        expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
        await page.screenshot({ path: info.outputPath(`${city}-${width}.png`), fullPage: true });
        await page.screenshot({ path: info.outputPath(`${city}-hero-${width}.png`) });
      }
      await page.evaluate(() => document.documentElement.style.fontSize = '200%');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.evaluate(() => document.documentElement.style.fontSize = '');
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.keyboard.press('Tab'); await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
    await page.keyboard.press('Enter'); await expect(page.getByRole('main')).toBeFocused();
    expect(await page.getByRole('main').evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
    const question = page.locator('.local-questions summary').first(); await question.focus(); await page.keyboard.press('Enter');
    await expect(page.locator('.local-questions details').first()).toHaveAttribute('open', '');
    expect(await question.evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    expect(await page.locator('h1').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  }
  expect(errors).toEqual([]);
});
