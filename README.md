# Trainingstagebuch

Smartphone-App zum Protokollieren von Krafttraining. Sie läuft als statische Seite im Browser, speichert den Arbeitsstand lokal auf dem Gerät und sichert alles als eine Markdown-Datei. Diese Datei ist die eigentliche Datenbasis und wird nach dem Training beim KI-Coach abgelegt.

Es gibt kein Konto, keinen Server und keine Analyse-Skripte. Zur Laufzeit wird nichts nach außen geladen.

## Training

1. App öffnen, Tab **Session**.
2. Eine Vorlage starten (**Fitnessstudio 1**, **Hotel**, **Hotel ohne Hanteln**), eine leere Session oder „Wie am … starten“.
3. Pro Übung nur den einen Messwert eintragen. Bei Kilogramm-Übungen setzt **+2,5** den letzten Wert plus 2,5 kg. Zusatzübungen kommen über **Übung hinzufügen**.
4. **Session speichern**.
5. Tab **Daten → Als Datei speichern**. Auf dem Handy öffnet sich das Teilen-Menü mit der Datei `trainingstagebuch.md`. Ohne Teilen-Menü lädt der Browser die Datei herunter. **In Zwischenablage kopieren** geht immer.
6. Die Datei im Projekt des Coaches als `trainingstagebuch.md` ablegen und die vorherige Version ersetzen.

Oben steht **Nicht exportiert**, solange sich seit dem letzten Export etwas geändert hat, sonst **Exportiert**.

Der Entwurf einer angefangenen Session bleibt beim Neuladen erhalten, bis sie gespeichert oder verworfen wird. Verwerfen, Löschen, Import und Zurücksetzen fragen mit einem zweiten Klick nach.

**Import** (Datei oder eingefügter Text) ersetzt alle Daten in dieser App. Das ist der Weg, um eine vorhandene `trainingstagebuch.md` auf ein neues Gerät zu holen. **Zurücksetzen** stellt den Übungskatalog und die drei Standardvorlagen wieder her und löscht die Sessions.

## Auf dem Home-Bildschirm

Die App ist eine PWA und lässt sich offline öffnen, sobald sie einmal geladen wurde.

**iPhone (Safari)**  
Teilen-Button → **Zum Home-Bildschirm**. Die App öffnet sich danach ohne Browser-Leiste. Zum Export das Teilen-Menü der App nutzen und die Datei in „Dateien“ oder direkt in den Chat legen, aus dem sie zum Coach kommt.

**Android (Chrome)**  
Menü → **App installieren** oder **Zum Startbildschirm hinzufügen**. Der Export öffnet das Teilen-Menü; dort die Markdown-Datei sichern oder teilen.

Updates kommen an, wenn eine neue Version veröffentlicht wurde. Dafür ist der Cache-Name in `sw.js` (`CACHE`) bei jeder Veröffentlichung zu erhöhen. Einmal schließen und neu öffnen reicht danach in der Regel.

## Lokal starten

Es gibt keinen Build-Schritt.

```bash
npm install
npm start
```

Dann im Browser `http://127.0.0.1:8080` öffnen. `npm start` ist ein einfacher Python-Webserver. Egal welcher statische Server: die Seite muss über HTTP geladen werden, nicht als `file://`, sonst verweigert der Browser die Module.

## Tests

```bash
npm test
npm run test:ui
```

`npm test` prüft mit dem Node-Testläufer Parser, Export, Import, Migrationen und den Seed. `npm run test:ui` startet die Seite und prüft sie mit Playwright (Chromium) bei 390, 360 und 320 Pixeln, hell und dunkel: kein horizontales Scrollen, Cursor im Suchfeld, Entwurf übersteht Neuladen, die App läuft auch wenn `localStorage` wirft.

Beim ersten UI-Lauf einmal `npx playwright install --with-deps chromium`.

## Veröffentlichung

Der Workflow **Deploy GitHub Pages** legt bei jedem Push auf `main` die statischen Dateien auf GitHub Pages. Es sind keine Secrets nötig.

Einmalig, falls Pages noch nicht aus Actions baut:

1. Repository auf GitHub öffnen.
2. **Settings → Pages**.
3. Bei **Build and deployment / Source** **GitHub Actions** wählen.

Danach den Workflow laufen lassen (Push auf `main` oder **Actions → Deploy GitHub Pages → Run workflow**). Die Seite steht unter:

**https://mfeldinho.github.io/trainingstagebuch/**

Pull Requests führt der Workflow **CI** aus (Logiktests und Playwright).

## Datenformat

Export ist Markdown **Version 3** (`# Trainingstagebuch`, Abschnitte Übungen, Vorlagen, Sessions). Ältere Dateien ohne Version oder ohne Ausführungszeile lassen sich importieren. Ungültige Datumswerte werden übersprungen, unbekannte Übungen aus Sessions werden angelegt. Der Browser-Speicher (`localStorage`, Schlüssel `trainingstagebuch.v1`) ist nur der Arbeitsstand auf diesem Gerät.
