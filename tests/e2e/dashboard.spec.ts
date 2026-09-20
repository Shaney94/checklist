import { test, expect } from "@playwright/test";
import { login, fixtures } from "../fixtures/dashboard";
for (const role of ["host", "cleaner"] as const) test(`${role} calendar keeps continuous bars, details, management, filters and copying`, async ({
  page,
  context,
  request,
}, info) => {
  await login(context, request, role === "host" ? "host" : undefined);
  const actions = await fixtures(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: {
        write: async (items: ClipboardItem[]) => {
          (window as unknown as { copied: string }).copied = await (
            await items[0].getType("text/plain")
          ).text();
        },
        writeText: async (value: string) => {
          (window as unknown as { copied: string }).copied = value;
        },
      },
    }),
  );
  await page.goto(role === "host" ? "/app/host/reservations" : "/app");
  await expect(
    page.getByRole("heading", { name: "Turnli Cleaning Calendar" }),
  ).toBeVisible();
  await expect(page.locator(".stay-bar").first()).toBeVisible();
  expect(await page.locator(".stay-bar").count()).toBeGreaterThan(1);
  await expect(page.locator(".stay-bar").first()).toHaveAttribute(
    "data-source",
    "airbnb",
  );
  await page.locator(".stay-bar").first().click();
  await expect(
    page.getByRole("heading", { name: "Reservation details" }),
  ).toBeVisible();
  await expect(page.locator("#cleanDetailsText")).toContainText("Guests: 3");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("button", { name: "Manage calendars", exact: true })
    .click();
  await page.getByRole("button", { name: "View details / Rename" }).click();
  await page.getByLabel("Calendar/property name").fill("Renamed property");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator("#connectedCalendars")).toContainText(
    "Renamed property",
  );
  await page
    .getByRole("button", { name: "+ Add calendar", exact: true })
    .click();
  await page.getByLabel("Calendar/property name").fill("Second property");
  await page.getByRole("combobox", { name: role === "host" ? "Workspace property" : "Customer property", exact: true }).selectOption("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  await page.getByLabel("iCal URL").fill("https://example.com/second.ics");
  await page.getByRole("button", { name: "Connect calendar" }).click();
  await expect(page.locator(".connected-calendar")).toHaveCount(2);
  await expect(page.locator("#connectedCalendars")).toContainText("Linked to a workspace property.");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Calendar property" })
    .selectOption("calendar-2");
  await expect(
    page.getByRole("combobox", { name: "Calendar property" }),
  ).toHaveValue("calendar-2");
  await page
    .getByRole("button", { name: "Manage calendars", exact: true })
    .click();
  const second = page
    .locator(".connected-calendar")
    .filter({
      has: page.getByRole("heading", { name: "Second property", exact: true }),
    });
  await second.getByRole("button", { name: "View details / Rename" }).click();
  await page.getByRole("checkbox", { name: "Calendar enabled" }).uncheck();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(second).toContainText("Paused");
  page.once("dialog", (d) => d.accept());
  await second.getByRole("button", { name: "Remove calendar" }).click();
  await expect(page.locator(".connected-calendar")).toHaveCount(1);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: "Refresh calendars", exact: true })
    .click();
  await expect(page.locator("#calendarStatus")).toHaveText(
    "Calendars refreshed.",
  );
  await page
    .getByRole("button", { name: "Copy iCal Link", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Copied!", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => (window as unknown as { copied: string }).copied),
  ).toBe("https://example.com/private-test.ics");
  await page.route("https://example.com/private-test.ics", (r) =>
    r.fulfill({
      contentType: "text/calendar",
      headers: { "Content-Disposition": 'attachment; filename="test.ics"' },
      body: "BEGIN:VCALENDAR\r\nEND:VCALENDAR",
    }),
  );
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download Calendar", exact: true })
    .click();
  expect((await downloaded).suggestedFilename()).toBe("test.ics");
  expect(actions).toContain("seen");
  expect(actions).toContain("update");
  expect(actions).toContain("refresh");
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("dashboard.png"),
    fullPage: true,
  });
});
test("compact month segments retain identity, readable details under reduced motion", async ({ page, context, request }, info) => {
  await login(context, request, "host");
  await fixtures(page);
  await page.clock.install({ time: new Date("2026-09-19T12:00:00Z") });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/app/host/reservations");
  const bars = page.locator('[data-booking-id="calendar-1:stay"]');
  await expect(bars).toHaveCount(3);
  await expect(page.locator(".calendar-zone")).toHaveText("BST");
  const geometries = await bars.evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect();
    const week = node.closest('.booking-week')!.getBoundingClientRect();
    return { width: rect.width, height: rect.height, weekWidth: week.width,
      animation: getComputedStyle(node).animationName,
      arrows: node.querySelectorAll('.continuation-arrow').length };
  }));
  expect(geometries[1].width).toBeGreaterThan(geometries[1].weekWidth * .95);
  expect(geometries.every((g) => g.height >= 24 && g.height <= 32 && g.animation === 'none' && g.arrows <= 1)).toBe(true);
  for (let i = 0; i < 3; i++) {
    await bars.nth(i).click();
    await expect(page.locator('#cleanDetailsText')).toContainText('Thursday, 3 September 2026');
    await expect(page.locator('#cleanDetailsText')).toContainText('Friday, 18 September 2026');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  }
  await expect(page.locator('.week-dates > span').first()).toHaveCSS('border-radius', '7px');
  await page.screenshot({ path: info.outputPath('continuous-month.png'), fullPage: true });
  await page.reload();
  await expect(bars).toHaveCount(3);
  await expect(page.locator('[data-new-booking]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Next month' }).click();
  await expect(page.locator('.calendar-zone')).toHaveText('BST / GMT');
  await page.getByRole('button', { name: 'Next month' }).click();
  await expect(page.locator('.calendar-zone')).toHaveText('GMT');

});

