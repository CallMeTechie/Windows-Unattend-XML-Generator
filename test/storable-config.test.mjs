/**
 * Test für ConfigManager.getStorableConfig() — verhindert, dass Klartext-
 * Passwörter nach localStorage gelangen (Bug 7).
 *
 * config.js ist abhängigkeitsfrei und greift auf Modulebene nicht auf
 * Browser-APIs (window/localStorage) zu, daher kann ConfigManager direkt
 * importiert werden – Quelle und Test laufen so nicht auseinander.
 *
 * Alle Passwörter sind synthetisch (keine echten Zugangsdaten).
 */

import { ConfigManager } from '../js/config.js';

let failures = 0;
function check(name, cond, detail = '') {
    if (!cond) failures++;
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '\n        ' + detail}`);
}

// Synthetische Konfiguration mit Passwörtern setzen.
ConfigManager.config = {
    windowsVersion: 'win11pro',
    adminPassword: 'S3cret!Admin',
    adminPasswordConfirm: 'S3cret!Admin',
    domainPassword: 'S3cret!Domain',
    organization: 'ACME',
    users: [
        { username: 'alice', password: 'AlicePw1', group: 'administrators' },
        { username: 'bob',   password: 'BobPw2',   group: 'users' }
    ],
    tasks: [{ name: 'T1', action: 'foo.exe' }]
};

const storable = ConfigManager.getStorableConfig();

// 1) Top-Level-Passwörter sind entfernt
check('adminPassword entfernt',        !('adminPassword' in storable));
check('adminPasswordConfirm entfernt', !('adminPasswordConfirm' in storable));
check('domainPassword entfernt',       !('domainPassword' in storable));

// 2) Benutzer-Passwörter entfernt, übrige Konto-Felder bleiben
check('users[0].password entfernt', !('password' in storable.users[0]));
check('users[1].password entfernt', !('password' in storable.users[1]));
check('users[0].username bleibt',   storable.users[0].username === 'alice');
check('users[1].group bleibt',      storable.users[1].group === 'users');

// 3) Nicht-Passwort-Felder bleiben unverändert
check('organization bleibt', storable.organization === 'ACME');
check('tasks bleiben',       Array.isArray(storable.tasks) && storable.tasks.length === 1);

// 4) Live-Konfiguration wurde NICHT mutiert (Formular-State behält Passwörter)
check('Live adminPassword unverändert',     ConfigManager.config.adminPassword === 'S3cret!Admin');
check('Live users[0].password unverändert', ConfigManager.config.users[0].password === 'AlicePw1');

// 5) Der serialisierte Storage-String enthält keinerlei Klartext-Passwort
const serialized = JSON.stringify(storable);
check('Serialisierung ohne Admin-/Domain-Passwort',
    !serialized.includes('S3cret!Admin') && !serialized.includes('S3cret!Domain'), serialized);
check('Serialisierung ohne Benutzer-Passwörter',
    !serialized.includes('AlicePw1') && !serialized.includes('BobPw2'), serialized);

console.log(`\n${failures === 0 ? 'ALLE TESTS BESTANDEN' : failures + ' TEST(S) FEHLGESCHLAGEN'}`);
process.exit(failures === 0 ? 0 : 1);
