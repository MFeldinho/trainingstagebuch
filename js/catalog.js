/** Übungskatalog (27) und die drei Standardvorlagen. Historische Sessions bleiben leer. */

import { uid } from "./util.js";

export const GROUPS = ["geraet", "funktional", "eigene"];
export const UNITS = ["kg", "Wdh", "Sek", "Min"];

export const GROUP_LABELS = {
  geraet: "Gerät",
  funktional: "Funktional",
  eigene: "Eigene",
};

export const UNIT_LABELS = {
  kg: "Gewicht (kg)",
  Wdh: "Wiederholungen",
  Sek: "Zeit (Sek)",
  Min: "Zeit (Min)",
};

export const FILTERS = [
  ["alle", "Alle"],
  ["geraet", "Geräte"],
  ["funktional", "Funktional"],
  ["eigene", "Eigene"],
];

export function defaultPlan(unit) {
  if (unit === "kg") return "3 × 12 Wdh";
  if (unit === "Wdh") return "3 × max. Wdh";
  if (unit === "Sek") return "3 × max. Sek";
  return "";
}

export const CATALOG = [
  {
    name: "Rückenstreckgerät",
    group: "geraet",
    unit: "kg",
    plan: "3 × 15 Wdh",
    setting: "Rückenpolster 3 | Startposition 3",
    note: "Oberkörper gegen das Polster lehnen und den Rumpf langsam nach hinten strecken. Die Bewegung kommt aus dem Rücken, der Nacken bleibt lang.",
  },
  {
    name: "Bauchpressgerät",
    group: "geraet",
    unit: "kg",
    plan: "3 × 15 Wdh",
    setting: "Startposition 13",
    note: "Unteren Rücken fest an das Polster drücken und den Oberkörper zur Matte einrollen. Nicht am Nacken ziehen.",
  },
  {
    name: "Schulterdrücken",
    group: "geraet",
    unit: "kg",
    plan: "3 × 10 Wdh",
    setting: "",
    note: "Griffe auf Schulterhöhe, Rücken am Polster, Rumpf fest. Die Arme gleichmäßig nach oben drücken, ohne die Schultern hochzuziehen.",
  },
  {
    name: "Enges Rudern",
    group: "geraet",
    unit: "kg",
    plan: "3 × 12 Wdh",
    setting: "",
    note: "Brust an das Polster, Schulterblätter zusammenziehen und die Griffe eng zum Körper führen. Die Schultern bleiben unten.",
  },
  {
    name: "Butterfly",
    group: "geraet",
    unit: "kg",
    plan: "3 × 12 Wdh",
    setting: "",
    note: "Ellenbogen leicht gebeugt lassen und die Arme vor der Brust zusammenführen. Langsam und kontrolliert wieder öffnen.",
  },
  {
    name: "45°-Beinpresse",
    group: "geraet",
    unit: "kg",
    plan: "3 × 15 Wdh",
    setting: "Rückenlehne 3 | Schlittenposition 4",
    note: "Füße schulterbreit auf die Plattform stellen, Knie folgen den Fußspitzen. Den Schlitten drücken, ohne die Knie am Ende durchzudrücken.",
  },
  {
    name: "Beinstrecken",
    group: "geraet",
    unit: "kg",
    plan: "3 × 15 Wdh",
    setting: "Rückenlehne 2 | Fußpolster 5 | Startposition 5",
    note: "Rücken am Polster, Fußpolster über dem Spann. Die Beine gleichmäßig strecken und langsam wieder absenken.",
  },
  {
    name: "Trizepsdrücken",
    group: "geraet",
    unit: "kg",
    plan: "3 × 12 Wdh",
    setting: "Seilrolle",
    note: "Oberarme am Körper halten und das Seil nach unten drücken, bis die Arme gestreckt sind. Die Ellenbogen bleiben stehen.",
  },
  {
    name: "Pulldown",
    group: "geraet",
    unit: "kg",
    plan: "3 × 12 Wdh",
    setting: "",
    note: "Stange etwa schulterbreit greifen, Brust leicht heben und die Stange zur oberen Brust ziehen. Nicht mit dem Oberkörper nach hinten schwingen.",
  },
  {
    name: "Vertical Knee Raise",
    group: "geraet",
    unit: "Wdh",
    plan: "3 × max. Wdh",
    setting: "",
    note: "An den Unterarmstützen stabilisieren und die Knie kontrolliert zur Brust ziehen. Den unteren Rücken am Polster lassen. Eingetragen wird die Summe aller Sätze.",
  },
  {
    name: "Hip Abductor",
    group: "geraet",
    unit: "kg",
    plan: "3 × 15 Wdh",
    setting: "",
    note: "Aufrecht sitzen, Rücken am Polster, und die Beine langsam nach außen drücken. Kontrolliert zurückführen, nicht die Gewichte aufschlagen lassen.",
  },
  {
    name: "Goblet Squat",
    group: "funktional",
    unit: "kg",
    plan: "3 × 12 Wdh",
    setting: "",
    note: "Eine Kurzhantel vor der Brust halten, Füße schulterbreit. In die Hocke gehen, Knie folgen den Fußspitzen, der Rücken bleibt gerade.",
  },
  {
    name: "Ausfallschritte",
    group: "funktional",
    unit: "kg",
    plan: "3 × 10 Wdh je Seite (Gewicht je Hand)",
    setting: "",
    note: "In jeder Hand eine Kurzhantel, großer Schritt nach vorn, hinteres Knie Richtung Boden. Das vordere Knie bleibt über dem Fuß. Gewicht je Hand eintragen.",
  },
  {
    name: "Wandsitzen",
    group: "funktional",
    unit: "Sek",
    plan: "3 × max. Sek",
    setting: "",
    note: "Rücken flach an die Wand, Oberschenkel möglichst waagerecht, Knie über den Fersen. Die Sekunden aller drei Sätze addieren.",
  },
  {
    name: "Kurzhantel-Schulterdrücken",
    group: "funktional",
    unit: "kg",
    plan: "3 × 10 Wdh (Gewicht je Hand)",
    setting: "",
    note: "Im Sitzen oder Stand, Gewicht je Hand eintragen. Kurzhanteln von Schulterhöhe über den Kopf drücken, der Rumpf bleibt fest.",
  },
  {
    name: "Einarmiges Kurzhantelrudern",
    group: "funktional",
    unit: "kg",
    plan: "3 × 12 Wdh je Seite",
    setting: "",
    note: "Eine Hand und das gleichseitige Knie auf der Bank, Rücken gerade. Die Hantel zum Hüftgelenk ziehen und das Schulterblatt bewusst mitnehmen.",
  },
  {
    name: "Kurzhantel-Fliegende",
    group: "funktional",
    unit: "kg",
    plan: "3 × 12 Wdh (Gewicht je Hand)",
    setting: "",
    note: "Auf der Bank liegen, Ellenbogen leicht gebeugt, Arme seitlich absenken und über der Brust zusammenführen. Gewicht je Hand eintragen.",
  },
  {
    name: "Liegestütze",
    group: "funktional",
    unit: "Wdh",
    plan: "3 × max. Wdh",
    setting: "",
    note: "Hände etwas weiter als schulterbreit, Körper eine Linie von Kopf bis Ferse. Die Brust zum Boden senken und kraftvoll hochdrücken. Die Wiederholungen aller Sätze addieren.",
  },
  {
    name: "Dips an der Bank",
    group: "funktional",
    unit: "Wdh",
    plan: "3 × max. Wdh",
    setting: "",
    note: "Hände hinter dem Körper auf der Bank, Füße vorn, Hüfte nah an der Kante. Ellenbogen nach hinten beugen und wieder strecken.",
  },
  {
    name: "Klimmzüge",
    group: "funktional",
    unit: "Wdh",
    plan: "3 × max. Wdh",
    setting: "",
    note: "Schulterbreit im Obergriff hängen, zuerst die Schulterblätter nach unten ziehen, dann das Kinn über die Stange. Nicht schwingen.",
  },
  {
    name: "Vorgebeugtes Kurzhantelrudern",
    group: "funktional",
    unit: "kg",
    plan: "3 × 12 Wdh (Gewicht je Hand)",
    setting: "",
    note: "Kurzhanteln links und rechts, Gewicht je Hand eintragen. Oberkörper mit geradem Rücken vorbeugen und beide Hanteln zur Hüfte ziehen.",
  },
  {
    name: "Superman",
    group: "funktional",
    unit: "Wdh",
    plan: "3 × max. Wdh",
    setting: "",
    note: "Bauchlage, Arme nach vorn gestreckt. Arme und Beine gleichzeitig anheben, kurz halten und kontrolliert ablegen.",
  },
  {
    name: "Crunches",
    group: "funktional",
    unit: "Wdh",
    plan: "3 × max. Wdh",
    setting: "",
    note: "Rückenlage, Füße aufgestellt, unterer Rücken am Boden. Schulterblätter einrollen und langsam wieder ablegen, der Nacken bleibt lang.",
  },
  {
    name: "Plank",
    group: "funktional",
    unit: "Sek",
    plan: "3 × max. Sek",
    setting: "",
    note: "Unterarme unter den Schultern, Körper eine gerade Linie, Bauch und Gesäß angespannt. Die Sekunden aller drei Sätze addieren.",
  },
  {
    name: "Beinheben an der Matte",
    group: "funktional",
    unit: "Wdh",
    plan: "3 × max. Wdh",
    setting: "",
    note: "Rückenlage, Hände neben dem Körper. Gestreckte Beine kontrolliert anheben und langsam senken, ohne den unteren Rücken abzuheben.",
  },
  {
    name: "Seitliches Beinheben",
    group: "funktional",
    unit: "Wdh",
    plan: "3 × max. Wdh je Seite",
    setting: "",
    note: "Seitenlage, Körper gerade, unterer Arm stützt den Kopf. Das obere Bein gestreckt anheben und langsam senken. Beide Seiten trainieren.",
  },
  {
    name: "Kniebeugen",
    group: "funktional",
    unit: "Wdh",
    plan: "3 × max. Wdh",
    setting: "",
    note: "Füße schulterbreit, Rücken gerade, Knie folgen den Fußspitzen, Oberschenkel mindestens waagerecht.",
  },
];

