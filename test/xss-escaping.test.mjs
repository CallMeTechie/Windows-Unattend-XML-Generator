/**
 * Sicherheitstest für UIHelpers.escapeHtml() und UIHelpers.highlightXML().
 *
 * Verifiziert, dass user-/import-gesteuerte Werte beim Rendern via innerHTML
 * nicht zu ausführbarem Markup werden (DOM-XSS-Schutz). Die echten Funktionen
 * werden aus ui-helpers.js extrahiert, damit Quelle und Test nicht auseinanderlaufen.
 */

import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../js/ui-helpers.js', import.meta.url), 'utf8');

// Methode per Name extrahieren (self-contained Körper, keine { } in Regex/Strings).
// Reines String-Matching (keine dynamische RegExp -> kein ReDoS-Risiko): die
// Deklaration ist "<name>(" mit vorangehendem Whitespace (kein ".name(" Aufruf,
// kein "${name(" im Kommentar).
function extractMethod(name) {
    let nameStart = -1;
    for (let from = 0; (from = src.indexOf(name + '(', from)) !== -1; from += name.length) {
        const before = src[from - 1];
        if (before !== '.' && /\s/.test(before)) { nameStart = from; break; }
    }
    if (nameStart === -1) throw new Error(`Methode ${name} nicht gefunden`);
    const openParen = src.indexOf('(', nameStart);
    const openBrace = src.indexOf('{', nameStart);
    const params = src.slice(openParen + 1, src.indexOf(')', nameStart))
        .split(',').map(s => s.trim()).filter(Boolean);
    let depth = 0, end = -1;
    for (let i = openBrace; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    return { params, body: src.slice(openBrace + 1, end) };
}

// Als Objekt-Methoden binden, damit highlightXML korrekt this.escapeHtml sieht.
const UIHelpers = {};
{ const f = extractMethod('escapeHtml');   UIHelpers.escapeHtml   = new Function(...f.params, f.body); }
{ const f = extractMethod('highlightXML'); UIHelpers.highlightXML = new Function(...f.params, f.body); }

let failures = 0;
function check(name, cond, detail = '') {
    if (!cond) failures++;
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '\n        ' + detail}`);
}

// --- escapeHtml ---
check('escapeHtml ersetzt alle Sonderzeichen (& zuerst)',
    UIHelpers.escapeHtml('<b>&"\'') === '&lt;b&gt;&amp;&quot;&#39;',
    `erhalten: ${JSON.stringify(UIHelpers.escapeHtml('<b>&"\''))}`);
check('escapeHtml(null/undefined) -> ""',
    UIHelpers.escapeHtml(null) === '' && UIHelpers.escapeHtml(undefined) === '');

// --- highlightXML: XSS-Payloads dürfen nicht ausführbar werden ---
const payloads = [
    '<Organization><img src=x onerror=alert(1)></Organization>',
    '<ComputerName>"><script>alert(1)</script></ComputerName>',
    '<TimeZone>\'"><svg/onload=alert(1)></TimeZone>'
];
for (const p of payloads) {
    const out = UIHelpers.highlightXML(p);
    // Korrekte Invariante: escapeHtml wandelt JEDES '<' in '&lt;'. Die einzigen
    // echten Tags im Output sind die festen Highlight-<span>s. Entfernt man diese,
    // darf kein '<' mehr übrig sein -> kein vom Payload erzeugtes echtes Element.
    const stripped = out
        .replace(/<span class="xml-(tag|attr|value|comment)">/g, '')
        .replace(/<\/span>/g, '');
    check(`highlightXML neutralisiert Payload: ${p.slice(0, 32)}…`,
        !stripped.includes('<'),
        `Output enthielt ein echtes Element: ${out}`);
}

// --- highlightXML: kein Doppel-Escaping, Tag-Highlighting aktiv ---
const sample = UIHelpers.highlightXML('<UILanguage>en-US</UILanguage>');
check('highlightXML doppelt nicht (&amp;lt; darf nicht auftreten)', !sample.includes('&amp;lt;'),
    `erhalten: ${sample}`);
check('highlightXML wendet xml-tag-Highlighting an', sample.includes('<span class="xml-tag">UILanguage</span>'),
    `erhalten: ${sample}`);

console.log(`\n${failures === 0 ? 'ALLE TESTS BESTANDEN' : failures + ' TEST(S) FEHLGESCHLAGEN'}`);
process.exit(failures === 0 ? 0 : 1);
