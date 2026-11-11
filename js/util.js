/** Kleine, nebenwirkungsfreie Helfer. */

let seq = 0;

export function uid(prefix = "id") {
  seq += 1;
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${time}-${seq.toString(36)}-${rand}`;
}

export function sameName(a, b) {
  return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
}

export function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const y = Number(value.slice(0, 4));
  const m = Number(value.slice(5, 7));
  const d = Number(value.slice(8, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function todayISO(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Anzeige: Punkt zwischen Ziffern wird zum Dezimalkomma. Gespeicherte Werte bleiben unverändert. */
export function disp(value) {
  return String(value ?? "").replace(/(\d)\.(\d)/g, "$1,$2");
}

export function parseDeNumber(value) {
  const t = String(value ?? "").trim().replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function formatDeNumber(n) {
  const rounded = Math.round((n + Number.EPSILON) * 10) / 10;
  if (Object.is(rounded, -0)) return "0";
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(1).replace(".", ",");
}

export function plusTwoPointFive(value) {
  const n = parseDeNumber(value);
  if (n == null) return null;
  return formatDeNumber(n + 2.5);
}

export function formatShortDate(iso) {
  if (!isValidDate(iso)) return "";
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
}

export function formatDE(iso) {
  if (!isValidDate(iso)) return "";
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
}

export function formatLongDate(iso) {
  if (!isValidDate(iso)) return "";
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  return new Date(y, m - 1, d).toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function cleanText(value) {
  return String(value ?? "").replace(/\r\n|\r|\n/g, " ").trim();
}

/** Doppelpunkt im Namen ist das Trennzeichen der Markdown-Zeilen. */
export function cleanName(value) {
  return cleanText(value).replace(/:/g, " -");
}

export function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function videoUrl(name, video) {
  const v = String(video ?? "").trim();
  if (/^https?:\/\//i.test(v)) return v;
  const q = encodeURIComponent(`${String(name ?? "").trim()} Übung richtig ausführen`);
  return `https://www.youtube.com/results?search_query=${q}`;
}

export function sessionDisplayOrder(sessions) {
  return (sessions || [])
    .map((session, index) => ({ session, index }))
    .sort((a, b) => {
      if (a.session.date !== b.session.date) return a.session.date < b.session.date ? 1 : -1;
      return b.index - a.index;
    });
}

export function domId(prefix, id) {
  const safe = String(id ?? "").replace(/[^A-Za-z0-9_-]/g, "");
  return `${prefix}-${safe || "x"}`;
}
