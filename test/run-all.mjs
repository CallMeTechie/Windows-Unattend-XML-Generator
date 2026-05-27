#!/usr/bin/env node
/**
 * Portabler Test-Runner (Bug 9).
 *
 * Führt alle Suiten test/*.test.mjs aus und aggregiert ihre Exit-Codes.
 * Beendet mit Code 1, sobald mindestens eine Suite fehlschlägt. Läuft auf
 * jeder Plattform über Node (kein Shell-Glob nötig) und wird von
 * `npm test` aufgerufen.
 */

import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const testDir = dirname(fileURLToPath(import.meta.url));
const suites = readdirSync(testDir)
    .filter(f => f.endsWith('.test.mjs'))
    .sort();

if (suites.length === 0) {
    console.error('Keine Testsuiten (test/*.test.mjs) gefunden.');
    process.exit(1);
}

let failed = 0;
for (const suite of suites) {
    console.log(`\n=== ${suite} ===`);
    const result = spawnSync(process.execPath, [join(testDir, suite)], { stdio: 'inherit' });
    if (result.status !== 0) failed++;
}

console.log(
    `\n${failed === 0
        ? `✓ Alle ${suites.length} Suiten bestanden`
        : `✗ ${failed} von ${suites.length} Suiten fehlgeschlagen`}`
);
process.exit(failed === 0 ? 0 : 1);
