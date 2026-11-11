import {
  FILTERS,
  GROUP_LABELS,
  UNIT_LABELS,
  UNITS,
  defaultPlan,
  richtwert,
  seedState,
} from "./catalog.js";
import { importMarkdown, importSummary, serialize } from "./markdown.js";
import { loadFromStorage, saveToStorage } from "./store.js";
import {
  disp,
  domId,
  esc,
  formatDE,
  formatLongDate,
  formatShortDate,
  isValidDate,
  plusTwoPointFive,
  sameName,
  sessionDisplayOrder,
  todayISO,
  uid,
  videoUrl,
} from "./util.js";

const CONFIRM_LABEL = {
  discard: "Wirklich verwerfen?",
  "delete-exercise": "Wirklich löschen?",
  "delete-template": "Wirklich löschen?",
  "delete-session": "Wirklich löschen?",
  reset: "Wirklich zurücksetzen?",
  import: "Ja, alle Daten ersetzen",
};

const NORMAL_LABEL = {
  discard: "Verwerfen",
  "delete-exercise": "Übung löschen",
  "delete-template": "Vorlage löschen",
  "delete-session": "Löschen",
  reset: "Auf Startdaten zurücksetzen",
  import: "Importieren",
};

const ui = {
  tab: "session",
  picker: null,
  pickerFilter: "alle",
  pickQuery: "",
  exFilter: "alle",
  exQuery: "",
  exerciseId: null,
  templateId: null,
  creating: false,
  confirm: null,
  newName: "",
  newUnit: "kg",
  newTpl: "",
  nameBuffer: null,
  tplBuffer: null,
  dupToastFor: "",
  importText: "",
  importFileText: "",
  importFileName: "",
  importStatus: "",
  showMarkdown: false,
};

let state = seedState();
let storage = null;
let writable = false;
let pendingFocus = null;
let toastTimer = 0;

const main = document.getElementById("main");

function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function initStorage() {
  const ls = browserStorage();
  if (!ls) return;
  let canWrite = false;
  try {
    ls.setItem("trainingstagebuch.probe", "1");
    ls.removeItem("trainingstagebuch.probe");
    canWrite = true;
  } catch {
    canWrite = false;
  }
  let loaded;
  try {
    loaded = loadFromStorage(ls);
  } catch {
    return;
  }
  if (!loaded.available) return;
  storage = ls;
  writable = canWrite;
  state = loaded.state;
  if (writable && (loaded.empty || loaded.changed)) {
    try {
      saveToStorage(ls, state);
    } catch {
      writable = false;
    }
  }
}

function persist() {
  if (!storage || !writable) return;
  try {
    saveToStorage(storage, state);
  } catch {
    writable = false;
    updateChrome();
  }
}

function toast(message) {
  const el = document.getElementById("toast");
  el.hidden = false;
  el.textContent = message;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    el.hidden = true;
    el.textContent = "";
  }, 2600);
}

function updateChrome() {
  const badge = document.getElementById("export-status");
  const dirty = state.dirty !== false;
  badge.textContent = dirty ? "Nicht exportiert" : "Exportiert";
  badge.className = dirty ? "badge warn" : "badge ok";
  const hint = document.getElementById("storage-hint");
  if (!writable) {
    hint.hidden = false;
    hint.textContent =
      "Speicher nicht verfügbar. Bitte exportieren, sonst sind die Daten nur bis zum Schließen des Tabs da.";
  } else {
    hint.hidden = true;
    hint.textContent = "";
  }
  for (const btn of document.querySelectorAll(".tabbar button")) {
    if (btn.dataset.tab === ui.tab) btn.setAttribute("aria-current", "page");
    else btn.removeAttribute("aria-current");
  }
}

function render(options = {}) {
  const focus = pendingFocus;
  pendingFocus = null;
  main.innerHTML = view();
  updateChrome();
  if (options.scroll) window.scrollTo(0, 0);
  if (!focus || !focus.id) return;
  const el = document.getElementById(focus.id);
  if (!el) return;
  try {
    el.focus({ preventScroll: true });
  } catch {
    el.focus();
  }
  if (typeof focus.start === "number" && typeof el.setSelectionRange === "function") {
    try {
      el.setSelectionRange(focus.start, focus.end);
    } catch {
      /* Datumsfelder */
    }
  }
}

function rememberFocus(el) {
  if (!el || !el.id) return;
  pendingFocus = {
    id: el.id,
    start: typeof el.selectionStart === "number" ? el.selectionStart : null,
    end: typeof el.selectionEnd === "number" ? el.selectionEnd : null,
  };
}

function exerciseById(id) {
  return state.exercises.find((ex) => ex.id === id) || null;
}

function templateById(id) {
  return state.templates.find((tpl) => tpl.id === id) || null;
}

function metaOf(ex) {
  return [ex.setting, ex.plan].filter(Boolean).join(" · ");
}

