import { test, expect, type Page } from '@playwright/test';
import { login } from '../fixtures/dashboard';
const propertyId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
async function empty(page: Page) {
  await page.route('**/api/property-assignments**', r => r.fulfill({ json: { assignments: [] } }));
  await page.route('**/api/cleaning-jobs**', r => r.fulfill({ json: { jobs: [], hasCode: false } }));
  await page.route('**/api/dashboard?*', r => r.fulfill({ json: { sidebarCollapsed: false } }));
  await page.route('**/api/dashboard', r => r.fulfill({ json: { revision: 0, data: { properties: [] } } }));
  await page.route('**/api/calendar?*', r => r.fulfill({ json: { state: 'not-connected', calendars: [], bookings: [] } }));
}
test('empty Cleaner workspace gives clear next actions and hides inapplicable calendar controls', async ({ page, context, request }, info) => {
  await login(context, request); await empty(page);
  for (const width of [320,375,430,768,1440]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto('/app');
    await expect(page.getByText('No assigned properties yet. Invitations from your Host will appear here.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add customer property', exact: true })).toBeVisible();
    for (const name of ['Download Calendar','Copy iCal Link','Refresh calendars','Manage calendars']) await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`empty-${width}.png`), fullPage: true });
  }
  await page.getByRole('button', { name: 'Add customer property', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'My customers', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'My customers', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Property name', { exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add customer property', exact: true })).toBeFocused();
});

test('customer property creation, scoped calendar connection and persisted cleaning lists use the existing model', { tag: '@critical' }, async ({ page, context, request }, info) => {
  await login(context, request); await empty(page);
  const { change } = require('../../src/server/handlers/dashboard.js');
  let revision = 0, data = { properties: [] as Record<string, any>[] };
  let calendars: Record<string, any>[] = [];
  await page.route('**/api/dashboard', r => {
    if (r.request().method() === 'POST') { const b = r.request().postDataJSON(); expect(b.revision).toBe(revision++); data = change(data,b); }
    return r.fulfill({ json: { revision, data } });
  });
  await page.route('**/api/calendar**', r => {
    if(r.request().method() === 'POST') {
      const b = r.request().postDataJSON(); expect(b.action).toBe('connect'); expect(b.propertyId).toBe(data.properties[0].id); expect(b.url).toBe('https://example.test/private-customer.ics');
      calendars = [{id:'calendar-own', propertyId:b.propertyId, name:b.name, platform:b.platform, enabled:true, status:'Connected', checkIn:'15:00', checkOut:'10:00'}];
    }
    return r.fulfill({ json: { state:calendars.length?'ready':'not-connected', calendars, bookings:[] } });
  });
  await page.goto('/app'); await page.getByRole('button', { name: 'Add customer property', exact:true }).click();
  const dialog = page.getByRole('dialog', { name:'My customers',exact:true });
  await dialog.getByLabel('Property name',{exact:true}).fill('Customer flat');
  await dialog.getByRole('button',{name:'Save customer property',exact:true}).click();
  await expect(dialog.getByRole('heading',{name:'Customer flat',exact:true})).toBeVisible();
  await dialog.getByRole('button',{name:'Connect customer calendar',exact:true}).click();
  const calendarDialog=page.getByRole('dialog',{name:'Customer calendars',exact:true});
  await expect(calendarDialog.getByRole('combobox',{name:'Workspace property'})).toHaveCount(0);
  await calendarDialog.getByLabel('iCal URL').fill('https://example.test/private-customer.ics');
  await calendarDialog.getByRole('button',{name:'Connect calendar',exact:true}).click();
  await expect(calendarDialog.getByText('Calendar connected ✓',{exact:true})).toBeVisible();
  await calendarDialog.getByRole('button',{name:'Close',exact:true}).click();
  await dialog.getByRole('button',{name:'Regular Clean List',exact:true}).click();
  const checkbox = dialog.getByRole('checkbox').first(); await checkbox.check();
  await expect(checkbox).toBeEnabled(); expect(data.properties[0].checked.regular).toEqual([0]);
  await dialog.locator('#workspaceContentDialog').getByRole('button',{name:'Close',exact:true}).click();
  await dialog.getByRole('button',{name:'Close',exact:true}).click();
  await expect(page.getByRole('button',{name:'Manage calendars',exact:true})).toBeVisible();
  await page.reload(); await page.getByRole('button',{name:'Open My customers',exact:true}).click();
  await dialog.getByRole('button',{name:'Regular Clean List',exact:true}).click(); await expect(dialog.getByRole('checkbox').first()).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('customer-list.png'),fullPage:true});
});

test('Cleaner account dialog exposes only genuine self settings and preserves recovery and sign-out failures',async({page,context,request},info)=>{
  await login(context,request);await empty(page);
  let attempts=0;
  await page.route('**/api/account',r=>{
    if(r.request().method()!=='POST')return r.fallback();
    const b=r.request().postDataJSON();
    if(b.action==='logout'&&++attempts===1)return r.fulfill({status:503,json:{error:'We couldn’t sign you out. Please try again.'}});
    return r.fulfill({json:{ok:true}});
  });
  await page.goto('/app'); const button=page.getByRole('button',{name:/Signed in as/}); await button.click();
  const dialog=page.getByRole('dialog',{name:'Your account',exact:true});
  await expect(dialog.getByText('fixture@example.com',{exact:true})).toBeVisible();
  await expect(dialog.getByRole('heading',{name:'Password & security'})).toBeVisible();
  await expect(dialog.getByRole('link',{name:'Set or change password'})).toHaveAttribute('href','/login?reset=1&next=%2Fapp');
  await expect(dialog.getByText(/WhatsApp|Notifications|Cleaning jobs/)).toHaveCount(0);
  await page.screenshot({path:info.outputPath('cleaner-account.png'),fullPage:true});
  await page.keyboard.press('Escape'); await expect(button).toBeFocused(); await button.click();
  await dialog.getByRole('button',{name:'Sign out',exact:true}).click(); await expect(dialog.getByRole('status')).toContainText('Please try again');
  await dialog.getByRole('link',{name:'Set or change password'}).click();
  await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();
  await page.getByLabel('Email address').fill('fixture@example.com'); await page.getByRole('button',{name:'Forgot password?'}).click();
  await expect(page.getByRole('heading',{name:'Set your password',exact:true})).toBeVisible();
  await page.goto('/app');await button.click();await dialog.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page).toHaveURL('http://127.0.0.1:3100/');
});

test('an assigned property with no linked calendar offers guidance without calendar administration',async({page,context,request})=>{
  await login(context,request);await empty(page);
  await page.route('**/api/property-assignments**',r=>r.fulfill({json:new URL(r.request().url()).searchParams.has('action')?{state:'ready',hasCalendar:false,calendars:[],bookings:[]}:{assignments:[{id:propertyId,propertyId,propertyName:'Assigned flat',state:'active'}]}}));
  await page.goto('/app');await expect(page.getByText('Your Host has not linked a calendar to this property yet.')).toBeVisible();
  await expect(page.getByRole('button',{name:'Read property Start Guide'})).toBeVisible();
  for(const name of ['Download Calendar','Copy iCal Link','Refresh calendars','Manage calendars'])await expect(page.getByRole('button',{name,exact:true})).toHaveCount(0);
});