/**
 * Vorversion (Format vor v3). migrateV3 schreibt auf CATALOG um,
 * wenn Einheit und Ausführung noch exakt so aussehen.
 * Einheitenwechsel nur, solange die Übung in keiner Session steht.
 */
export const EXPREV = {
  "Goblet Squat": { unit: "Wdh", plan: "3 × 12–15 Wdh" },
  "Wandsitzen": { unit: "Wdh", plan: "3 × max. Wdh" },
  "Plank": { unit: "Wdh", plan: "3 × max. Wdh" },
  "Kurzhantel-Schulterdrücken": { unit: "kg", plan: "3 × 10 Wdh" },
  "Ausfallschritte": { unit: "kg", plan: "3 × 10 Wdh je Seite" },
  "Kurzhantel-Fliegende": { unit: "kg", plan: "3 × 12 Wdh" },
  "Vorgebeugtes Kurzhantelrudern": { unit: "kg", plan: "3 × 12 Wdh" },
};

/** Zwei Zwischen-Notizen aus der Umstellung. Werden durch die Katalog-Notiz ersetzt. */
export const NOTEBACK = ["Summe aller Sätze eintragen.", "Gewicht je Hand."];

export const OLD_HOTEL_OHNE = [
  "Wandsitzen",
  "Liegestütze",
  "Dips an der Bank",
  "Superman",
  "Plank",
  "Crunches",
  "Beinheben an der Matte",
  "Seitliches Beinheben",
];