function countNoun(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

function matches(ex, filter, query) {
  if (filter === "geraet" && ex.group !== "geraet") return false;
  if (filter === "funktional" && ex.group !== "funktional") return false;
  if (filter === "eigene" && ex.group !== "eigene") return false;
  const q = query.trim().toLowerCase();
  if (q && !ex.name.toLowerCase().includes(q)) return false;
  return true;
}

function lastPerformance(exId) {
  const exclude = state.draft && state.draft.editIdx >= 0 ? state.draft.editIdx : -1;
  for (const item of sessionDisplayOrder(state.sessions)) {
    if (item.index === exclude) continue;
    const entry = item.session.entries.find((en) => en.exId === exId && String(en.value).trim() !== "");
    if (entry) return { value: entry.value, date: item.session.date };
  }
  return null;
}

function chips(filter, action) {
  return `<div class="chips">${FILTERS.map(
    ([id, label]) =>
      `<button type="button" class="chip" data-action="${action}" data-id="${id}" aria-pressed="${filter === id ? "true" : "false"}">${label}</button>`,
  ).join("")}</div>`;
}

function confirmButton(base, id = "", className = "btn danger") {
  const token = id ? `${base}:${id}` : base;
  const armed = ui.confirm === token;
  const label = armed ? CONFIRM_LABEL[base] : NORMAL_LABEL[base];
  return `<button type="button" class="${className}${armed ? " armed" : ""}" data-confirm="${base}" data-id="${esc(id)}">${label}</button>`;
}

function unitOptions(selected) {
  return UNITS.map(
    (unit) => `<option value="${unit}"${unit === selected ? " selected" : ""}>${esc(UNIT_LABELS[unit])}</option>`,
  ).join("");
}

function groupOptions(selected) {
  return ["geraet", "funktional", "eigene"]
    .map(
      (group) =>
        `<option value="${group}"${group === selected ? " selected" : ""}>${esc(GROUP_LABELS[group])}</option>`,
    )
    .join("");
}

function newExerciseFields() {
  return `<div class="stack">
    <label class="field" for="new-ex-name"><span class="lbl">Name</span>
      <input id="new-ex-name" data-field="new-name" type="text" value="${esc(ui.newName)}" autocomplete="off">
    </label>
    <label class="field" for="new-ex-unit"><span class="lbl">Steigerung über (Eintrag)</span>
      <select id="new-ex-unit" data-field="new-unit">${unitOptions(ui.newUnit)}</select>
    </label>
    <button type="button" class="btn" data-action="create-exercise">Neue Übung anlegen</button>
  </div>`;
}

function viewSession() {
  if (ui.picker === "draft") return viewPicker();
  if (!state.draft) {
    const last = sessionDisplayOrder(state.sessions)[0];
    const buttons = state.templates
      .map((tpl) => {
        const sub = `${countNoun(tpl.exIds.length, "Übung", "Übungen")} · ${tpl.minutes} Min`;
        return `<button type="button" class="btn stack tpl-start" data-action="start-template" data-id="${esc(tpl.id)}"><span class="display">${esc(tpl.name)}</span><span class="meta">${sub}</span></button>`;
      })
      .join("");
    const again = last
      ? `<button type="button" class="btn" data-action="start-last">Wie am ${esc(formatDE(last.session.date))} starten</button>`
      : "";
    return `<h2>Session starten</h2>
      <p>Vorlage wählen, leer beginnen oder die letzte Einheit wiederholen.</p>
      <div class="stack">${buttons}
        <button type="button" class="btn" data-action="start-empty">Leere Session</button>
        ${again}
      </div>`;
  }
  const draft = state.draft;
  let banner = "";
  if (draft.editIdx >= 0 && state.sessions[draft.editIdx]) {
    banner = `<p class="banner">Du bearbeitest die Session vom ${esc(formatLongDate(state.sessions[draft.editIdx].date))}.</p>`;
  }
  const cards = draft.entries
    .map((entry) => {
      const ex = exerciseById(entry.exId);
      if (!ex) return "";
      const id = domId("entry", ex.id);
      const last = lastPerformance(ex.id);
      const hint = last
        ? `zuletzt ${disp(last.value)} ${ex.unit} (${formatShortDate(last.date)})`
        : "noch kein Vorwert";
      const bump =
        ex.unit === "kg" && last && plusTwoPointFive(last.value) != null
          ? `<button type="button" class="btn bump" data-action="bump" data-id="${esc(ex.id)}" aria-label="Plus 2,5 kg">+2,5</button>`
          : "";
      return `<article class="card entry-card">
        <div class="card-title">
          <h3>${esc(ex.name)}</h3>
          <span class="gchip">${esc(GROUP_LABELS[ex.group] || "Eigene")}</span>
        </div>
        ${metaOf(ex) ? `<p class="meta">${esc(metaOf(ex))}</p>` : ""}
        <div class="value-row">
          <label class="sr" for="${id}">${esc(ex.name)} (${esc(ex.unit)})</label>
          <input id="${id}" data-field="entry" data-id="${esc(ex.id)}" type="text" inputmode="${ex.unit === "kg" || ex.unit === "Min" ? "decimal" : "numeric"}" autocomplete="off" spellcheck="false" placeholder="${esc(ex.unit)}" value="${esc(entry.value)}">
          ${bump}
        </div>
        <div class="entry-foot">
          <p class="hintline">${esc(hint)}</p>
          <a href="${esc(videoUrl(ex.name, ex.video))}" target="_blank" rel="noopener">Anleitung</a>
          <button type="button" class="btn inline danger" data-action="remove-entry" data-id="${esc(ex.id)}" aria-label="Übung entfernen">Entfernen</button>
        </div>
      </article>`;
    })
    .join("");
  const empty = draft.entries.length === 0 ? `<p>Noch keine Übung in dieser Session.</p>` : "";
  return `${banner}
    <label class="field" for="session-date"><span class="lbl">Datum</span>
      <input id="session-date" data-field="date" type="date" value="${esc(draft.date)}">
    </label>
    <h2>Übungen (${draft.entries.length})</h2>
    <p class="meta">Eintrag: Gewicht in kg, gleich für alle Sätze. Bei Wdh und Sek die Summe aller Sätze.</p>
    ${empty}${cards}
    <div class="stack">
      <button type="button" class="btn" data-action="open-picker">Übung hinzufügen</button>
      <button type="button" class="btn primary" data-action="save-session">Session speichern</button>
      ${confirmButton("discard")}
    </div>`;
}

function viewPicker() {
  const exclude = new Set();
  if (ui.picker === "draft" && state.draft) {
    for (const entry of state.draft.entries) exclude.add(entry.exId);
  }
  if (ui.picker === "template") {
    const tpl = templateById(ui.templateId);
    if (tpl) for (const id of tpl.exIds) exclude.add(id);
  }
  const list = state.exercises.filter((ex) => !exclude.has(ex.id) && matches(ex, ui.pickerFilter, ui.pickQuery));
  const rows = list.length
    ? list
        .map(
          (ex) =>
            `<button type="button" class="row" data-action="add-ex" data-id="${esc(ex.id)}"><span class="grow"><span class="name">${esc(ex.name)}</span><span class="meta">${esc(metaOf(ex))}</span></span><span class="unit">${esc(ex.unit)}</span></button>`,
        )
        .join("")
    : `<p>Keine passende Übung.</p>`;
  return `<div class="spread">
      <h2>Übung hinzufügen</h2>
      <button type="button" class="btn inline" data-action="close-picker">Schließen</button>
    </div>
    ${chips(ui.pickerFilter, "pick-filter")}
    <label class="field" for="search-picker"><span class="lbl">Suche</span>
      <input id="search-picker" data-field="pick-query" type="text" value="${esc(ui.pickQuery)}" autocomplete="off" autocapitalize="off" spellcheck="false">
    </label>
    <div class="stack">${rows}</div>
    <h3 class="plain">Neue Übung</h3>
    ${newExerciseFields()}`;
}

function viewExercises() {
  if (ui.exerciseId && exerciseById(ui.exerciseId)) return viewExerciseEditor();
  ui.exerciseId = null;
  const list = state.exercises.filter((ex) => matches(ex, ui.exFilter, ui.exQuery));
  const rows = list.length
    ? list
        .map(
          (ex) =>
            `<button type="button" class="row ex-row" data-action="edit-exercise" data-id="${esc(ex.id)}"><span class="grow"><span class="name">${esc(ex.name)}</span><span class="meta">${esc(metaOf(ex))}</span></span><span class="unit">${esc(ex.unit)}</span></button>`,
        )
        .join("")
    : `<p>Keine passende Übung.</p>`;
  const form = ui.creating ? newExerciseFields() : "";
  return `<div class="spread">
      <h2>Übungen</h2>
      <button type="button" class="btn inline" data-action="toggle-create">${ui.creating ? "Schließen" : "Neue Übung"}</button>
    </div>
    <p class="meta" id="ex-count">${countNoun(state.exercises.length, "Übung", "Übungen")}</p>
    ${form}
    ${chips(ui.exFilter, "ex-filter")}
    <label class="field" for="search-exercises"><span class="lbl">Suche</span>
      <input id="search-exercises" data-field="ex-query" type="text" value="${esc(ui.exQuery)}" autocomplete="off" autocapitalize="off" spellcheck="false">
    </label>
    <div class="stack">${rows}</div>`;
}

function viewExerciseEditor() {
  const ex = exerciseById(ui.exerciseId);
  if (!ex) return viewExercises();
  const nameValue = ui.nameBuffer != null ? ui.nameBuffer : ex.name;
  return `<button type="button" class="btn inline" data-action="close-editor">Zurück</button>
    <h2>Übung</h2>
    <label class="field" for="ex-name"><span class="lbl">Name</span>
      <input id="ex-name" data-field="ex-name" type="text" value="${esc(nameValue)}" autocomplete="off">
    </label>
    <label class="field" for="ex-group"><span class="lbl">Gruppe</span>
      <select id="ex-group" data-field="ex-group">${groupOptions(ex.group)}</select>
    </label>
    <label class="field" for="ex-unit"><span class="lbl">Steigerung über (Eintrag)</span>
      <select id="ex-unit" data-field="ex-unit">${unitOptions(ex.unit)}</select>
    </label>
    <label class="field" for="ex-plan"><span class="lbl">Ausführung (Sätze × Wiederholungen)</span>
      <input id="ex-plan" data-field="ex-plan" type="text" placeholder="z. B. 3 × 10–12 Wdh" value="${esc(ex.plan)}">
    </label>
    <label class="field" for="ex-setting"><span class="lbl">Einstellung (Gerät)</span>
      <input id="ex-setting" data-field="ex-setting" type="text" value="${esc(ex.setting)}">
    </label>
    <label class="field" for="ex-note"><span class="lbl">Notiz</span>
      <textarea id="ex-note" data-field="ex-note">${esc(ex.note)}</textarea>
    </label>
    <label class="field" for="ex-video"><span class="lbl">Video-URL</span>
      <input id="ex-video" data-field="ex-video" type="text" inputmode="url" placeholder="eigene Adresse, sonst YouTube" value="${esc(ex.video)}" autocomplete="off">
    </label>
    <p class="meta">Leer lassen für die YouTube-Suche.</p>
    <p><a id="ex-video-link" href="${esc(videoUrl(ex.name, ex.video))}" target="_blank" rel="noopener">Anleitung</a></p>
    ${confirmButton("delete-exercise", ex.id)}`;
}

function viewTemplates() {
  if (ui.picker === "template") return viewPicker();
  if (ui.templateId) return viewTemplateEditor();
  const cards = state.templates
    .map((tpl) => {
      const sub = `${countNoun(tpl.exIds.length, "Übung", "Übungen")} · ca. ${tpl.minutes} Min`;
      return `<button type="button" class="btn stack" data-action="edit-template" data-id="${esc(tpl.id)}"><span class="display">${esc(tpl.name)}</span><span class="meta">${sub}</span></button>`;
    })
    .join("");
  return `<h2>Vorlagen</h2>
    <div class="stack">${cards}</div>
    <label class="field" for="new-tpl-name"><span class="lbl">Name</span>
      <input id="new-tpl-name" data-field="new-tpl" type="text" value="${esc(ui.newTpl)}" autocomplete="off">
    </label>
    <button type="button" class="btn" data-action="create-template">Neue Vorlage</button>`;
}

function viewTemplateEditor() {
  const tpl = templateById(ui.templateId);
  if (!tpl) return `<h2>Vorlagen</h2>`;
  const nameValue = ui.tplBuffer != null ? ui.tplBuffer : tpl.name;
  const rows = tpl.exIds
    .map((id) => {
      const ex = exerciseById(id);
      if (!ex) return "";
      return `<div class="tpl-row">
        <span class="name">${esc(ex.name)}</span>
        <button type="button" class="icon-btn" data-action="move-up" data-id="${esc(id)}" aria-label="Nach oben">↑</button>
        <button type="button" class="icon-btn" data-action="move-down" data-id="${esc(id)}" aria-label="Nach unten">↓</button>
        <button type="button" class="icon-btn danger" data-action="remove-tpl-ex" data-id="${esc(id)}" aria-label="Entfernen">✕</button>
      </div>`;
    })
    .join("");
  const minutes = tpl.minutes === 0 ? "" : String(tpl.minutes);
  return `<button type="button" class="btn inline" data-action="close-template">Zurück</button>
    <h2>Vorlage</h2>
    <label class="field" for="tpl-name"><span class="lbl">Name</span>
      <input id="tpl-name" data-field="tpl-name" type="text" value="${esc(nameValue)}" autocomplete="off">
    </label>
    <label class="field" for="tpl-minutes"><span class="lbl">Dauer in Minuten</span>
      <input id="tpl-minutes" data-field="tpl-minutes" type="text" inputmode="numeric" value="${esc(minutes)}">
    </label>
    <p class="meta">${esc(richtwertText(tpl.exIds.length))}</p>
    <div class="stack">${rows || "<p>Noch keine Übung in dieser Vorlage.</p>"}</div>
    <button type="button" class="btn" data-action="open-picker">Übung hinzufügen</button>
    ${confirmButton("delete-template", tpl.id)}`;
}

function richtwertText(n) {
  return `Richtwert bei ${n} ${n === 1 ? "Übung" : "Übungen"}: ca. ${richtwert(n)} Min (10 Min Aufwärmen, 6 Min je Übung mit drei Sätzen und Pausen).`;
}

function viewHistory() {
  const ordered = sessionDisplayOrder(state.sessions);
  if (!ordered.length) {
    return `<h2>Verlauf</h2><p>Noch keine Session. Starte eine Einheit im Tab Session.</p>`;
  }
  const cards = ordered
    .map(({ session, index }) => {
      const lines = session.entries
        .map((entry) => {
          const ex = exerciseById(entry.exId);
          if (!ex) return "";
          return `<li>${esc(ex.name)} — ${esc(disp(entry.value))}</li>`;
        })
        .join("");
      return `<article class="card">
        <h3 class="plain">${esc(formatLongDate(session.date))}</h3>
        <ul class="log">${lines}</ul>
        <div class="btn-row">
          <button type="button" class="btn" data-action="edit-session" data-id="${index}">Bearbeiten</button>
          ${confirmButton("delete-session", String(index), "btn danger")}
        </div>
      </article>`;
    })
    .join("");
  return `<h2>Verlauf</h2>${cards}`;
}

function viewData() {
  const dirty = state.dirty !== false;
  const stamp = state.lastExport
    ? `<p class="meta">Letzter Export: ${esc(formatStamp(state.lastExport))}</p>`
    : "";
  const md = serialize(state);
  return `<section class="panel">
      <div class="spread">
        <h2>Export</h2>
        <span class="badge ${dirty ? "warn" : "ok"}">${dirty ? "Nicht exportiert" : "Exportiert"}</span>
      </div>
      <p>Der Export ist deine Sicherung. Nach jeder Session als Datei speichern und in den Projektdateien ablegen.</p>
      ${stamp}
      <p class="meta">Auf dem Handy öffnet „Als Datei speichern“ das Teilen-Menü mit der Datei trainingstagebuch.md. Sonst wird die Datei heruntergeladen.</p>
      <div class="stack">
        <button type="button" class="btn primary" data-action="save-file">Als Datei speichern</button>
        <button type="button" class="btn" data-action="copy">In Zwischenablage kopieren</button>
      </div>
      <details ${ui.showMarkdown ? "open" : ""}>
        <summary>Markdown ansehen</summary>
        <textarea readonly aria-label="Exportierte Markdown-Daten">${esc(md)}</textarea>
      </details>
    </section>
    <section class="panel">
      <h2>Import</h2>
      <p>Ersetzt alle Daten in dieser App durch den Inhalt der Markdown-Datei.</p>
      <label class="btn file-btn">Datei wählen
        <input id="import-file" type="file" accept=".md,.txt,text/markdown,text/plain">
      </label>
      ${ui.importFileName ? `<p class="meta">Gewählt: ${esc(ui.importFileName)}</p>` : ""}
      <label class="field" for="import-text"><span class="lbl">oder Text einfügen</span>
        <textarea id="import-text" data-field="import-text" placeholder="# Trainingstagebuch …">${esc(ui.importText)}</textarea>
      </label>
      ${confirmButton("import", "", "btn danger")}
      <p id="import-status" role="status">${esc(ui.importStatus)}</p>
    </section>
    <section class="panel">
      <h2>Zurücksetzen</h2>
      <p>Setzt die App auf den Übungskatalog und die drei Standardvorlagen zurück. Eigene Übungen, Vorlagenänderungen und alle Sessions werden gelöscht.</p>
      ${confirmButton("reset", "", "btn danger")}
    </section>`;
}

function formatStamp(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("de-DE");
}

function view() {
  if (ui.tab === "session") return viewSession();
  if (ui.tab === "exercises") return viewExercises();
  if (ui.tab === "templates") return viewTemplates();
  if (ui.tab === "history") return viewHistory();
  return viewData();
}

function startDraft(entries) {
  state.draft = { date: todayISO(), entries, editIdx: -1 };
  ui.picker = null;
  persist();
  render({ scroll: true });
}

function saveSession() {
  const draft = state.draft;
  if (!draft) return;
  if (!isValidDate(draft.date)) {
    toast("Bitte ein gültiges Datum wählen.");
    return;
  }
  const filled = draft.entries.filter((entry) => String(entry.value).trim() !== "");
  if (!filled.length) {
    toast("Trage mindestens einen Wert ein.");
    return;
  }
  const omitted = draft.entries.length - filled.length;
  const session = {
    date: draft.date,
    entries: filled.map((entry) => ({ exId: entry.exId, value: String(entry.value).trim() })),
  };
  if (draft.editIdx >= 0 && state.sessions[draft.editIdx]) state.sessions[draft.editIdx] = session;
  else state.sessions.push(session);
  state.draft = null;
  state.dirty = true;
  ui.picker = null;
  persist();
  toast(
    omitted > 0
      ? `Session gespeichert (${omitted} ${omitted === 1 ? "Übung" : "Übungen"} ohne Wert ausgelassen). Jetzt exportieren.`
      : "Session gespeichert. Jetzt exportieren.",
  );
  render({ scroll: true });
}

function createExercise() {
  const name = ui.newName.trim();
  if (!name) {
    toast("Bitte einen Namen eingeben.");
    render();
    return;
  }
  if (state.exercises.some((ex) => sameName(ex.name, name))) {
    toast("Diese Übung gibt es schon.");
    render();
    return;
  }
  const unit = UNITS.includes(ui.newUnit) ? ui.newUnit : "kg";
  const group = ui.picker && ui.pickerFilter === "funktional" ? "funktional" : "eigene";
  const ex = {
    id: uid("ex"),
    name,
    group,
    unit,
    setting: "",
    plan: defaultPlan(unit),
    note: "",
    video: "",
  };
  state.exercises.push(ex);
  state.dirty = true;
  ui.newName = "";
  ui.newUnit = "kg";
  if (ui.picker === "draft" && state.draft) state.draft.entries.push({ exId: ex.id, value: "" });
  else if (ui.picker === "template") {
    const tpl = templateById(ui.templateId);
    if (tpl) tpl.exIds.push(ex.id);
  } else {
    ui.creating = false;
    ui.exerciseId = ex.id;
  }
  ui.picker = null;
  persist();
  toast("Übung angelegt.");
  render({ scroll: true });
}

function createTemplate() {
  const name = ui.newTpl.trim();
  if (!name) {
    toast("Bitte einen Namen eingeben.");
    render();
    return;
  }
  state.templates.push({ id: uid("tpl"), name, minutes: 60, exIds: [] });
  state.dirty = true;
  ui.newTpl = "";
  ui.templateId = state.templates[state.templates.length - 1].id;
  persist();
  render({ scroll: true });
}

function deleteExercise(id) {
  const editing = state.draft && state.draft.editIdx >= 0 ? state.sessions[state.draft.editIdx] : null;
  state.exercises = state.exercises.filter((ex) => ex.id !== id);
  for (const tpl of state.templates) tpl.exIds = tpl.exIds.filter((exId) => exId !== id);
  for (const session of state.sessions) session.entries = session.entries.filter((entry) => entry.exId !== id);
  state.sessions = state.sessions.filter((session) => session.entries.length > 0);
  if (state.draft) {
    state.draft.entries = state.draft.entries.filter((entry) => entry.exId !== id);
    if (editing) {
      const next = state.sessions.indexOf(editing);
      if (next === -1) state.draft = null;
      else state.draft.editIdx = next;
    }
  }
  if (ui.exerciseId === id) ui.exerciseId = null;
  ui.nameBuffer = null;
  state.dirty = true;
  persist();
  toast("Übung gelöscht.");
  render({ scroll: true });
}

function deleteTemplate(id) {
  state.templates = state.templates.filter((tpl) => tpl.id !== id);
  if (ui.templateId === id) ui.templateId = null;
  state.dirty = true;
  persist();
  toast("Vorlage gelöscht.");
  render({ scroll: true });
}

function deleteSession(index) {
  if (!state.sessions[index]) return;
  state.sessions.splice(index, 1);
  if (state.draft && state.draft.editIdx >= 0) {
    if (state.draft.editIdx === index) state.draft = null;
    else if (state.draft.editIdx > index) state.draft.editIdx -= 1;
  }
  state.dirty = true;
  persist();
  toast("Session gelöscht.");
  render();
}

function resetAll() {
  state = seedState();
  ui.picker = null;
  ui.exerciseId = null;
  ui.templateId = null;
  ui.creating = false;
  ui.nameBuffer = null;
  ui.tplBuffer = null;
  ui.importText = "";
  ui.importFileText = "";
  ui.importFileName = "";
  ui.importStatus = "";
  persist();
  toast("Auf Startdaten zurückgesetzt.");
  render({ scroll: true });
}

async function runImport() {
  let text = ui.importText.trim() ? ui.importText : "";
  if (!text) text = ui.importFileText || "";
  if (!text.trim()) {
    const input = document.getElementById("import-file");
    if (input && input.files && input.files[0]) {
      try {
        text = await input.files[0].text();
      } catch {
        text = "";
      }
    }
  }
  if (!text.trim()) {
    ui.importStatus = "Bitte eine Datei wählen oder Text einfügen.";
    toast(ui.importStatus);
    render();
    return;
  }
  const result = importMarkdown(text);
  if (!result.ok) {
    ui.importStatus = result.error;
    toast(result.error);
    render();
    return;
  }
  state = result.data;
  ui.picker = null;
  ui.exerciseId = null;
  ui.templateId = null;
  ui.creating = false;
  ui.nameBuffer = null;
  ui.tplBuffer = null;
  ui.importText = "";
  ui.importFileText = "";
  ui.importFileName = "";
  ui.importStatus = importSummary(result.stats);
  persist();
  toast(ui.importStatus);
  render({ scroll: true });
}

function markExported() {
  state.lastExport = new Date().toISOString();
  state.dirty = false;
  persist();
  toast("Exportiert.");
  render();
}

function downloadMarkdown(md) {
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "trainingstagebuch.md";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function saveFile() {
  const md = serialize(state);
  const file = new File([md], "trainingstagebuch.md", { type: "text/markdown" });
  let shared = false;
  try {
    if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Trainingstagebuch" });
        shared = true;
      } catch (err) {
        if (err && err.name === "AbortError") return;
      }
    }
  } catch {
    shared = false;
  }
  if (!shared) downloadMarkdown(md);
  markExported();
}

