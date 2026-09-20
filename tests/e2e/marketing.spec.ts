import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { login } from '../fixtures/dashboard';

const noOverflow = async (page: import('@playwright/test').Page) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
};
test('public homepage links into shared registration and login without exposing product data', { tag: '@critical' }, async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Happier stays.Less to do.');
  await page.locator('.hero-copy').getByRole('link', { name: 'Get started' }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Create your account');
  await expect(page.getByLabel('Confirm password')).toBeVisible();
  await page.getByRole('link', { name: 'Turnli home' }).click();
  await page.locator('.header-actions').getByRole('link', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome back');
  await expect(page.getByRole('button', { name: 'Email me a login code' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Forgot password?' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('public homepage retains a signed-in session and returns through server role routing', async ({ page, context, request }) => {
  await login(context, request, 'host');
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Happier stays.');
  await page.getByRole('link', { name: 'Your workspace' }).click();
  await expect(page).toHaveURL(/\/app\/host$/);
  await expect(page.locator('#host-title')).toHaveText('Properties');
});

test('responsive public and auth layouts, keyboard menu, reduced motion and text scaling', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320, 375, 430, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await noOverflow(page);
    await page.evaluate(() => document.documentElement.style.fontSize = '200%');
    await noOverflow(page);
    if (width === 320) await page.screenshot({ path: info.outputPath('home-320-enlarged.png'), fullPage: true });
    await page.evaluate(() => document.documentElement.style.fontSize = '');
    await page.locator('#operations').scrollIntoViewIfNeeded();
    await expect(page.locator('.operations-panel')).toHaveCSS('opacity', '1');
    expect(await page.locator('.hero-copy h1').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
    await page.screenshot({ path: info.outputPath(`home-${width}.png`), fullPage: true });
    for (const route of ['/login', '/register']) {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await noOverflow(page);
      await page.screenshot({ path: info.outputPath(`${route.slice(1)}-${width}.png`), fullPage: true });
    }
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  const menu = page.locator('.mobile-navigation summary');
  await menu.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'How it works' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeHidden();
  await page.evaluate(() => document.documentElement.style.fontSize = '200%');
  await noOverflow(page);
  await page.goto('/login');
  await page.evaluate(() => document.documentElement.style.fontSize = '200%');
  await noOverflow(page);
});

test('scroll reveals settle once and the page remains readable without JavaScript', async ({ page, browser }, info) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.locator('#how-it-works').scrollIntoViewIfNeeded();
  await expect(page.locator('.workflow-steps')).toHaveClass(/revealed/);
  await expect(page.locator('.workflow-steps li').last()).toHaveCSS('opacity', '1');
  await page.screenshot({ path: info.outputPath('workflow-motion.png'), fullPage: true });
  const context = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await context.newPage();
  await staticPage.goto('http://127.0.0.1:3100/');
  await expect(staticPage.locator('#operations-title')).toBeVisible();
  await expect(staticPage.locator('.operations-panel')).toHaveCSS('opacity', '1');
  await context.close();
});

test('public homepage and authentication retain accessible names and readable audience labels', { tag: '@critical' }, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const route of ['/', '/login', '/register']) {
    await page.goto(route);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
    for (const brand of await page.locator('.public-brand').all()) {
      await expect(brand).toHaveAccessibleName('Turnli home');
      await expect(brand.locator('img')).toHaveAttribute('alt', '');
    }
    if (route === '/') {
      for (const label of await page.locator('.use-case-copy .eyebrow').all()) {
        expect(await label.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(12);
      }
    }
    await page.setViewportSize({ width: 320, height: 900 });
    await page.evaluate(() => document.documentElement.style.fontSize = '200%');
    await noOverflow(page);
  }
});
