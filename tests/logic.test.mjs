import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  CATALOG,
  EXPREV,
  NOTEBACK,
  OLD_HOTEL_OHNE,
  TEMPLATES,
  findCatalog,
  seedState,
} from "../js/catalog.js";
import { IMPORT_EMPTY_ERROR, importMarkdown, serialize } from "../js/markdown.js";
import { ensureKniebeugen, finalizeState, migrateExercises, migrateV3 } from "../js/migrate.js";
import { STORAGE_KEY, loadFromStorage, saveToStorage } from "../js/store.js";
import { disp, formatDeNumber, isValidDate, parseDeNumber, plusTwoPointFive, sessionDisplayOrder } from "../js/util.js";

function ids() {
  let n = 0;
  return (prefix = "id") => `${prefix}-${++n}`;
}

function project(data) {
  const nameOf = (id) => data.exercises.find((ex) => ex.id === id)?.name;
  return {
    exercises: data.exercises.map((ex) => ({
      name: ex.name,
      group: ex.group,
      unit: ex.unit,
      setting: ex.setting,
      plan: ex.plan,
      note: ex.note,
      video: ex.video,
    })),
    templates: data.templates.map((tpl) => ({
      name: tpl.name,
      minutes: tpl.minutes,
      exercises: tpl.exIds.map(nameOf),
    })),
    sessions: sessionDisplayOrder(data.sessions).map(({ session }) => ({
      date: session.date,
      entries: session.entries.map((entry) => ({ name: nameOf(entry.exId), value: entry.value })),
    })),
  };
}