async function copyMarkdown() {
  const md = serialize(state);
  try {
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
      throw new Error("kein Clipboard");
    }
    await navigator.clipboard.writeText(md);
    markExported();
  } catch {
    ui.showMarkdown = true;
    toast("Kopieren nicht möglich. Markdown unten markieren und kopieren.");
    render();
  }
}

function updateExerciseField(el) {
  const ex = exerciseById(ui.exerciseId);
  if (!ex) return;
  const field = el.dataset.field;
  if (field === "ex-name") {
    const raw = el.value;
    const key = raw.trim();
    if (!key || state.exercises.some((item) => item.id !== ex.id && sameName(item.name, key))) {
      ui.nameBuffer = raw;
      if (key && ui.dupToastFor !== key.toLowerCase()) {
        ui.dupToastFor = key.toLowerCase();
        toast("Diese Übung gibt es schon.");
      }
      return;
    }
    ui.nameBuffer = null;
    ui.dupToastFor = "";
    ex.name = raw;
    state.dirty = true;
    persist();
    return;
  }
  if (field === "ex-group") ex.group = el.value;
  else if (field === "ex-unit") ex.unit = el.value;
  else if (field === "ex-plan") ex.plan = el.value;
  else if (field === "ex-setting") ex.setting = el.value;
  else if (field === "ex-note") ex.note = el.value;
  else if (field === "ex-video") ex.video = el.value;
  state.dirty = true;
  persist();
}

