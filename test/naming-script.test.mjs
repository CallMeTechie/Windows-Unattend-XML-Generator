/**
 * Regressionstest für XMLGenerator.generateNamingScript() — stellt sicher, dass
 * die Strategie 'prefix-counter' ein echtes Rename-Skript erzeugt und nicht mehr
 * (wie vor dem Fix von Bug 3) auf einen leeren String / 'fixed' zurückfällt.
 *
 * Die echte Methode wird aus xml-generator.js extrahiert (self-contained: liest
 * nur config.computerNamePrefix + config.computerNameStrategy), damit Quelle und
 * Test nicht auseinanderlaufen.
 */

import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../js/xml-generator.js', import.meta.url), 'utf8');

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

// generateNamingScript nutzt this.psArg (Shell-Quoting, Lücke 4). Da die Methode
// hier standalone extrahiert wird, mit einem this binden, das die ebenfalls
// extrahierte psArg-Methode bereitstellt.
const psArg = extractMethod('psArg');
const _generateNamingScript = extractMethod('generateNamingScript');
const generateNamingScript = (config) => _generateNamingScript.call({ psArg }, config);

let failures = 0;
function check(name, cond, detail = '') {
    if (!cond) failures++;
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '\n        ' + detail}`);
}

// 1) prefix-counter erzeugt ein nicht-leeres Skript (Kern von Bug 3)
const pc = generateNamingScript({ computerNameStrategy: 'prefix-counter', computerNamePrefix: 'WIN-' });
check('prefix-counter liefert nicht-leeres Skript', pc.length > 0, `erhalten: ${JSON.stringify(pc)}`);
check('prefix-counter enthält das Präfix', pc.includes('WIN-'), pc);
check('prefix-counter benennt den Rechner um', pc.includes('Rename-Computer'), pc);
check('prefix-counter leitet aus Seriennummer ab', pc.includes('SerialNumber'), pc);

// 2) Bestehende Strategien funktionieren weiterhin (keine Regression)
const rnd = generateNamingScript({ computerNameStrategy: 'random', computerNamePrefix: 'PC-' });
check('random enthält weiterhin das Präfix', rnd.includes('PC-'), rnd);

// 3) fixed/prompt liefern korrekt KEIN Skript
check("fixed liefert leeres Skript", generateNamingScript({ computerNameStrategy: 'fixed' }) === '');
check("unbekannte Strategie liefert leeres Skript", generateNamingScript({ computerNameStrategy: 'xxx' }) === '');

console.log(`\n${failures === 0 ? 'ALLE TESTS BESTANDEN' : failures + ' TEST(S) FEHLGESCHLAGEN'}`);
process.exit(failures === 0 ? 0 : 1);
