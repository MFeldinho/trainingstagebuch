import { expect, test } from "@playwright/test";

const STUDIO = [
  "Rückenstreckgerät",
  "Bauchpressgerät",
  "Schulterdrücken",
  "Enges Rudern",
  "Butterfly",
  "45°-Beinpresse",
  "Beinstrecken",
  "Trizepsdrücken",
];

function trackErrors(page) {
  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (/favicon|manifest|Failed to load resource/i.test(text)) return;
    errors.push(text);
  });
  return errors;
}

async function openApp(page, { width = 390, height = 844, theme = "light" } = {}) {
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ colorScheme: theme });
  await page.goto("/");
  await page.evaluate(() => {
    try {
      localStorage.clear();
    } catch {
      /* Speicher kann gesperrt sein */
    }
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Trainingstagebuch" })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

async function todayParts(page) {
  return page.evaluate(() => {
    const date = new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return { iso: `${y}-${m}-${d}`, short: `${d}.${m}.` };
  });
}

async function expectNoOverflow(page) {
  await page.evaluate(() => document.fonts.ready);
  const result = await page.evaluate(() => {
    const doc = document.documentElement;
    const vw = doc.clientWidth;
    const nodes = [...document.querySelectorAll("main button, main a, main input, main select, main textarea")].filter(
      (el) => !el.matches("input[type=file], .sr"),
    );
    const clipped = nodes
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return false;
        return rect.right > vw + 1 || rect.left < -1;
      })
      .map((el) => (el.getAttribute("aria-label") || el.textContent || el.id || "").trim().slice(0, 80));
    const navClipped = [...document.querySelectorAll(".tabbar button")]
      .filter((el) => el.scrollWidth > el.clientWidth + 1)
      .map((el) => el.textContent);
    return { overflow: doc.scrollWidth - vw, clipped, navClipped };
  });
  expect(result.overflow, "horizontal overflow").toBeLessThanOrEqual(1);
  expect(result.clipped, "clipped controls").toEqual([]);
  expect(result.navClipped, "nav labels").toEqual([]);
}

test("Erststart: 27 Übungen, 3 Vorlagen, 0 Sessions, nicht exportiert", async ({ page }) => {
  const errors = trackErrors(page);
  await openApp(page);
  await expect(page.locator("#export-status")).toHaveText("Nicht exportiert");
  await expect(page.getByRole("button", { name: "Wie am" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Fitnessstudio 1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hotel ohne Hanteln" })).toBeVisible();
  await expect(page.getByRole("button", { name: /60 Min/ })).toHaveCount(3);
  await page.locator(".tabbar").getByRole("button", { name: "Übungen", exact: true }).click();
  await expect(page.locator("#ex-count")).toHaveText("27 Übungen");
  await expect(page.locator(".ex-row")).toHaveCount(27);
  await page.getByRole("button", { name: "Verlauf" }).click();
  await expect(page.getByText("Noch keine Session")).toBeVisible();
  expect(errors).toEqual([]);
});

test("Session aus Vorlage, Eintrag, +2,5 und Speichern", async ({ page }) => {
  await openApp(page);
  const today = await todayParts(page);
  await page.getByRole("button", { name: "Fitnessstudio 1" }).click();
  await expect(page.locator("#session-date")).toHaveValue(today.iso);
  await expect(page.locator(".entry-card h3")).toHaveText(STUDIO);
  await expect(page.getByText("noch kein Vorwert").first()).toBeVisible();
  await page.getByRole("button", { name: "Session speichern" }).click();
  await expect(page.locator("#toast")).toHaveText("Trage mindestens einen Wert ein.");
  await page.getByRole("button", { name: "Verlauf" }).click();
  await expect(page.getByText("Noch keine Session")).toBeVisible();

  await page.getByRole("button", { name: "Session" }).click();
  await page.getByLabel("Rückenstreckgerät (kg)").fill("50");
  await page.getByLabel("Bauchpressgerät (kg)").fill("37,5");
  await page.getByLabel("Schulterdrücken (kg)").fill("12,5");
  await page.getByRole("button", { name: "Session speichern" }).click();
  await expect(page.locator("#toast")).toHaveText(
    "Session gespeichert (5 Übungen ohne Wert ausgelassen). Jetzt exportieren.",
  );
  await expect(page.locator("#export-status")).toHaveText("Nicht exportiert");

  await page.getByRole("button", { name: "Fitnessstudio 1" }).click();
  await expect(page.getByText(`zuletzt 50 kg (${today.short})`)).toBeVisible();
  await page.locator(".entry-card", { hasText: "Rückenstreckgerät" }).getByRole("button", { name: "Plus 2,5 kg" }).click();
  await expect(page.getByLabel("Rückenstreckgerät (kg)")).toHaveValue("52,5");
  await page.reload();
  await expect(page.getByLabel("Rückenstreckgerät (kg)")).toHaveValue("52,5");
  await expect(page.getByLabel("Bauchpressgerät (kg)")).toHaveValue("");
  await page.getByRole("button", { name: "Session speichern" }).click();
  await page.getByRole("button", { name: "Verlauf" }).click();
  await expect(page.getByText("52,5")).toBeVisible();
  await expect(page.getByRole("button", { name: "Bearbeiten" })).toHaveCount(2);
});

test("Bearbeiten überschreibt, ein laufender Entwurf blockiert", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: "Leere Session" }).click();
  await page.getByRole("button", { name: "Übung hinzufügen" }).click();
  await page.getByRole("button", { name: "Kniebeugen" }).click();
  await page.getByLabel("Kniebeugen (Wdh)").fill("20");
  await page.getByRole("button", { name: "Session speichern" }).click();
  await page.getByRole("button", { name: "Verlauf" }).click();
  await page.getByRole("button", { name: "Bearbeiten" }).click();
  await expect(page.getByText("Du bearbeitest die Session vom")).toBeVisible();
  await page.getByLabel("Kniebeugen (Wdh)").fill("21");
  await page.getByRole("button", { name: "Session speichern" }).click();
  await page.getByRole("button", { name: "Verlauf" }).click();
  await expect(page.getByText("Kniebeugen — 21")).toBeVisible();
  await expect(page.getByRole("button", { name: "Bearbeiten" })).toHaveCount(1);

  await page.getByRole("button", { name: "Session" }).click();
  await page.getByRole("button", { name: "Leere Session" }).click();
  await page.getByRole("button", { name: "Verlauf" }).click();
  await page.getByRole("button", { name: "Bearbeiten" }).click();
  await expect(page.locator("#toast")).toHaveText("Es läuft schon eine Session. Speichere oder verwirf sie zuerst.");
  await expect(page.getByRole("button", { name: "Bearbeiten" })).toHaveCount(1);
});