function updateTemplateField(el) {
  const tpl = templateById(ui.templateId);
  if (!tpl) return;
  if (el.dataset.field === "tpl-name") {
    if (!el.value.trim()) {
      ui.tplBuffer = el.value;
      return;
    }
    ui.tplBuffer = null;
    tpl.name = el.value;
  } else if (el.dataset.field === "tpl-minutes") {
    const raw = el.value.trim();
    if (!raw) tpl.minutes = 0;
    else {
      const n = Number.parseInt(raw, 10);
      tpl.minutes = Number.isFinite(n) && n >= 0 ? n : tpl.minutes;
    }
  }
  state.dirty = true;
  persist();
}

function handleField(el) {
  if (!el || !el.dataset) return;
  rememberFocus(el);
  const field = el.dataset.field || "";
  if (!field) return;
  if (ui.confirm) ui.confirm = null;
  if (field === "ex-query") ui.exQuery = el.value;
  else if (field === "pick-query") ui.pickQuery = el.value;
  else if (field === "entry" && state.draft) {
    const entry = state.draft.entries.find((item) => item.exId === el.dataset.id);
    if (entry) entry.value = el.value;
    persist();
  } else if (field === "date" && state.draft) {
    state.draft.date = el.value;
    persist();
  } else if (field === "new-name") ui.newName = el.value;
  else if (field === "new-unit") ui.newUnit = el.value;
  else if (field === "new-tpl") ui.newTpl = el.value;
  else if (field === "import-text") ui.importText = el.value;
  else if (field.startsWith("ex-")) updateExerciseField(el);
  else if (field.startsWith("tpl-")) updateTemplateField(el);
  render();
}

