import {
  expect,
  type Page,
  type BrowserContext,
  type APIRequestContext,
} from "@playwright/test";
export async function login(
  context: BrowserContext,
  request: APIRequestContext,
  role?: "host",
) {
  const tokens = await (
    await request.get("http://127.0.0.1:3101/tokens" + (role ? "?role=" + role : ""))
  ).json();
  await context.setExtraHTTPHeaders({
    Cookie:
      "__Host-turnly-session=" +
      tokens.session +
      "; __Host-turnly-refresh=" +
      tokens.refresh,
  });
}
export async function fixtures(page: Page) {
  let revision = 0;
  let sidebarCollapsed = false;
  let seen = false;
  const property = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    name: "Test property",
    phone: "+441234567890",
    notes: "Existing instructions",
    regular: ["Wipe surfaces", "Check windows"],
    deep: ["Deep clean item"],
    faqs: [{ question: "Where are supplies?", answer: "In the cupboard." }],
    checked: { regular: [] as number[], deep: [] as number[] },
  };
  let calendars = [
    {
      id: "calendar-1",
      propertyId: null as string | null,
      name: "Test property",
      platform: "Airbnb",
      status: "Connected",
      enabled: true,
      checkIn: "15:00",
      checkOut: "10:00",
      lastSuccess: "2026-09-01T10:00:00Z",
    },
  ];
  const actions: string[] = [];
  await page.route("**/api/dashboard?*", (r) =>
    r.fulfill({ json: { sidebarCollapsed } }),
  );
  await page.route("**/api/dashboard", async (r) => {
    if (r.request().method() === "POST") {
      const b = r.request().postDataJSON();
      actions.push(b.action);
      if (b.action === "preferences") {
        sidebarCollapsed = b.sidebarCollapsed;
        return r.fulfill({ json: { sidebarCollapsed } });
      }
      expect(b.revision).toBe(revision);
      revision++;
      if (b.action === "check")
        property.checked[b.kind as "regular" | "deep"] = b.checked
          ? [b.index]
          : [];
      if (b.action === "content") {
        if (b.kind === "regular") property.regular = b.items;
        else if (b.kind === "faqs") property.faqs = b.items;
      }
      if (b.action === "property")
        Object.assign(property, {
          name: b.name,
          phone: b.phone,
          notes: b.notes,
        });
      if (b.action === "reset") property.checked.regular = [];
    }
    return r.fulfill({ json: { revision, data: { properties: [property] } } });
  });
  await page.route("**/api/calendar**", async (r) => {
    const url = new URL(r.request().url());
    if (r.request().method() === "POST") {
      const b = r.request().postDataJSON();
      actions.push(b.action);
      if (b.action === "seen") seen = true;
      if (b.action === "update")
        calendars = calendars.map((c) => c.id === b.id ? ({
          ...c,
          ...b,
          status: b.enabled ? "Connected" : "Paused",
        }) : c);
      if (b.action === "connect")
        calendars.push({ ...calendars[0], id: "calendar-2", name: b.name, propertyId: b.propertyId });
      if (b.action === "remove")
        calendars = calendars.filter((c) => c.id !== b.id);
      return r.fulfill({
        json:
          b.action === "refresh"
            ? { results: [{ ok: true }], nextOffset: null }
            : { ok: true },
      });
    }
    if (url.searchParams.get("action") === "subscription")
      return r.fulfill({
        json: { url: "https://example.com/private-test.ics" },
      });
    const month = url.searchParams.get("month") || "2026-09";
    return r.fulfill({
      json: {
        state: calendars.length ? "connected" : "not-connected",
        timeZone: "Europe/London",
        calendars,
        bookings: calendars.length
          ? [
              {
                id: "calendar-1:stay",
                property: "Test property",
                source: "Airbnb",
                sourceKey: "airbnb",
                guests: 3,
                isNew: !seen,
                arrival: { date: month + "-03", time: "15:00" },
                checkout: { date: month + "-18", time: "10:00" },
              },
            ]
          : [],
      },
    });
  });
  return actions;
}