test("Suche behält die Cursorposition, Filter und bereits gewählte Übungen", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: "Leere Session" }).click();
  await page.getByRole("button", { name: "Übung hinzufügen" }).click();
  const search = page.locator("#search-picker");
  await search.fill("Hp");
  await search.evaluate((el) => el.setSelectionRange(1, 1));
  await search.press("i");
  await expect(search).toHaveValue("Hip");
  expect(await search.evaluate((el) => el.selectionStart)).toBe(2);
  await expect(page.getByRole("button", { name: "Hip Abductor" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Rückenstreckgerät" })).toHaveCount(0);
  await search.fill("");
  await page.getByRole("button", { name: "Geräte", exact: true }).click();
  await expect(page.getByRole("button", { name: "Goblet Squat" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Hip Abductor" })).toBeVisible();
  await page.getByRole("button", { name: "Alle", exact: true }).click();
  await page.getByRole("button", { name: "Hip Abductor" }).click();
  await page.getByRole("button", { name: "Übung hinzufügen" }).click();
  await expect(page.getByRole("button", { name: "Hip Abductor" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Kniebeugen" })).toBeVisible();
});

test("Spontane Übung mit Zeit (Sek) landet im Entwurf und unter Eigene", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: "Leere Session" }).click();
  await page.getByRole("button", { name: "Übung hinzufügen" }).click();
  await page.locator("#new-ex-name").fill("Seilspringen");
  await page.locator("#new-ex-unit").selectOption("Sek");
  await page.getByRole("button", { name: "Neue Übung anlegen" }).click();
  await expect(page.locator("#toast")).toHaveText("Übung angelegt.");
  await expect(page.getByRole("heading", { name: "Seilspringen" })).toBeVisible();
  await expect(page.getByText("3 × max. Sek")).toBeVisible();
  await expect(page.getByText("Eigene").first()).toBeVisible();
  await page.getByRole("button", { name: "Übungen" }).click();
  await page.getByRole("button", { name: "Eigene", exact: true }).click();
  await expect(page.getByRole("button", { name: "Seilspringen" })).toBeVisible();
  await expect(page.locator("#ex-count")).toHaveText("28 Übungen");
});

test("Übung löschen braucht zwei Klicks und räumt Vorlagen, Sessions und Entwurf auf", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: "Fitnessstudio 1" }).click();
  await page.getByLabel("Rückenstreckgerät (kg)").fill("40");
  await page.getByRole("button", { name: "Session speichern" }).click();
  await page.getByRole("button", { name: "Fitnessstudio 1" }).click();
  await expect(page.getByRole("heading", { name: "Rückenstreckgerät" })).toBeVisible();
  await page.getByRole("button", { name: "Übungen" }).click();
  await page.getByRole("button", { name: "Rückenstreckgerät" }).click();
  await page.getByRole("button", { name: "Übung löschen" }).click();
  await expect(page.getByRole("heading", { name: "Übung" })).toBeVisible();
  await expect(page.locator("#ex-count")).toHaveCount(0);
  await page.getByRole("button", { name: "Wirklich löschen?" }).click();
  await expect(page.locator("#ex-count")).toHaveText("26 Übungen");
  await expect(page.getByRole("button", { name: "Rückenstreckgerät" })).toHaveCount(0);
  await page.getByRole("button", { name: "Session" }).click();
  await expect(page.getByRole("heading", { name: "Rückenstreckgerät" })).toHaveCount(0);
  await page.getByRole("button", { name: "Vorlagen" }).click();
  await page.getByRole("button", { name: "Fitnessstudio 1" }).click();
  await expect(page.locator(".tpl-row")).toHaveCount(7);
  await expect(page.getByText("Rückenstreckgerät")).toHaveCount(0);
  await page.getByRole("button", { name: "Verlauf" }).click();
  await expect(page.getByText("Rückenstreckgerät")).toHaveCount(0);
});

test("Vorlage: Richtwert, Dauer, Reihenfolge, Start übernimmt die Reihe", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: "Vorlagen" }).click();
  await page.getByRole("button", { name: "Fitnessstudio 1" }).click();
  await expect(page.getByText("Richtwert bei 8 Übungen: ca. 58 Min")).toBeVisible();
  await page.locator("#tpl-minutes").fill("45");
  const row = page.locator(".tpl-row", { hasText: "Rückenstreckgerät" });
  await row.getByRole("button", { name: "Nach unten" }).click();
  await expect(page.locator(".tpl-row .name").first()).toHaveText("Bauchpressgerät");
  await page.getByRole("button", { name: "Zurück" }).click();
  await expect(page.getByRole("button", { name: /ca\. 45 Min/ })).toBeVisible();
  await page.getByRole("button", { name: "Session" }).click();
  await page.getByRole("button", { name: "Fitnessstudio 1" }).click();
  await expect(page.locator(".entry-card h3").nth(0)).toHaveText("Bauchpressgerät");
  await expect(page.locator(".entry-card h3").nth(1)).toHaveText("Rückenstreckgerät");
});

