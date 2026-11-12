/** Idempotente Migrationen (Spezifikation Abschnitt 10). */

import {
  GROUPS,
  NOTEBACK,
  OLD_HOTEL_OHNE,
  TEMPLATES,
  UNITS,
  findCatalog,
  makeExercise,
  prevOf,
  standardTemplates,
} from "./catalog.js";
import { isValidDate, sameName, uid } from "./util.js";

function usedInSessions(exId, sessions) {
  return (sessions || []).some((session) =>
    (session.entries || []).some((entry) => entry && entry.exId === exId),
  );
}

export function ensureKniebeugen(exercises, idFactory = uid) {
  if (exercises.some((ex) => sameName(ex.name, "Kniebeugen"))) return false;
  const cat = findCatalog("Kniebeugen");
  exercises.push(
    cat
      ? makeExercise(cat, idFactory("ex"))
      : {
          id: idFactory("ex"),
          name: "Kniebeugen",
          group: "funktional",
          unit: "Wdh",
          setting: "",
          plan: "3 × max. Wdh",
          note: "Füße schulterbreit, Rücken gerade, Knie folgen den Fußspitzen, Oberschenkel mindestens waagerecht.",
          video: "",
        },
  );
  return true;
}

export function migrateExercises(exercises, sessions) {
  let changed = false;
  for (const ex of exercises) {
    if (Object.prototype.hasOwnProperty.call(ex, "replaces")) {
      delete ex.replaces;
      changed = true;
    }
    if (typeof ex.plan !== "string") {
      const cat = findCatalog(ex.name);
      ex.plan = cat ? cat.plan : "";
      changed = true;
      if (cat && ex.unit === "kg" && cat.unit !== "kg" && !usedInSessions(ex.id, sessions)) {
        ex.unit = cat.unit;
      }
    }
    if (!GROUPS.includes(ex.group)) {
      ex.group = "eigene";
      changed = true;
    }
    if (!UNITS.includes(ex.unit)) {
      ex.unit = "kg";
      changed = true;
    }
    if (typeof ex.setting !== "string") {
      ex.setting = "";
      changed = true;
    }
    if (typeof ex.note !== "string") {
      ex.note = "";
      changed = true;
    }
    if (typeof ex.video !== "string") {
      ex.video = "";
      changed = true;
    }
    if (typeof ex.name !== "string") {
      ex.name = "";
      changed = true;
    }
    if (!ex.id) {
      ex.id = uid("ex");
      changed = true;
    }
  }
  return changed;
}

function sameNameSet(a, b) {
  if (a.length !== b.length) return false;
  const left = a.map((name) => name.toLowerCase()).sort();
  const right = b.map((name) => name.toLowerCase()).sort();
  return left.every((name, index) => name === right[index]);
}

export function migrateV3(data, idFactory = uid) {
  if (!Array.isArray(data.exercises)) data.exercises = [];
  if (!Array.isArray(data.sessions)) data.sessions = [];
  if (!Array.isArray(data.templates)) data.templates = [];
  ensureKniebeugen(data.exercises, idFactory);
  for (const ex of data.exercises) {
    const prev = prevOf(ex.name);
    const cat = findCatalog(ex.name);
    if (!prev || !cat) continue;
    if (ex.unit === prev.unit && ex.plan === prev.plan) {
      ex.plan = cat.plan;
      if (!usedInSessions(ex.id, data.sessions)) ex.unit = cat.unit;
      if (NOTEBACK.includes(ex.note)) ex.note = cat.note;
    }
  }
  const hotel = data.templates.find((tpl) => sameName(tpl.name, "Hotel ohne Hanteln"));
  if (hotel && Array.isArray(hotel.exIds)) {
    const names = hotel.exIds
      .map((id) => data.exercises.find((ex) => ex.id === id))
      .filter(Boolean)
      .map((ex) => ex.name);
    if (sameNameSet(names, OLD_HOTEL_OHNE)) {
      const target = TEMPLATES.find((tpl) => tpl.name === "Hotel ohne Hanteln");
      hotel.exIds = target.exercises
        .map((name) => data.exercises.find((ex) => sameName(ex.name, name)))
        .filter(Boolean)
        .map((ex) => ex.id);
    }
  }
  data.ver = 3;
  return data;
}