function runAction(action, btn) {
  const id = btn.dataset.id || "";
  if (action === "start-template") {
    const tpl = templateById(id);
    if (!tpl) return;
    startDraft(tpl.exIds.filter((exId) => exerciseById(exId)).map((exId) => ({ exId, value: "" })));
    return;
  }
  if (action === "start-empty") {
    startDraft([]);
    return;
  }
  if (action === "start-last") {
    const latest = sessionDisplayOrder(state.sessions)[0];
    if (!latest) return;
    startDraft(
      latest.session.entries.filter((entry) => exerciseById(entry.exId)).map((entry) => ({ exId: entry.exId, value: "" })),
    );
    return;
  }
  if (action === "save-session") {
    saveSession();
    return;
  }
  if (action === "open-picker") {
    ui.picker = ui.templateId && ui.tab === "templates" ? "template" : "draft";
    ui.pickerFilter = "alle";
    ui.pickQuery = "";
    ui.newName = "";
    ui.newUnit = "kg";
    render({ scroll: true });
    return;
  }
  if (action === "close-picker") {
    ui.picker = null;
    render();
    return;
  }
  if (action === "pick-filter") {
    ui.pickerFilter = id;
    render();
    return;
  }
  if (action === "ex-filter") {
    ui.exFilter = id;
    render();
    return;
  }
  if (action === "add-ex") {
    if (ui.picker === "draft" && state.draft && !state.draft.entries.some((entry) => entry.exId === id)) {
      state.draft.entries.push({ exId: id, value: "" });
      persist();
    } else if (ui.picker === "template") {
      const tpl = templateById(ui.templateId);
      if (tpl && !tpl.exIds.includes(id)) {
        tpl.exIds.push(id);
        state.dirty = true;
        persist();
      }
    }
    ui.picker = null;
    render();
    return;
  }
  if (action === "remove-entry" && state.draft) {
    state.draft.entries = state.draft.entries.filter((entry) => entry.exId !== id);
    persist();
    render();
    return;
  }
  if (action === "bump" && state.draft) {
    const last = lastPerformance(id);
    const next = last ? plusTwoPointFive(last.value) : null;
    const entry = state.draft.entries.find((item) => item.exId === id);
    if (entry && next != null) {
      entry.value = next;
      persist();
    }
    render();
    return;
  }
  if (action === "create-exercise") {
    createExercise();
    return;
  }
  if (action === "toggle-create") {
    ui.creating = !ui.creating;
    ui.newName = "";
    ui.newUnit = "kg";
    render();
    return;
  }
  if (action === "edit-exercise") {
    ui.exerciseId = id;
    ui.nameBuffer = null;
    ui.dupToastFor = "";
    ui.creating = false;
    render({ scroll: true });
    return;
  }
  if (action === "close-editor") {
    ui.exerciseId = null;
    ui.nameBuffer = null;
    render({ scroll: true });
    return;
  }
  if (action === "edit-template") {
    ui.templateId = id;
    ui.tplBuffer = null;
    ui.picker = null;
    render({ scroll: true });
    return;
  }
  if (action === "close-template") {
    ui.templateId = null;
    ui.tplBuffer = null;
    ui.picker = null;
    render({ scroll: true });
    return;
  }
  if (action === "create-template") {
    createTemplate();
    return;
  }
  if (action === "move-up" || action === "move-down") {
    const tpl = templateById(ui.templateId);
    if (!tpl) return;
    const index = tpl.exIds.indexOf(id);
    const target = index + (action === "move-up" ? -1 : 1);
    if (index < 0 || target < 0 || target >= tpl.exIds.length) return;
    const [item] = tpl.exIds.splice(index, 1);
    tpl.exIds.splice(target, 0, item);
    state.dirty = true;
    persist();
    render();
    return;
  }
  if (action === "remove-tpl-ex") {
    const tpl = templateById(ui.templateId);
    if (!tpl) return;
    tpl.exIds = tpl.exIds.filter((exId) => exId !== id);
    state.dirty = true;
    persist();
    render();
    return;
  }
  if (action === "edit-session") {
    const index = Number(id);
    if (state.draft && state.draft.editIdx !== index) {
      toast("Es läuft schon eine Session. Speichere oder verwirf sie zuerst.");
      return;
    }
    const session = state.sessions[index];
    if (!session) return;
    if (!(state.draft && state.draft.editIdx === index)) {
      state.draft = {
        date: session.date,
        editIdx: index,
        entries: session.entries.map((entry) => ({ exId: entry.exId, value: entry.value })),
      };
      persist();
    }
    ui.tab = "session";
    ui.picker = null;
    render({ scroll: true });
    return;
  }
  if (action === "save-file") {
    saveFile();
    return;
  }
  if (action === "copy") {
    copyMarkdown();
    return;
  }
}

