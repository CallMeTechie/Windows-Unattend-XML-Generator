#!/usr/bin/env node
/**
 * Standalone-Build (Lücke 7): erzeugt EINE in sich geschlossene HTML-Datei, die
 * per Doppelklick (file://) funktioniert.
 *
 * Hintergrund: Bei file:// blockiert der Browser sowohl `fetch` als auch
 * `<script type="module">` (CORS, Origin "null"). Die ESM-Quelle in js/ läuft
 * daher nur über einen Webserver. Dieser Build bündelt alle Module (ESM-Syntax
 * entfernt) als EIN klassisches <script>, bettet die Sprachen als
 * window.__embeddedTranslations ein (statt fetch) und inlined CSS — alles in
 * autounattend-generator.standalone.html.
 *
 * Die Entwicklungs-Quelle (js/, lang/, index.html) bleibt unverändert ESM und
 * wird weiterhin per Webserver + den Tests genutzt.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));

// --- 1. Sprachen einbetten (kein fetch nötig) -------------------------------
const langDir = join(root, 'lang');
const translations = {};
for (const file of readdirSync(langDir).filter(f => f.endsWith('.json')).sort()) {
    translations[file.replace('.json', '')] = JSON.parse(readFileSync(join(langDir, file), 'utf8'));
}
const langScript = `window.__embeddedTranslations = ${JSON.stringify(translations)};`;

// --- 2. Module in Abhängigkeitsreihenfolge bündeln, ESM-Syntax entfernen -----
const order = [
    'language-manager', 'config', 'ui-helpers', 'validation',
    'dynamic-elements', 'xml-generator', 'wizard', 'pro-mode', 'app'
];

function stripEsm(src) {
    return src
        // einzeilige `import { ... } from '...';`
        .replace(/^[ \t]*import\s+\{[^}]*\}\s+from\s+['"][^'"]+['"];?[ \t]*$/gm, '')
        // mehrzeiliger `export { ... };`-Block (nur in app.js)
        .replace(/^[ \t]*export\s*\{[\s\S]*?\}\s*;[ \t]*$/gm, '')
        // `export const X` -> `const X` (Einrückung erhalten)
        .replace(/^([ \t]*)export\s+const\s+/gm, '$1const ');
}

const moduleBundle = order
    .map(name => `/* ===== js/${name}.js ===== */\n${stripEsm(readFileSync(join(root, 'js', `${name}.js`), 'utf8')).trim()}`)
    .join('\n\n');

// Validierung: klassisches JS ohne ESM-Reste / Doppeldeklarationen?
try {
    new Function(moduleBundle); // wirft bei SyntaxError (import/export, doppelte const …)
} catch (err) {
    console.error('FEHLER: Modul-Bundle ist kein valides klassisches JS:\n  ' + err.message);
    process.exit(1);
}

// --- 3. index.html als Template, externe Referenzen inlinen ------------------
let html = readFileSync(join(root, 'index.html'), 'utf8');
const css = readFileSync(join(root, 'styles.css'), 'utf8');

html = html
    .replace(/<link rel="stylesheet" href="styles\.css">/, `<style>\n${css}\n</style>`)
    .replace(/[ \t]*<link rel="icon"[^>]*>\n?/, '')
    // Inline-Scripts erfordern, dass die strikte CSP gelockert wird (alles ist
    // lokal & eingebettet; XSS-Schutz bleibt über escapeHtml/highlightXML aktiv).
    .replace(
        /<meta http-equiv="Content-Security-Policy"[^>]*>/,
        `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'">`
    )
    .replace(
        /<script type="module" src="js\/app\.js"><\/script>/,
        `<script>\n${langScript}\n</script>\n<script>\n${moduleBundle}\n</script>`
    );

const outFile = join(root, 'autounattend-generator.standalone.html');
writeFileSync(outFile, html);

console.log('✓ Standalone-Build erstellt: autounattend-generator.standalone.html');
console.log(`  Sprachen eingebettet: ${Object.keys(translations).join(', ')}`);
console.log(`  Module gebündelt: ${order.length}`);
console.log(`  Dateigröße: ${Math.round(html.length / 1024)} KB`);