function memoryStorage(initial) {
  const map = new Map(initial ? Object.entries(initial) : []);
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

test("Katalog: 27 Übungen, 3 Vorlagen à 60 Minuten, keine Sessions", () => {
  assert.equal(CATALOG.length, 27);
  assert.equal(CATALOG.filter((ex) => ex.group === "geraet").length, 11);
  assert.equal(CATALOG.filter((ex) => ex.group === "funktional").length, 16);
  const state = seedState(ids());
  assert.equal(state.exercises.length, 27);
  assert.equal(state.templates.length, 3);
  assert.deepEqual(
    state.templates.map((tpl) => tpl.name),
    ["Fitnessstudio 1", "Hotel", "Hotel ohne Hanteln"],
  );
  for (const tpl of state.templates) assert.equal(tpl.minutes, 60);
  assert.equal(state.templates[0].exIds.length, 8);
  assert.equal(state.sessions.length, 0);
  assert.equal(state.dirty, true);
  assert.equal(state.lastExport, "");
  assert.equal(state.ver, 3);
  const knie = state.exercises.find((ex) => ex.name === "Kniebeugen");
  assert.equal(knie.note, "Füße schulterbreit, Rücken gerade, Knie folgen den Fußspitzen, Oberschenkel mindestens waagerecht.");
  assert.equal(findCatalog("goblet squat").unit, "kg");
});

test("Export und Import sind rund und stabil, Dezimalkomma bleibt", () => {
  const state = seedState(ids());
  const ruecken = state.exercises.find((ex) => ex.name === "Rückenstreckgerät");
  const bauch = state.exercises.find((ex) => ex.name === "Bauchpressgerät");
  const knee = state.exercises.find((ex) => ex.name === "Vertical Knee Raise");
  state.sessions.push(
    { date: "2026-10-14", entries: [{ exId: ruecken.id, value: "45" }] },
    { date: "2026-10-29", entries: [{ exId: ruecken.id, value: "50" }, { exId: bauch.id, value: "37,5" }] },
    { date: "2026-10-29", entries: [{ exId: knee.id, value: "14 | 10 | 9" }] },
  );
  const renamed = state.exercises.find((ex) => ex.name === "Butterfly");
  renamed.name = "Test: Name";
  renamed.note = "Zeile 1\nZeile 2";
  const md = serialize(state);
  assert.match(md, /^# Trainingstagebuch\n/);
  assert.match(md, /Version: 3/);
  assert.ok(md.indexOf("## Übungen") < md.indexOf("## Vorlagen"));
  assert.ok(md.indexOf("## Vorlagen") < md.indexOf("## Sessions"));
  assert.match(md, /### Test - Name/);
  assert.match(md, /- Notiz: Zeile 1 Zeile 2/);
  assert.match(md, /- Bauchpressgerät: 37,5/);
  assert.match(md, /- Vertical Knee Raise: 14 \| 10 \| 9/);
  const later = md.indexOf("14 | 10 | 9");
  const earlier = md.indexOf("- Rückenstreckgerät: 50");
  const older = md.indexOf("### 2026-10-14");
  assert.ok(later < earlier && earlier < older);

  const imported = importMarkdown(md, ids());
  assert.equal(imported.ok, true);
  assert.deepEqual(project(imported.data), project({ ...state, exercises: state.exercises.map((ex) => ({ ...ex, name: ex.name === "Test: Name" ? "Test - Name" : ex.name, note: ex.note.includes("\n") ? "Zeile 1 Zeile 2" : ex.note })) }));
  assert.equal(serialize(imported.data), md);
});

test("Alter Import ohne Version, Ausführung, mit Ort und Ersatz für", () => {
  const md = `# Trainingstagebuch

Format: alt

## Übungen

### Rückenstreckgerät
- Typ: Gerät
- Einheit: kg
- Einstellung: Rückenpolster 3 | Startposition 3
- Ort: Studio
- Ersatz für: Kurzhantel

### Goblet Squat
- Typ: Funktional
- Einheit: Wdh
- Ausführung: 3 × 12–15 Wdh
- Notiz: Summe aller Sätze eintragen.

### Wandsitzen
- Typ: Funktional
- Einheit: kg

## Sessions

### 2026-10-29
- Rückenstreckgerät: 50
- Unbekannte Übung: 12,5

### 2026-13-40
- Rückenstreckgerät: 1

### 2026-02-31
- Rückenstreckgerät: 2
`;
  const result = importMarkdown(md, ids());
  assert.equal(result.ok, true);
  const ruecken = result.data.exercises.find((ex) => ex.name === "Rückenstreckgerät");
  assert.equal(ruecken.plan, "3 × 15 Wdh");
  assert.equal(ruecken.replaces, undefined);
  assert.equal(ruecken.setting, "Rückenpolster 3 | Startposition 3");
  const goblet = result.data.exercises.find((ex) => ex.name === "Goblet Squat");
  assert.equal(goblet.unit, "kg");
  assert.equal(goblet.plan, "3 × 12 Wdh");
  assert.equal(goblet.note, findCatalog("Goblet Squat").note);
  const wand = result.data.exercises.find((ex) => ex.name === "Wandsitzen");
  assert.equal(wand.unit, "Sek");
  assert.equal(wand.plan, "3 × max. Sek");
  const unknown = result.data.exercises.find((ex) => ex.name === "Unbekannte Übung");
  assert.equal(unknown.group, "eigene");
  assert.equal(unknown.unit, "kg");
  assert.ok(result.data.exercises.some((ex) => ex.name === "Kniebeugen"));
  assert.equal(result.stats.skipped, 2);
  assert.equal(result.stats.created, 1);
  assert.equal(result.data.sessions.length, 1);
  assert.equal(result.data.sessions[0].entries[1].value, "12,5");
  assert.deepEqual(
    result.data.templates.map((tpl) => tpl.name),
    ["Fitnessstudio 1", "Hotel", "Hotel ohne Hanteln"],
  );
  assert.equal(result.data.ver, 3);
});

test("Einheitenwechsel unterbleibt, wenn die Übung schon in einer Session steht", () => {
  const md = `Version: 2

## Übungen

### Goblet Squat
- Typ: Funktional
- Einheit: Wdh
- Ausführung: 3 × 12–15 Wdh
- Notiz: Gewicht je Hand.

## Sessions

### 2024-02-29
- Goblet Squat: 10
`;
  const result = importMarkdown(md, ids());
  const goblet = result.data.exercises.find((ex) => ex.name === "Goblet Squat");
  assert.equal(goblet.unit, "Wdh");
  assert.equal(goblet.plan, "3 × 12 Wdh");
  assert.equal(goblet.note, findCatalog("Goblet Squat").note);
  assert.equal(result.data.sessions.length, 1);
  assert.equal(isValidDate("2024-02-29"), true);
  assert.equal(isValidDate("2026-02-29"), false);
});

test("Version 3 behält eine angepasste Ausführung", () => {
  const md = `Version: 3

## Übungen

### Goblet Squat
- Typ: Funktional
- Einheit: kg
- Ausführung: 3 × 8 Wdh

### Kniebeugen
- Typ: Funktional
- Einheit: Wdh
- Ausführung: 3 × max. Wdh

## Sessions

### 2026-01-02
- Goblet Squat: 20
`;
  const result = importMarkdown(md, ids());
  assert.equal(result.data.exercises.find((ex) => ex.name === "Goblet Squat").plan, "3 × 8 Wdh");
  assert.equal(result.data.exercises.find((ex) => ex.name === "Goblet Squat").unit, "kg");
});

test("Migrationen sind idempotent", () => {
  const id = ids();
  const exercises = [
    {
      id: id("ex"),
      name: "Plank",
      group: "funktional",
      unit: "Wdh",
      plan: "3 × max. Wdh",
      setting: "",
      note: "Summe aller Sätze eintragen.",
      video: "",
      replaces: "irgendwas",
    },
  ];
  const data = {
    ver: 1,
    exercises,
    templates: [
      {
        id: id("tpl"),
        name: "Hotel ohne Hanteln",
        minutes: undefined,
        exIds: [],
      },
    ],
    sessions: [],
    dirty: false,
  };
  const plank = exercises[0];
  data.templates[0].exIds = OLD_HOTEL_OHNE.map((name) => {
    if (name === "Plank") return plank.id;
    const cat = findCatalog(name);
    const ex = {
      id: id("ex"),
      name: cat.name,
      group: cat.group,
      unit: cat.unit,
      plan: cat.plan,
      setting: cat.setting,
      note: cat.note,
      video: "",
    };
    exercises.push(ex);
    return ex.id;
  });
  migrateExercises(data.exercises, data.sessions);
  assert.equal(plank.replaces, undefined);
  const first = ensureKniebeugen(data.exercises, id);
  assert.equal(first, true);
  assert.equal(ensureKniebeugen(data.exercises, id), false);
  migrateV3(data, id);
  const snap = structuredClone(data);
  migrateV3(data, id);
  assert.deepEqual(data, snap);
  snap.draft = null;
  snap.lastExport = "";
  snap.dirty = false;
  snap.templates.find((tpl) => tpl.name === "Hotel ohne Hanteln").minutes = 60;
  const finalized = finalizeState(structuredClone(snap), { idFactory: id });
  assert.equal(finalized.changed, false);
  assert.equal(finalized.state.templates.find((tpl) => tpl.name === "Hotel ohne Hanteln").minutes, 60);
  const names = finalized.state.templates
    .find((tpl) => tpl.name === "Hotel ohne Hanteln")
    .exIds.map((exId) => finalized.state.exercises.find((ex) => ex.id === exId).name);
  assert.deepEqual(names, TEMPLATES[2].exercises);
  assert.equal(finalized.state.exercises.find((ex) => ex.name === "Plank").unit, "Sek");
  assert.equal(NOTEBACK.length, 2);
  assert.ok(EXPREV["Goblet Squat"]);
});

test("Defekte Datei liefert die genaue Fehlermeldung und ändert nichts", () => {
  const before = seedState(ids());
  const snapshot = structuredClone(before);
  const result = importMarkdown("Das ist keine Datei.\n## Vorlagen\n### Hotel\n- Dauer: 60 Min\n", ids());
  assert.equal(result.ok, false);
  assert.equal(result.error, IMPORT_EMPTY_ERROR);
  assert.equal(
    result.error,
    'Keine Übungen oder Sessions gefunden. Prüfe, ob die Datei die Abschnitte "## Übungen" und "## Sessions" enthält.',
  );
  assert.deepEqual(before, snapshot);
});

test("Fehlender Vorlagenabschnitt erzeugt die Standardvorlagen, Vorlage ohne Dauer hat 60 Min", () => {
  const md = `## Übungen

### Kniebeugen
- Typ: Funktional
- Einheit: Wdh
- Ausführung: 3 × max. Wdh

## Sessions

### 2026-05-01
- Kniebeugen: 30
`;
  const result = importMarkdown(md, ids());
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.data.templates.map((tpl) => tpl.name),
    ["Fitnessstudio 1", "Hotel", "Hotel ohne Hanteln"],
  );
  assert.ok(result.data.templates.every((tpl) => tpl.minutes === 60));
});

test("Unbekannter Vorlagen-Eintrag wird verworfen, leere Dauer wird 60", () => {
  const md = `## Übungen

### Kniebeugen
- Typ: Funktional
- Einheit: Wdh
- Ausführung: 3 × max. Wdh

## Vorlagen

### Kurz
- Kniebeugen
- Gibt es nicht

## Sessions

### 2026-05-02
- Kniebeugen: 10
`;
  const result = importMarkdown(md, ids());
  assert.equal(result.stats.discarded, 1);
  const kurz = result.data.templates.find((tpl) => tpl.name === "Kurz");
  assert.equal(kurz.minutes, 60);
  assert.equal(kurz.exIds.length, 1);
});

test("Speicher: leer ergibt Seed, Migration setzt dirty, zweiter Lauf ist ruhig", () => {
  const fresh = memoryStorage();
  const first = loadFromStorage(fresh, ids());
  assert.equal(first.empty, true);
  assert.equal(first.state.exercises.length, 27);
  assert.equal(first.state.sessions.length, 0);
  saveToStorage(fresh, first.state);
  const second = loadFromStorage(fresh, ids());
  assert.equal(second.changed, false);
  assert.equal(second.state.dirty, true);
  assert.equal(second.state.exercises.length, 27);

  const legacy = memoryStorage();
  legacy.setItem(STORAGE_KEY, JSON.stringify({ ver: 2, exercises: [], sessions: [] }));
  const migrated = loadFromStorage(legacy, ids());
  assert.equal(migrated.changed, true);
  assert.equal(migrated.state.dirty, true);
  assert.equal(migrated.state.ver, 3);
  assert.ok(migrated.state.exercises.some((ex) => ex.name === "Kniebeugen"));
  assert.equal(migrated.state.templates.length, 3);

  const broken = memoryStorage();
  broken.setItem(STORAGE_KEY, "{");
  const recovered = loadFromStorage(broken, ids());
  assert.equal(recovered.state.exercises.length, 27);

  const throwing = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
  };
  const denied = loadFromStorage(throwing, ids());
  assert.equal(denied.available, false);
  assert.equal(denied.state.sessions.length, 0);
});

test("Zahlen, Daten, Anzeige", () => {
  assert.equal(parseDeNumber("37,5"), 37.5);
  assert.equal(parseDeNumber("50"), 50);
  assert.equal(parseDeNumber("14 | 10 | 9"), null);
  assert.equal(plusTwoPointFive("50"), "52,5");
  assert.equal(plusTwoPointFive("37,5"), "40");
  assert.equal(formatDeNumber(52.5), "52,5");
  assert.equal(disp("37.5"), "37,5");
  assert.equal(disp("14 | 10 | 9"), "14 | 10 | 9");
  assert.equal(isValidDate("2026-13-40"), false);
  assert.equal(isValidDate("2026-11-11"), true);
});

test("Quellen: keine Dialoge, keine externen Laufzeit-URLs, relative Pfade", () => {
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name === ".git" || name === "fonts" || name === "tests" || name === "playwright.config.js") continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(html|css|js|webmanifest)$/.test(name)) files.push(path);
    }
  };
  walk(".");
  assert.ok(files.includes(join("js", "app.js")));
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    assert.doesNotMatch(text, /\balert\s*\(/, file);
    assert.doesNotMatch(text, /\bconfirm\s*\(/, file);
    assert.doesNotMatch(text, /\bprompt\s*\(/, file);
    assert.doesNotMatch(text, /fonts\.googleapis|googletagmanager|google-analytics/, file);
    const urls = text.match(/https?:\/\/[^\s"'`)]+/g) || [];
    for (const url of urls) {
      assert.ok(url.startsWith("https://www.youtube.com/results?search_query="), `${url} in ${file}`);
    }
  }
  const html = readFileSync("index.html", "utf8");
  assert.match(html, /href="css\/app\.css"/);
  assert.match(html, /src="js\/app\.js"/);
  assert.match(html, /href="manifest\.webmanifest"/);
  assert.doesNotMatch(html, /(?:src|href)="\//);
  const css = readFileSync("css/app.css", "utf8");
  assert.match(css, /'Barlow Condensed','Roboto Condensed','HelveticaNeue-CondensedBold',sans-serif-condensed,'Arial Narrow',sans-serif/);
  const manifest = JSON.parse(readFileSync("manifest.webmanifest", "utf8"));
  assert.equal(manifest.name, "Trainingstagebuch");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.lang, "de");
  assert.equal(manifest.background_color, "#eceff1");
  assert.equal(manifest.theme_color, "#eceff1");
  const sw = readFileSync("sw.js", "utf8");
  assert.match(sw, /trainingstagebuch-v1/);
  assert.match(sw, /\/js\/app\.js/);
  assert.equal(readFileSync("fonts/OFL.txt", "utf8").includes("SIL OPEN FONT LICENSE"), true);
});
