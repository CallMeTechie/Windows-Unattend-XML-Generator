# Windows Autounattend.xml Generator

Ein vollständig clientseitiger Generator für `autounattend.xml`-Antwortdateien
zur unbeaufsichtigten Installation von **Windows 11** und **Windows Server 2022**. Reine
Browser-App (Vanilla JS, keine Laufzeit-Abhängigkeiten), mit mehrsprachiger Oberfläche.

## Funktionen

- **Zwei Modi:** geführter **Wizard** (6 Schritte) und **Pro-Modus** (11 Tabs für die volle Kontrolle).
- **Alle relevanten Unattend-Pässe:** windowsPE, offlineServicing, generalize, specialize,
  auditSystem/auditUser, oobeSystem.
- **Partitionierung, Benutzerkonten, Netzwerk** (statisch/DHCP, DNS, WINS), **Domänen-Beitritt**,
  **Software-/Treiber-Installation, Skripte, geplante Aufgaben, Windows-Features**.
- **Korrektes Passwort-Encoding** (UTF-16LE + Element-Suffix + Base64, wie von Windows erwartet).
- **8 Sprachen:** Deutsch, Englisch, Spanisch, Französisch, Italienisch, Polnisch, Russisch, Chinesisch.
- **XML-Import** zum Weiterbearbeiten bestehender Antwortdateien.

## Nutzung

Die App nutzt ES-Module und lädt Sprachen per `fetch`. Browser blockieren beides bei `file://`
(CORS, Origin „null"). Es gibt daher zwei Wege:

### 1. Über einen lokalen Webserver (Entwicklung & normaler Betrieb)

```bash
# im Projektverzeichnis, z. B. mit Python:
python3 -m http.server 8000
# dann im Browser öffnen:
#   http://localhost:8000/
```

(Jeder statische Webserver funktioniert – `npx serve`, VS Code „Live Server" usw.)

### 2. Als eigenständige Datei (Doppelklick, offline)

Der Standalone-Build bündelt alle Module, Sprachen und das CSS in **eine** HTML-Datei, die
ohne Server per Doppelklick funktioniert:

```bash
npm run build
# erzeugt: autounattend-generator.standalone.html  ->  einfach im Browser öffnen
```

## Entwicklung

```bash
npm install     # installiert die Test-Abhängigkeit (jsdom)
npm test        # führt alle Testsuiten aus (test/*.test.mjs)
npm run build   # erzeugt den Standalone-Build
```

### Projektstruktur

```
index.html              Einstiegspunkt (Server-Betrieb, ES-Module)
styles.css              Styling
js/                     ES-Module
  app.js                  App-Controller (Init, Events, Auto-Save)
  config.js               Konfigurations-/Zustandsverwaltung
  language-manager.js     i18n (fetch oder eingebettet)
  ui-helpers.js           UI-Utilities, Escaping, Modals, Notifications
  validation.js           Eingabe-/Konfigurationsvalidierung
  dynamic-elements.js     dynamische Listen (Partitionen, Benutzer, …)
  wizard.js               Wizard-Modus
  pro-mode.js             Pro-Modus
  xml-generator.js        Erzeugung der autounattend.xml
lang/*.json             Übersetzungen (8 Sprachen)
test/*.test.mjs         Testsuiten (Node + jsdom)
build-standalone.mjs    Standalone-Build-Skript
```

## Sicherheit

- **Strenge CSP** im Server-Betrieb (`script-src 'self'`); benutzer-/importgesteuerte Werte werden
  vor dem Einfügen in den DOM konsequent escaped (`escapeHtml`/`highlightXML`).
- **Shell-sichere XML-Generierung:** Daten-Werte werden vor der Einbettung in PowerShell-/cmd-Befehle
  neutralisiert (Schutz vor Command-Injection).
- **Keine Klartext-Passwörter** in `localStorage` (werden von der Persistenz ausgeschlossen).
- **Verbindliche Validierung** vor der XML-Erzeugung.

## Lizenz

[MIT](LICENSE) © CallMeTechie