test("unknown and overlapping bookings stay distinct without invented metadata", async ({ page, context, request }, info) => {
  await login(context, request, "host");
  await fixtures(page);
  await page.clock.setFixedTime(new Date('2026-09-19T12:00:00Z'));
  if (info.project.name === 'mobile') await page.setViewportSize({ width: 320, height: 740 });
  await page.route('**/api/calendar?month=*', (r) => r.fulfill({ json: {
    state: 'connected', timeZone: 'Europe/London',
    calendars: [{ id: 'test', name: 'Test property', enabled: true }],
    bookings: [
      { id: 'a', property: 'Test property', arrival: { date: '2026-09-14', time: '15:00' }, checkout: { date: '2026-09-16', time: '10:00' } },
      { id: 'b', property: 'Test property', source: 'Booking.com', sourceKey: 'booking', guests: 2, arrival: { date: '2026-09-16', time: '15:00' }, checkout: { date: '2026-09-18', time: '10:00' } },
      { id: 'c', property: 'Test property', source: 'Vrbo', sourceKey: 'vrbo', arrival: { date: '2026-09-15', time: '15:00' }, checkout: { date: '2026-09-19', time: '10:00' } },
    ],
  } }));
  await page.goto('/app/host/reservations');
  const unknown = page.locator('[data-booking-id="a"]');
  await expect(unknown).toHaveAttribute('data-source', 'unknown');
  await expect(unknown.locator('.stay-guests, .stay-source')).toHaveCount(0);
  const a = (await unknown.boundingBox())!;
  const b = (await page.locator('[data-booking-id="b"]').boundingBox())!;
  const c = (await page.locator('[data-booking-id="c"]').boundingBox())!;
  expect(a.y).toBe(b.y);
  expect(a.x + a.width).toBeLessThanOrEqual(b.x);
  expect(c.y).toBeGreaterThanOrEqual(a.y + a.height);
  await unknown.click();
  await expect(page.locator('#cleanDetailsText')).not.toContainText('Guests:');
  await expect(page.locator('#cleanDetailsText')).not.toContainText('Booking source:');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('overlapping-month.png'), fullPage: true });
});
