/**
 * Test für DynamicElements.populateItem() — das Gegenstück zu den collect*-
 * Methoden, das gespeicherte/importierte Item-Werte zurück in die Formularfelder
 * schreibt (Behebung: "loadFromConfig lädt Item-Werte nicht zurück").
 *
 * Verifiziert insbesondere, dass Werte über DOM-Properties (.value/.checked)
 * gesetzt werden – nicht via innerHTML – und somit kein XSS-Vektor entsteht.
 *
 * Da kein jsdom verfügbar ist, wird ein minimaler Feld-/Item-Mock benutzt; die
 * ECHTE populateItem-Methode wird aus dynamic-elements.js extrahiert.
 */

import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../js/dynamic-elements.js', import.meta.url), 'utf8');

// Methoden-Deklaration "<name>(" mit vorangehendem Whitespace finden (kein
// ".name(" Aufruf), Körper per Klammerzählung herausschneiden.
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
    return new Function(...params, src.slice(openBrace + 1, end));
}

const populateItem = extractMethod('populateItem');

// --- minimaler DOM-Mock -----------------------------------------------------
function field(name, type, initial) {
    return {
        dataset: { field: name },
        type,
        value: type === 'checkbox' ? undefined : (initial ?? ''),
        checked: type === 'checkbox' ? Boolean(initial) : undefined
    };
}
function item(fields) {
    return { querySelectorAll: (sel) => sel === '[data-field]' ? fields : [] };
}

let failures = 0;
function check(name, cond, detail = '') {
    if (!cond) failures++;
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '\n        ' + detail}`);
}

// 1) Textfeld wird mit gespeichertem Wert befüllt
{
    const f = field('label', 'text');
    populateItem(item([f]), { label: 'SYSTEM' });
    check('Textfeld erhält gespeicherten value', f.value === 'SYSTEM', `value=${JSON.stringify(f.value)}`);
}

// 2) Checkbox wird gemäß boolean gesetzt
{
    const f = field('active', 'checkbox', false);
    populateItem(item([f]), { active: true });
    check('Checkbox erhält checked=true', f.checked === true);
}

// 3) Fehlender Key lässt Feld unverändert
{
    const f = field('letter', 'text', 'C');
    populateItem(item([f]), { label: 'X' }); // kein "letter" in data
    check('Fehlender Key -> Feld unverändert', f.value === 'C', `value=${JSON.stringify(f.value)}`);
}

// 4) null/undefined -> '' (nicht der String "null")
{
    const f = field('description', 'text', 'alt');
    populateItem(item([f]), { description: null });
    check('null -> leerer String', f.value === '', `value=${JSON.stringify(f.value)}`);
}

// 5) XSS-Wert landet UNVERÄNDERT als .value (DOM-Property, kein HTML-Parsing)
{
    const payload = '"><img src=x onerror=alert(1)>';
    const f = field('username', 'text');
    populateItem(item([f]), { username: payload });
    check('XSS-Payload wird als roher .value gesetzt (kein innerHTML)', f.value === payload,
        `value=${JSON.stringify(f.value)}`);
}

// 6) Robust gegen leere/ungültige Eingaben
{
    let threw = false;
    try { populateItem(null, { a: 1 }); populateItem(item([]), null); } catch { threw = true; }
    check('Kein Fehler bei null-Item/null-Data', !threw);
}

console.log(`\n${failures === 0 ? 'ALLE TESTS BESTANDEN' : failures + ' TEST(S) FEHLGESCHLAGEN'}`);
process.exit(failures === 0 ? 0 : 1);
