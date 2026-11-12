/** Markdown-Format Version 3: Export und toleranter Import. */

import { GROUP_LABELS, UNITS } from "./catalog.js";
import { finalizeState } from "./migrate.js";
import { cleanName, cleanText, isValidDate, sessionDisplayOrder, uid } from "./util.js";

export const IMPORT_EMPTY_ERROR =
  'Keine Übungen oder Sessions gefunden. Prüfe, ob die Datei die Abschnitte "## Übungen" und "## Sessions" enthält.';

const GROUP_TO_LABEL = GROUP_LABELS;

function parseGroup(value) {
  const s = String(value ?? "").trim().toLowerCase();
  if (s.startsWith("gerät") || s.startsWith("geraet")) return "geraet";
  if (s.startsWith("funktion")) return "funktional";
  if (s.startsWith("eigen")) return "eigene";
  return "eigene";
}

function parseUnit(value) {
  const s = String(value ?? "").trim().toLowerCase();
  if (s === "kg" || s.startsWith("gewicht")) return "kg";
  if (s === "wdh" || s.startsWith("wiederhol")) return "Wdh";
  if (s === "sek" || s.includes("sek")) return "Sek";
  if (s === "min" || s.includes("min")) return "Min";
  return "kg";
}

function sectionOf(title) {
  const t = title.trim().toLowerCase();
  if (t === "übungen" || t === "uebungen") return "exercises";
  if (t === "vorlagen") return "templates";
  if (t === "sessions") return "sessions";
  return "other";
}

export function serialize(state) {
  const lines = ["# Trainingstagebuch", "", "Format: Markdown v3", "Version: 3", "", "## Übungen", ""];
  for (const ex of state.exercises || []) {
    lines.push(`### ${cleanName(ex.name)}`);
    lines.push(`- Typ: ${GROUP_TO_LABEL[ex.group] || "Eigene"}`);
    lines.push(`- Einheit: ${UNITS.includes(ex.unit) ? ex.unit : "kg"}`);
    lines.push(`- Einstellung: ${cleanText(ex.setting)}`);
    lines.push(`- Ausführung: ${cleanText(ex.plan)}`);
    lines.push(`- Notiz: ${cleanText(ex.note)}`);
    lines.push(`- Video: ${cleanText(ex.video)}`);
    lines.push("");
  }
  lines.push("## Vorlagen", "");
  const exercises = state.exercises || [];
  for (const tpl of state.templates || []) {
    lines.push(`### ${cleanName(tpl.name)}`);
    const minutes = Number.isFinite(tpl.minutes) ? tpl.minutes : 60;
    lines.push(`- Dauer: ${minutes} Min`);
    for (const id of tpl.exIds || []) {
      const ex = exercises.find((item) => item.id === id);
      if (ex) lines.push(`- ${cleanName(ex.name)}`);
    }
    lines.push("");
  }
  lines.push("## Sessions", "");
  for (const { session } of sessionDisplayOrder(state.sessions || [])) {
    const entries = (session.entries || []).filter((entry) => String(entry.value ?? "").trim() !== "");
    lines.push(`### ${session.date}`);
    for (const entry of entries) {
      const ex = exercises.find((item) => item.id === entry.exId);
      if (!ex) continue;
      lines.push(`- ${cleanName(ex.name)}: ${cleanText(entry.value)}`);
    }
    lines.push("");
  }
  return lines.join("\n").replace(/\n+$/, "\n");
}

export function importSummary(stats) {
  const num = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  let msg = `Importiert: ${num(stats.exercises, "Übung", "Übungen")}, ${num(stats.templates, "Vorlage", "Vorlagen")}, ${num(stats.sessions, "Session", "Sessions")}.`;
  const extra = [];
  if (stats.skipped) extra.push(`${stats.skipped} übersprungen`);
  if (stats.created) extra.push(`${stats.created} angelegt`);
  if (stats.discarded) extra.push(`${stats.discarded} verworfen`);
  if (extra.length) msg += ` ${extra.join(", ")}.`;
  return msg;
}

