/**
 * Integrationstest für den Standalone-Build (Lücke 7).
 *
 * Führt den Build aus und lädt die erzeugte autounattend-generator.standalone.html
 * in jsdom mit ausgeführten Inline-Scripts. Dies simuliert den Doppelklick-/file://-
 * Betrieb: KEINE ES-Module, KEIN fetch – alles ist als klassisches <script> und als
 * window.__embeddedTranslations eingebettet. Der Test beweist, dass die App so
 * vollständig initialisiert.
 */

import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let failures = 0;
function check(name, cond, detail = '') {
    if (!cond) failures++;
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '\n        ' + detail}`);
}

// 1. Build erzeugen (self-contained).
const build = spawnSync('node', [join(root, 'build-standalone.mjs')], { encoding: 'utf8' });
check('Standalone: Build erfolgreich (exit 0)', build.status === 0, build.stderr || build.stdout);

// 2. Erzeugte Datei in jsdom mit aktiven Inline-Scripts laden.
const html = readFileSync(join(root, 'autounattend-generator.standalone.html'), 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });

// 3. Auf die asynchrone App-Initialisierung (DOMContentLoaded -> App.init) warten.
await new Promise(resolve => setTimeout(resolve, 300));

const w = dom.window;
check('Standalone: window.App initialisiert', !!w.App && w.App.isInitialized === true,
    'isInitialized=' + (w.App && w.App.isInitialized));
check('Standalone: Kernobjekte global verfügbar',
    !!w.ConfigManager && !!w.ProMode && !!w.XMLGenerator && !!w.DynamicElements);
check('Standalone: Sprachen aus Einbettung geladen (kein fetch)',
    !!w.LanguageManager && w.LanguageManager.translations
    && Object.keys(w.LanguageManager.translations).length > 0,
    'translations keys=' + (w.LanguageManager && Object.keys(w.LanguageManager.translations || {}).length));
check('Standalone: Übersetzung wird aufgelöst (nicht der Schlüssel)',
    w.LanguageManager && w.LanguageManager.t('modes.wizard') !== 'modes.wizard',
    't(modes.wizard)=' + (w.LanguageManager && w.LanguageManager.t('modes.wizard')));
check('Standalone: Wizard-Inhalt wurde gerendert',
    (w.document.getElementById('wizard-content')?.children.length || 0) > 0);

console.log(`\n${failures === 0 ? 'ALLE TESTS BESTANDEN' : failures + ' TEST(S) FEHLGESCHLAGEN'}`);
process.exit(failures === 0 ? 0 : 1);