test("Export, Zurücksetzen und Import per Text, defekte Datei bleibt ohne Wirkung", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: "Leere Session" }).click();
  await page.getByRole("button", { name: "Übung hinzufügen" }).click();
  await page.getByRole("button", { name: "Plank" }).click();
  await page.getByLabel("Plank (Sek)").fill("60");
  await page.getByRole("button", { name: "Session speichern" }).click();
  await page.getByRole("button", { name: "Daten" }).click();
  await page.getByText("Markdown ansehen").click();
  const markdown = await page.getByLabel("Exportierte Markdown-Daten").inputValue();
  expect(markdown).toContain("Version: 3");
  expect(markdown).toContain("- Plank: 60");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Als Datei speichern" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("trainingstagebuch.md");
  await expect(page.locator("#export-status")).toHaveText("Exportiert");

  await page.getByRole("button", { name: "Auf Startdaten zurücksetzen" }).click();
  await page.getByRole("button", { name: "Wirklich zurücksetzen?" }).click();
  await page.getByRole("button", { name: "Verlauf" }).click();
  await expect(page.getByText("Noch keine Session")).toBeVisible();

  await page.getByRole("button", { name: "Daten" }).click();
  await page.getByLabel("oder Text einfügen").fill("das ist keine datei");
  await page.getByRole("button", { name: "Importieren" }).click();
  await page.getByRole("button", { name: "Ja, alle Daten ersetzen" }).click();
  await expect(page.locator("#import-status")).toHaveText(
    'Keine Übungen oder Sessions gefunden. Prüfe, ob die Datei die Abschnitte "## Übungen" und "## Sessions" enthält.',
  );
  await page.getByRole("button", { name: "Übungen" }).click();
  await expect(page.locator("#ex-count")).toHaveText("27 Übungen");

  await page.getByRole("button", { name: "Daten" }).click();
  await page.getByLabel("oder Text einfügen").fill(markdown);
  await page.getByRole("button", { name: "Importieren" }).click();
  await page.getByRole("button", { name: "Ja, alle Daten ersetzen" }).click();
  await expect(page.locator("#import-status")).toContainText("Importiert:");
  await page.getByRole("button", { name: "Verlauf" }).click();
  await expect(page.getByText("Plank — 60")).toBeVisible();
});