export const TEMPLATES = [
  {
    name: "Fitnessstudio 1",
    minutes: 60,
    exercises: [
      "Rückenstreckgerät",
      "Bauchpressgerät",
      "Schulterdrücken",
      "Enges Rudern",
      "Butterfly",
      "45°-Beinpresse",
      "Beinstrecken",
      "Trizepsdrücken",
    ],
  },
  {
    name: "Hotel",
    minutes: 60,
    exercises: [
      "Goblet Squat",
      "Ausfallschritte",
      "Kurzhantel-Schulterdrücken",
      "Einarmiges Kurzhantelrudern",
      "Liegestütze",
      "Dips an der Bank",
      "Superman",
      "Plank",
    ],
  },
  {
    name: "Hotel ohne Hanteln",
    minutes: 60,
    exercises: [
      "Kniebeugen",
      "Wandsitzen",
      "Liegestütze",
      "Dips an der Bank",
      "Superman",
      "Plank",
      "Crunches",
      "Beinheben an der Matte",
    ],
  },
];

export function findCatalog(name) {
  const key = String(name ?? "").trim().toLowerCase();
  return CATALOG.find((entry) => entry.name.toLowerCase() === key) || null;
}

export function prevOf(name) {
  const key = String(name ?? "").trim().toLowerCase();
  const found = Object.keys(EXPREV).find((item) => item.toLowerCase() === key);
  return found ? EXPREV[found] : null;
}

export function makeExercise(cat, id) {
  return {
    id,
    name: cat.name,
    group: cat.group,
    unit: cat.unit,
    setting: cat.setting || "",
    plan: cat.plan,
    note: cat.note,
    video: "",
  };
}

export function standardTemplates(exercises, idFactory = uid) {
  for (const tpl of TEMPLATES) {
    for (const name of tpl.exercises) {
      if (!exercises.some((ex) => ex.name.toLowerCase() === name.toLowerCase())) {
        const cat = findCatalog(name);
        if (cat) exercises.push(makeExercise(cat, idFactory("ex")));
      }
    }
  }
  return TEMPLATES.map((tpl) => ({
    id: idFactory("tpl"),
    name: tpl.name,
    minutes: tpl.minutes,
    exIds: tpl.exercises.map((name) => exercises.find((ex) => ex.name.toLowerCase() === name.toLowerCase()).id),
  }));
}

export function seedState(idFactory = uid) {
  const exercises = CATALOG.map((cat) => makeExercise(cat, idFactory("ex")));
  return {
    ver: 3,
    exercises,
    templates: standardTemplates(exercises, idFactory),
    sessions: [],
    draft: null,
    dirty: true,
    lastExport: "",
  };
}

export function richtwert(count) {
  return 10 + 6 * count;
}
