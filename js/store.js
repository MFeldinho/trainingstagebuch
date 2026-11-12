/** localStorage-Zugriff. Jeder Zugriff bleibt in der Aufrufer-try/catch-Schicht. */

import { seedState } from "./catalog.js";
import { finalizeState } from "./migrate.js";
import { uid } from "./util.js";

export const STORAGE_KEY = "trainingstagebuch.v1";

export function loadFromStorage(storage, idFactory = uid) {
  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { state: seedState(idFactory), available: false, empty: true, changed: false };
  }
  if (raw == null || String(raw).trim() === "") {
    return { state: seedState(idFactory), available: true, empty: true, changed: false };
  }
  try {
    const parsed = JSON.parse(raw);
    const synthesizeTemplates = !Array.isArray(parsed.templates);
    if (!Array.isArray(parsed.templates)) parsed.templates = [];
    const { state, changed } = finalizeState(parsed, { idFactory, synthesizeTemplates });
    if (changed) state.dirty = true;
    return { state, available: true, empty: false, changed };
  } catch {
    return { state: seedState(idFactory), available: true, empty: true, changed: false };
  }
}

export function saveToStorage(storage, state) {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}
