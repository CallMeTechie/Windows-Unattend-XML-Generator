/**
 * Tests für ValidationUtils (Lücke 9: Test-Coverage für validation.js).
 *
 * validation.js importiert nur LanguageManager und hat keine Top-Level-Browser-
 * Seiteneffekte, daher kann ValidationUtils direkt importiert werden. Die reinen
 * Prüffunktionen (isValid*, validatePassword, areInSameSubnet) brauchen kein DOM.
 *
 * Alle Werte sind synthetisch.
 */

import { ValidationUtils } from '../js/validation.js';

let failures = 0;
function check(name, cond, detail = '') {
    if (!cond) failures++;
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '\n        ' + detail}`);
}

// --- IP-Adressen ---
check('isValidIPAddress akzeptiert 192.168.1.1', ValidationUtils.isValidIPAddress('192.168.1.1'));
check('isValidIPAddress akzeptiert 0.0.0.0', ValidationUtils.isValidIPAddress('0.0.0.0'));
check('isValidIPAddress lehnt 256.1.1.1 ab', !ValidationUtils.isValidIPAddress('256.1.1.1'));
check('isValidIPAddress lehnt Text ab', !ValidationUtils.isValidIPAddress('abc'));
check('isValidIPAddress lehnt unvollständig ab', !ValidationUtils.isValidIPAddress('192.168.1'));

// --- Subnetzmasken (zusammenhängende Einsen) ---
check('isValidSubnetMask akzeptiert 255.255.255.0', ValidationUtils.isValidSubnetMask('255.255.255.0'));
check('isValidSubnetMask akzeptiert 255.255.255.255', ValidationUtils.isValidSubnetMask('255.255.255.255'));
check('isValidSubnetMask lehnt 255.0.255.0 ab (nicht zusammenhängend)', !ValidationUtils.isValidSubnetMask('255.0.255.0'));

// --- Subnetz-Zugehörigkeit ---
check('areInSameSubnet: gleiches /24', ValidationUtils.areInSameSubnet('192.168.1.10', '192.168.1.20', '255.255.255.0'));
check('areInSameSubnet: verschiedenes Netz', !ValidationUtils.areInSameSubnet('192.168.1.10', '10.0.0.1', '255.255.255.0'));

// --- Domänennamen ---
check('isValidDomainName akzeptiert example.com', ValidationUtils.isValidDomainName('example.com'));
check('isValidDomainName akzeptiert sub.example.org', ValidationUtils.isValidDomainName('sub.example.org'));
check('isValidDomainName lehnt führenden Bindestrich ab', !ValidationUtils.isValidDomainName('-bad.com'));

// --- GUID (Azure-Reste sind weg, aber Helfer bleibt nützlich) ---
check('isValidGUID akzeptiert Null-GUID', ValidationUtils.isValidGUID('00000000-0000-0000-0000-000000000000'));
check('isValidGUID lehnt Müll ab', !ValidationUtils.isValidGUID('not-a-guid'));

// --- Pfade ---
check('isValidPath akzeptiert Laufwerkspfad', ValidationUtils.isValidPath('C:\\Windows\\System32'));
check('isValidPath akzeptiert UNC-Pfad', ValidationUtils.isValidPath('\\\\server\\share\\setup.msi'));
check('isValidPath lehnt ungültiges Zeichen ab', !ValidationUtils.isValidPath('C:\\a<b'));

// --- Locale (LCID:KeyboardID) ---
check('isValidLocale akzeptiert 0407:00000407', ValidationUtils.isValidLocale('0407:00000407'));
check('isValidLocale lehnt de-DE ab', !ValidationUtils.isValidLocale('de-DE'));

// --- Hardware-IDs ---
check('isValidHardwareId akzeptiert PCI\\VEN_…', ValidationUtils.isValidHardwareId('PCI\\VEN_8086&DEV_100E'));
check('isValidHardwareId lehnt Müll ab', !ValidationUtils.isValidHardwareId('xyz'));

// --- Passwortstärke ---
check('validatePassword meldet Schwächen bei "abc"', ValidationUtils.validatePassword('abc').length > 0);
check('validatePassword akzeptiert starkes Passwort', ValidationUtils.validatePassword('Str0ng!Pass').length === 0,
    JSON.stringify(ValidationUtils.validatePassword('Str0ng!Pass')));
check('validatePassword erkennt schwaches Standardpasswort', ValidationUtils.validatePassword('password').length > 0);

// --- Gesamtvalidierung: Fehler vs. gültig ---
const invalid = ValidationUtils.validateConfiguration({ windowsVersion: '', computerNameStrategy: 'fixed', computerName: '' });
check('validateConfiguration: ungültig bei fehlendem Computernamen', invalid.valid === false && invalid.errors.length > 0,
    JSON.stringify(invalid.errors));

// „Gültige" Minimal-Config muss seit dem Strenger-Refactor auch ein Admin-PW
// haben (sonst error wegen exponiertem Built-in-Konto).
const valid = ValidationUtils.validateConfiguration({
    windowsVersion: 'win11pro',
    computerNameStrategy: 'prompt',
    enableAdminAccount: true,
    adminPassword: 'AdminPw#1',
    adminPasswordConfirm: 'AdminPw#1'
});
check('validateConfiguration: gültig bei prompt-Strategie', valid.valid === true, JSON.stringify(valid.errors));
check('validateConfiguration: liefert errors- und warnings-Arrays',
    Array.isArray(valid.errors) && Array.isArray(valid.warnings));

console.log(`\n${failures === 0 ? 'ALLE TESTS BESTANDEN' : failures + ' TEST(S) FEHLGESCHLAGEN'}`);
process.exit(failures === 0 ? 0 : 1);