function normalizeSessions(data) {
  let changed = false;
  if (!Array.isArray(data.sessions)) {
    data.sessions = [];
    return true;
  }
  const next = [];
  for (const session of data.sessions) {
    if (!session || !isValidDate(session.date)) {
      changed = true;
      continue;
    }
    const entries = [];
    const raw = Array.isArray(session.entries) ? session.entries : [];
    if (!Array.isArray(session.entries)) changed = true;
    for (const entry of raw) {
      if (!entry || !entry.exId) {
        changed = true;
        continue;
      }
      const value = entry.value == null ? "" : String(entry.value);
      if (value !== entry.value) changed = true;
      entries.push({ exId: String(entry.exId), value });
    }
    next.push({ date: session.date, entries });
  }
  data.sessions = next;
  return changed;
}

function dropDangling(data) {
  let changed = false;
  const ids = new Set(data.exercises.map((ex) => ex.id));
  for (const tpl of data.templates) {
    const exIds = (tpl.exIds || []).filter((id) => ids.has(id));
    if (!Array.isArray(tpl.exIds) || exIds.length !== tpl.exIds.length) {
      tpl.exIds = exIds;
      changed = true;
    }
  }
  for (const session of data.sessions) {
    const entries = session.entries.filter((entry) => ids.has(entry.exId));
    if (entries.length !== session.entries.length) {
      session.entries = entries;
      changed = true;
    }
  }
  const kept = data.sessions.filter((session) => session.entries.length > 0);
  if (kept.length !== data.sessions.length) {
    data.sessions = kept;
    changed = true;
  }
  if (data.draft && Array.isArray(data.draft.entries)) {
    const entries = data.draft.entries.filter((entry) => entry && ids.has(entry.exId));
    if (entries.length !== data.draft.entries.length) {
      data.draft.entries = entries;
      changed = true;
    }
  }
  return changed;
}

/**
 * Ergänzt fehlende Felder und lässt die Migrationen laufen.
 * `synthesizeTemplates`: Vorlagenabschnitt bzw. Feld fehlte → Standardvorlagen.
 * Gibt zurück, ob sich gegenüber dem bereits vorbereiteten Objekt etwas geändert hat,
 * das der Aufrufer noch nicht selbst gesetzt hat. Der Aufrufer übergibt ein Objekt,
 * dessen Ausgangszustand er kennt; wir melden jede echte Korrektur.
 */
export function finalizeState(data, { idFactory = uid, synthesizeTemplates = false } = {}) {
  let changed = false;
  if (!data || typeof data !== "object") throw new Error("Zustand ungültig");
  if (!Array.isArray(data.exercises)) {
    data.exercises = [];
    changed = true;
  }
  if (!Array.isArray(data.templates)) {
    data.templates = [];
    changed = true;
  }
  if (normalizeSessions(data)) changed = true;

  const version = data.ver;
  if (version !== 3) {
    migrateV3(data, idFactory);
    changed = true;
  } else if (ensureKniebeugen(data.exercises, idFactory)) {
    changed = true;
  }
  if (migrateExercises(data.exercises, data.sessions)) changed = true;

  if (synthesizeTemplates) {
    data.templates = standardTemplates(data.exercises, idFactory);
    changed = true;
  }

  for (const tpl of data.templates) {
    if (!tpl.id) {
      tpl.id = idFactory("tpl");
      changed = true;
    }
    if (typeof tpl.name !== "string" || !tpl.name.trim()) {
      tpl.name = "Vorlage";
      changed = true;
    }
    if (!Array.isArray(tpl.exIds)) {
      tpl.exIds = [];
      changed = true;
    }
    if (typeof tpl.minutes !== "number" || !Number.isFinite(tpl.minutes)) {
      const n = Number(tpl.minutes);
      tpl.minutes = Number.isFinite(n) ? n : 60;
      changed = true;
    }
  }

  if (data.draft == null) {
    if (data.draft !== null) {
      data.draft = null;
      changed = true;
    }
  } else if (typeof data.draft !== "object" || !Array.isArray(data.draft.entries)) {
    data.draft = null;
    changed = true;
  } else {
    if (typeof data.draft.date !== "string") {
      data.draft.date = "";
      changed = true;
    }
    if (typeof data.draft.editIdx !== "number" || !Number.isFinite(data.draft.editIdx)) {
      data.draft.editIdx = -1;
      changed = true;
    }
    for (const entry of data.draft.entries) {
      if (!entry || typeof entry !== "object") continue;
      if (typeof entry.value !== "string") {
        entry.value = entry.value == null ? "" : String(entry.value);
        changed = true;
      }
    }
  }

  if (dropDangling(data)) changed = true;

  if (typeof data.dirty !== "boolean") {
    data.dirty = true;
    changed = true;
  }
  if (typeof data.lastExport !== "string") {
    data.lastExport = "";
    changed = true;
  }
  if (data.ver !== 3) {
    data.ver = 3;
    changed = true;
  }
  return { state: data, changed };
}