test("Import per Datei", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: "Daten" }).click();
  const markdown = [
    "# Trainingstagebuch",
    "Version: 3",
    "",
    "## Übungen",
    "",
    "### Kniebeugen",
    "- Typ: Funktional",
    "- Einheit: Wdh",
    "- Ausführung: 3 × max. Wdh",
    "",
    "## Sessions",
    "",
    "### 2026-03-01",
    "- Kniebeugen: 15",
    "",
  ].join("\n");
  await page.locator("#import-file").setInputFiles({
    name: "trainingstagebuch.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(markdown),
  });
  await expect(page.getByText("Gewählt: trainingstagebuch.md")).toBeVisible();
  await page.getByRole("button", { name: "Importieren" }).click();
  await page.getByRole("button", { name: "Ja, alle Daten ersetzen" }).click();
  await page.getByRole("button", { name: "Verlauf" }).click();
  await expect(page.getByText("Kniebeugen — 15")).toBeVisible();
});

test("Zwischenablage kopiert Markdown", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openApp(page);
  await page.getByRole("button", { name: "Daten" }).click();
  await page.getByRole("button", { name: "In Zwischenablage kopieren" }).click();
  await expect(page.locator("#export-status")).toHaveText("Exportiert");
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text.startsWith("# Trainingstagebuch")).toBe(true);
  expect(text).toContain("Version: 3");
  expect(text).toContain("## Übungen");
});

test("Layout ohne horizontale Scrollbar in Hell und Dunkel", async ({ page }) => {
  test.setTimeout(120000);
  const errors = trackErrors(page);
  for (const theme of ["light", "dark"]) {
    for (const width of [390, 360, 320]) {
      await openApp(page, { width, height: 700, theme });
      await expectNoOverflow(page);
      await page.getByRole("button", { name: "Fitnessstudio 1" }).click();
      await expectNoOverflow(page);
      await page.getByRole("button", { name: "Übung hinzufügen" }).click();
      await expectNoOverflow(page);
      await page.getByRole("button", { name: "Schließen" }).click();
      await page.getByRole("button", { name: "Übungen" }).click();
      await page.getByRole("button", { name: "Rückenstreckgerät" }).click();
      await expectNoOverflow(page);
      await page.getByRole("button", { name: "Vorlagen" }).click();
      await page.getByRole("button", { name: /^Hotel 8/ }).click();
      await expectNoOverflow(page);
      await page.getByRole("button", { name: "Verlauf" }).click();
      await expectNoOverflow(page);
      await page.getByRole("button", { name: "Daten" }).click();
      await page.getByText("Markdown ansehen").click();
      await expectNoOverflow(page);
    }
  }
  expect(errors).toEqual([]);
});

test("data-theme erzwingt Hell und Dunkel unabhängig vom System", async ({ page }) => {
  await openApp(page, { theme: "light" });
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(16, 20, 23)");
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(236, 239, 241)");
  await page.getByRole("button", { name: "Daten" }).click();
  const accent = await page.locator(".btn.primary").evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(accent).toBe("rgb(163, 75, 0)");
});

test("funktioniert, wenn localStorage wirft", async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });
  });
  await openApp(page);
  await expect(page.locator("#storage-hint")).toBeVisible();
  await page.getByRole("button", { name: "Leere Session" }).click();
  await page.getByRole("button", { name: "Übung hinzufügen" }).click();
  await page.getByRole("button", { name: "Plank" }).click();
  await page.getByLabel("Plank (Sek)").fill("30");
  await expect(page.getByLabel("Plank (Sek)")).toHaveValue("30");
  await page.getByRole("button", { name: "Session speichern" }).click();
  await expect(page.locator("#toast")).toContainText("Session gespeichert");
  expect(errors).toEqual([]);
});

test("Mobile-Ansichten Hell und Dunkel", async ({ page }) => {
  await openApp(page, { width: 390, height: 844, theme: "light" });
  await page.getByRole("button", { name: "Fitnessstudio 1" }).click();
  await page.screenshot({ path: "test-results/session-light.png" });
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(16, 20, 23)");
  await page.screenshot({ path: "test-results/session-dark.png" });
});