export function importMarkdown(text, idFactory = uid) {
  const src = String(text ?? "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = src.split("\n");
  let version = null;
  let section = null;
  let sawTemplates = false;
  let current = null;
  let skipped = 0;
  const exerciseDrafts = [];
  const templateDrafts = [];
  const sessionDrafts = [];
  const seenNames = new Set();

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const versionMatch = line.match(/^version:\s*(\d+)\s*$/i);
    if (versionMatch) {
      version = Number(versionMatch[1]);
      continue;
    }
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      section = sectionOf(h2[1]);
      if (section === "templates") sawTemplates = true;
      current = null;
      continue;
    }
    const h3 = line.match(/^###\s+(.+)$/);
    if (h3 && section && section !== "other") {
      const name = h3[1].trim();
      if (section === "exercises") {
        const key = name.toLowerCase();
        if (!name || seenNames.has(key)) {
          current = null;
          continue;
        }
        seenNames.add(key);
        current = { name, group: "eigene", unit: "kg", setting: "", note: "", video: "" };
        exerciseDrafts.push(current);
      } else if (section === "templates") {
        current = { name, minutes: 60, hasDuration: false, exerciseNames: [] };
        templateDrafts.push(current);
      } else if (section === "sessions") {
        if (!isValidDate(name)) {
          skipped += 1;
          current = null;
        } else {
          current = { date: name, entries: [] };
          sessionDrafts.push(current);
        }
      }
      continue;
    }
    if (!current || !line.startsWith("-")) continue;
    const body = line.replace(/^-\s*/, "");
    if (section === "exercises") {
      const field = body.match(/^([^:]+):\s*(.*)$/);
      if (!field) continue;
      const key = field[1].trim().toLowerCase();
      const val = field[2].trim();
      if (key === "typ") current.group = parseGroup(val);
      else if (key === "einheit") current.unit = parseUnit(val);
      else if (key === "einstellung") current.setting = val;
      else if (key === "ausführung" || key === "ausfuehrung") current.plan = val;
      else if (key === "notiz") current.note = val;
      else if (key === "video") current.video = val;
      else if (key === "ersatz für" || key === "ersatz fuer") current.replaces = val;
    } else if (section === "templates") {
      const dauer = body.match(/^dauer:\s*(\d+)\s*min/i);
      if (dauer) {
        current.minutes = Number(dauer[1]);
        current.hasDuration = true;
      } else if (body.trim()) {
        current.exerciseNames.push(body.trim());
      }
    } else if (section === "sessions") {
      const field = body.match(/^(.+?):\s*(.*)$/);
      if (!field) continue;
      const value = field[2].trim();
      if (!value) continue;
      current.entries.push({ name: field[1].trim(), value });
    }
  }

  if (exerciseDrafts.length === 0 && sessionDrafts.length === 0) {
    return { ok: false, error: IMPORT_EMPTY_ERROR };
  }

  const exercises = [];
  const byName = new Map();
  let created = 0;

  function addExercise(draft, { countCreate = false } = {}) {
    const key = draft.name.trim().toLowerCase();
    if (!key) return null;
    if (byName.has(key)) return byName.get(key);
    const ex = {
      id: idFactory("ex"),
      name: draft.name.trim(),
      group: draft.group || "eigene",
      unit: draft.unit || "kg",
      setting: draft.setting || "",
      note: draft.note || "",
      video: draft.video || "",
    };
    if (Object.prototype.hasOwnProperty.call(draft, "plan")) ex.plan = draft.plan;
    if (Object.prototype.hasOwnProperty.call(draft, "replaces")) ex.replaces = draft.replaces;
    exercises.push(ex);
    byName.set(key, ex);
    if (countCreate) created += 1;
    return ex;
  }

  for (const draft of exerciseDrafts) addExercise(draft);

  const sessions = [];
  for (const draft of [...sessionDrafts].reverse()) {
    const entries = [];
    for (const entry of draft.entries) {
      let ex = byName.get(entry.name.trim().toLowerCase());
      if (!ex) ex = addExercise({ name: entry.name, group: "eigene", unit: "kg" }, { countCreate: true });
      if (!ex) continue;
      entries.push({ exId: ex.id, value: entry.value });
    }
    sessions.push({ date: draft.date, entries });
  }

  let discarded = 0;
  let templates = [];
  if (sawTemplates) {
    templates = templateDrafts.map((draft) => {
      const exIds = [];
      for (const name of draft.exerciseNames) {
        const ex = byName.get(name.trim().toLowerCase());
        if (!ex) discarded += 1;
        else exIds.push(ex.id);
      }
      return {
        id: idFactory("tpl"),
        name: draft.name.trim() || "Vorlage",
        minutes: draft.hasDuration ? draft.minutes : 60,
        exIds,
      };
    });
  }

  const data = {
    ver: version == null ? 0 : version,
    exercises,
    templates,
    sessions,
    draft: null,
    dirty: true,
    lastExport: "",
  };
  const { state } = finalizeState(data, { idFactory, synthesizeTemplates: !sawTemplates });
  return {
    ok: true,
    data: state,
    stats: {
      exercises: state.exercises.length,
      templates: state.templates.length,
      sessions: state.sessions.length,
      skipped,
      created,
      discarded,
    },
  };
}