function onClick(event) {
  const btn = event.target.closest("button");
  if (!btn || !main.contains(btn)) {
    if (ui.confirm && !event.target.closest("a")) {
      const target = event.target;
      ui.confirm = null;
      if (target && target.id) {
        pendingFocus = {
          id: target.id,
          start: typeof target.selectionStart === "number" ? target.selectionStart : null,
          end: typeof target.selectionEnd === "number" ? target.selectionEnd : null,
        };
      }
      render();
    }
    return;
  }
  if (btn.dataset.confirm) {
    const token = btn.dataset.id ? `${btn.dataset.confirm}:${btn.dataset.id}` : btn.dataset.confirm;
    if (ui.confirm === token) {
      ui.confirm = null;
      runConfirmed(btn.dataset.confirm, btn.dataset.id || "");
    } else {
      ui.confirm = token;
      render();
    }
    return;
  }
  if (ui.confirm) ui.confirm = null;
  if (btn.dataset.action) runAction(btn.dataset.action, btn);
  else render();
}

function runConfirmed(base, id) {
  if (base === "discard") {
    state.draft = null;
    ui.picker = null;
    persist();
    toast("Entwurf verworfen.");
    render({ scroll: true });
  } else if (base === "delete-exercise") deleteExercise(id);
  else if (base === "delete-template") deleteTemplate(id);
  else if (base === "delete-session") deleteSession(Number(id));
  else if (base === "reset") resetAll();
  else if (base === "import") runImport();
}

function onTab(event) {
  const btn = event.target.closest("button[data-tab]");
  if (!btn) return;
  ui.confirm = null;
  ui.tab = btn.dataset.tab;
  ui.picker = null;
  render({ scroll: true });
}

async function onFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  try {
    ui.importFileText = await file.text();
    ui.importFileName = file.name;
  } catch {
    ui.importFileText = "";
    ui.importFileName = "";
    toast("Datei konnte nicht gelesen werden.");
  }
  ui.confirm = null;
  render();
}

main.addEventListener("click", onClick);
main.addEventListener("input", (event) => {
  if (event.target && event.target.type === "file") return;
  handleField(event.target);
});
main.addEventListener("change", (event) => {
  if (event.target && event.target.type === "file") {
    onFile(event);
    return;
  }
  if (event.target instanceof HTMLSelectElement) handleField(event.target);
});
main.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  if (event.target && event.target.id === "new-ex-name") {
    event.preventDefault();
    createExercise();
  } else if (event.target && event.target.id === "new-tpl-name") {
    event.preventDefault();
    createTemplate();
  }
});
document.querySelector(".tabbar").addEventListener("click", onTab);

initStorage();
render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
