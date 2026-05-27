/**
 * Reproduktions-/Regressionstest für XMLGenerator.encodePassword().
 *
 * Hintergrund: Windows verschleiert Passwörter in autounattend.xml, indem es an
 * das Klartext-Passwort den NAMEN DES ELTERN-XML-KNOTENS von <Value> anhängt,
 * das Ganze als UTF-16LE kodiert und Base64-kodiert. Beim Lesen entfernt Windows
 * genau diesen Suffix wieder (Regex "<ElementName>$").
 *
 *   <AdministratorPassword><Value>…</Value>  -> Suffix "AdministratorPassword"
 *   <AutoLogon><Password><Value>…</Value>    -> Suffix "Password"
 *   <LocalAccount><Password><Value>…</Value> -> Suffix "Password"
 *
 * Ground Truth: offizielles MS-Docs-Beispiel (AdministratorPassword)
 *   <Value>cAB3AEEAZABtAGkAbgBpAHMAdAByAGEAdABvAHIAUABhAHMAcwB3AG8AcgBkAA==</Value>
 *   dekodiert zu "pwAdministratorPassword", Klartext also "pw".
 *
 * Der Test extrahiert die ECHTE encodePassword-Methode aus xml-generator.js
 * (sie ist self-contained, nutzt nur btoa), damit Quelle und Test nicht
 * auseinanderlaufen.
 */

import { readFileSync } from 'node:fs';

// --- echte encodePassword-Methode aus der Quelle extrahieren -----------------
const src = readFileSync(new URL('../js/xml-generator.js', import.meta.url), 'utf8');

// Die Methoden-DEKLARATION (am Zeilenanfang eingerückt), nicht die Aufrufstellen
// wie "this.encodePassword(...)", die früher in der Datei stehen.
const declMatch = src.match(/\n\s*encodePassword\s*\(/);
if (!declMatch) throw new Error('encodePassword-Deklaration nicht in der Quelle gefunden');

const nameStart = declMatch.index + declMatch[0].indexOf('encodePassword');
const sigOpenBrace = src.indexOf('{', nameStart);
const paramList = src.slice(src.indexOf('(', nameStart) + 1, src.indexOf(')', nameStart));

// Methodenkörper über Klammerzählung herausschneiden (keine { } in Strings/Kommentaren des Körpers).
let depth = 0;
let bodyEnd = -1;
for (let i = sigOpenBrace; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
        depth--;
        if (depth === 0) { bodyEnd = i; break; }
    }
}
const body = src.slice(sigOpenBrace + 1, bodyEnd);

// Parameter so wie deklariert übernehmen (inkl. evtl. Default-Werten).
const params = paramList.split(',').map(p => p.trim()).filter(Boolean);
const encodePassword = new Function(...params, body);

// --- Helfer: nachbilden, wie Windows den Wert wieder dekodiert ---------------
function windowsDecode(base64Value, elementName) {
    const decoded = Buffer.from(base64Value, 'base64').toString('utf16le');
    // Windows entfernt den Suffix (Name des Eltern-Knotens) am Ende.
    return decoded.endsWith(elementName)
        ? decoded.slice(0, -elementName.length)
        : decoded; // kein Match -> Bug sichtbar machen, nichts entfernen
}

// --- Mini-Assert -------------------------------------------------------------
let failures = 0;
function check(name, actual, expected) {
    const ok = actual === expected;
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
    if (!ok) console.log(`        erwartet: ${JSON.stringify(expected)}\n        erhalten: ${JSON.stringify(actual)}`);
}

console.log(`Signatur: encodePassword(${params.join(', ')})\n`);

// 1) Ground Truth gegen offizielles MS-Docs-Beispiel
check(
    'MS-Docs Beispiel: encodePassword("pw", "AdministratorPassword")',
    encodePassword('pw', 'AdministratorPassword'),
    'cAB3AEEAZABtAGkAbgBpAHMAdAByAGEAdABvAHIAUABhAHMAcwB3AG8AcgBkAA=='
);

// 2) Round-Trip AdministratorPassword
check(
    'Round-Trip AdministratorPassword',
    windowsDecode(encodePassword('S3cret!Pass', 'AdministratorPassword'), 'AdministratorPassword'),
    'S3cret!Pass'
);

// 3) Round-Trip LocalAccount-Password (Suffix "Password")  <-- Bug-Reproduktion
check(
    'Round-Trip LocalAccount <Password> (Suffix "Password")',
    windowsDecode(encodePassword('UserPw123', 'Password'), 'Password'),
    'UserPw123'
);

// 4) Round-Trip AutoLogon-Password (Suffix "Password")     <-- Bug-Reproduktion
check(
    'Round-Trip AutoLogon <Password> (Suffix "Password")',
    windowsDecode(encodePassword('AutoLogonPw', 'Password'), 'Password'),
    'AutoLogonPw'
);

// 5) Unicode-Passwort (Umlaute) Round-Trip
check(
    'Round-Trip Unicode-Passwort "Pä$$wörtÜ"',
    windowsDecode(encodePassword('Pä$$wörtÜ', 'Password'), 'Password'),
    'Pä$$wörtÜ'
);

// 5b) Zeichen außerhalb der BMP (Emoji = Surrogate-Paar) Round-Trip.
//     Sichert die vereinfachte UTF-16LE-Kopierschleife ab (Bug 8): Surrogate-
//     Hälften werden als einzelne Code-Units korrekt kodiert.
check(
    'Round-Trip Emoji-Passwort "Pa😀ss" (Surrogate-Paar)',
    windowsDecode(encodePassword('Pa😀ss', 'Password'), 'Password'),
    'Pa😀ss'
);

// 6) Leeres Passwort bleibt leer
check('Leeres Passwort -> ""', encodePassword('', 'Password'), '');

console.log(`\n${failures === 0 ? 'ALLE TESTS BESTANDEN' : failures + ' TEST(S) FEHLGESCHLAGEN'}`);
process.exit(failures === 0 ? 0 : 1);
