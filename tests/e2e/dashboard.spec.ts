import { test, expect } from "@playwright/test";
import { login, fixtures } from "../fixtures/dashboard";
test("authenticated calendar keeps continuous bars, details, management, filters and copying", async ({
  page,
  context,
  request,
}, info) => {
  await login(context, request);
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
  await page.goto("/app");
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
  await page.getByLabel("iCal URL").fill("https://example.com/second.ics");
  await page.getByRole("button", { name: "Connect calendar" }).click();
  await expect(page.locator(".connected-calendar")).toHaveCount(2);
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
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "More", exact: true }).click();
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
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Close", exact: true }).click();
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
test("workspace tools retain saved checklists, FAQs, Back navigation and account controls", async ({
  page,
  context,
  request,
}, info) => {
  await login(context, request);
  await fixtures(page);
  await page.goto("/app");
  await page
    .getByRole("button", { name: "Regular Clean List", exact: true })
    .click();
  await expect(page.locator("#workspaceContentTitle")).toHaveText(
    "Regular Clean List",
  );
  await page.getByRole("checkbox", { name: "Wipe surfaces" }).check();
  await expect(page.locator("#workspaceContentView")).toContainText(
    "1 of 2 completed",
  );
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Turnli Cleaning Calendar" }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("checkbox", { name: "Wipe surfaces" }),
  ).toBeChecked();
  await page.getByRole("button", { name: "FAQs", exact: true }).click();
  await page.getByText("Where are supplies?", { exact: true }).click();
  await expect(
    page.getByText("In the cupboard.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Answer", exact: true })
    .fill("In the labelled cupboard.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("Where are supplies?", { exact: true }).click();
  await expect(
    page.getByText("In the labelled cupboard.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Calendar", exact: true }).click();
  if (info.project.name === "desktop") {
    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await page
      .getByRole("button", { name: "Deep Clean List", exact: true })
      .focus();
    await expect(page.getByRole("tooltip")).toHaveText("Deep Clean List");
  }
  await page.getByRole("button", { name: /Signed in as/ }).click();
  await expect(
    page.getByRole("heading", { name: "Your account" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Set or change password" }),
  ).toHaveAttribute("href", "/?reset=1&next=%2Fapp");
});
test("empty accounts stay empty and original workspace tools retain their existing interactions", async ({
  page,
  context,
  request,
}) => {
  const tokens = await (
    await request.get("http://127.0.0.1:3101/tokens")
  ).json();
  const renewed = await request.get("/app", {
    headers: {
      Cookie:
        "__Host-turnly-session=" +
        tokens.expired +
        "; __Host-turnly-refresh=" +
        tokens.refresh,
    },
    maxRedirects: 0,
  });
  expect(renewed.status()).toBe(200);
  expect(
    renewed.headersArray().filter((h) => h.name.toLowerCase() === "set-cookie"),
  ).toHaveLength(2);
  await login(context, request);
  await fixtures(page);
  let checked: boolean[] = [];
  await page.route("**/api/dashboard", (r) => {
    if (r.request().method() === "POST")
      checked = r.request().postDataJSON().state?.checked || checked;
    return r.fulfill({
      json: {
        revision: 0,
        data: { properties: [], legacyProgress: { regular: { checked } } },
      },
    });
  });
  await page.goto("/app");
  await page
    .getByRole("button", { name: "＋ Regular Clean List", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Property setup" }),
  ).toBeVisible();
  await expect(page.locator("#sections")).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.route("**/api/dashboard-bootstrap", (r) =>
    r.fulfill({
      json: {
        user: {
          id: "browser-fixture",
          email: "fixture@example.com",
          legacyAccess: true,
          role: "cleaner",
          canInvite: false,
          workspaceId: "test",
        },
        content: {
          regular: [["Kitchen", ["Original task"]]],
          deep: [["Deep", ["Deep task"]]],
          faqs: [
            {
              question: "Existing FAQ",
              answer: [{ tag: "strong", children: ["Existing answer"] }],
            },
          ],
          reminders: [["Existing reminder"]],
          hostPhone: "441234567890",
          propertyName: "Original property",
          originalCalendar: "",
        },
      },
    }),
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Regular Clean List", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Regular Clean", exact: true }),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: "Original task" }).check();
  await expect(page.locator("#checklistView")).toContainText("100% complete");
  await expect.poll(() => checked).toEqual([true]);
  await page.getByRole("button", { name: "Report an issue to host" }).click();
  await page.getByRole("radio", { name: "Damage", exact: true }).check();
  await expect(
    page.getByRole("link", { name: "Report via WhatsApp" }),
  ).toHaveAttribute("href", /wa\.me\/441234567890\?text=.*Damage/);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "FAQs", exact: true }).click();
  await page.getByRole("button", { name: "Existing FAQ" }).click();
  await expect(
    page.getByText("Existing answer", { exact: true }),
  ).toBeVisible();
});

test("compact month segments retain identity, readable details and reduced-motion reminders", async ({ page, context, request }, info) => {
  await login(context, request);
  await fixtures(page);
  await page.clock.install({ time: new Date("2026-09-19T12:00:00Z") });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/app");
  const bars = page.locator('[data-booking-id="calendar-1:stay"]');
  await expect(bars).toHaveCount(3);
  await expect(page.locator(".calendar-zone")).toHaveText("BST");
  await expect(page.getByRole("button", { name: "Resume reminders" })).toBeVisible();
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
  await page.mouse.move(0, 0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.getByRole("button", { name: "Pause reminders" })).toBeVisible();
  const reminder = page.locator('#workspaceReminder');
  const initialReminder = await reminder.textContent();
  await page.clock.runFor(10200);
  await expect(reminder).not.toHaveText(initialReminder!);
  await page.getByRole('button', { name: 'Pause reminders' }).click();
  const pausedReminder = await reminder.textContent();
  await page.clock.runFor(10200);
  await expect(reminder).toHaveText(pausedReminder!);
});

test("sidebar preference survives reload and cleaning lists contain only task context", async ({ page, context, request }, info) => {
  await login(context, request);
  await fixtures(page);
  await page.goto('/app');
  if (info.project.name === 'desktop') {
    await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toBeVisible();
    const before = (await page.locator('#cleaningCalendar').boundingBox())!.width;
    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    await expect.poll(async () => (await page.locator('#cleaningCalendar').boundingBox())!.width).toBeGreaterThan(before + 100);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
    const destination = page.getByRole('button', { name: 'Deep Clean List', exact: true });
    await destination.hover();
    await expect(page.getByRole('tooltip')).toHaveText('Deep Clean List');
    expect(await page.getByRole('tooltip').evaluate((el) => el.parentElement === document.body)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await destination.focus();
    await expect(page.getByRole('tooltip')).toBeVisible();
  }
  for (const kind of ['Regular Clean List', 'Deep Clean List']) {
    await page.getByRole('button', { name: kind, exact: true }).click();
    await expect(page.locator('#workspaceContentTitle')).toHaveText(kind);
    await expect(page.locator('#workspaceContentView input:not([type=checkbox])')).toHaveCount(0);
    await expect(page.locator('#propertySummary')).toHaveCount(0);
    await expect(page.locator('#workspaceContentDialog')).not.toContainText('Existing instructions');
  }
  await page.getByRole('checkbox', { name: 'Deep clean item' }).check();
  await expect(page.locator('#workspaceContentView')).toContainText('1 of 1 completed');
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Deep clean item' })).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("unknown and overlapping bookings stay distinct without invented metadata", async ({ page, context, request }, info) => {
  await login(context, request);
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
  await page.goto('/app');
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
