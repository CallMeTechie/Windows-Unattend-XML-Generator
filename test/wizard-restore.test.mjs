/**
 * Regressionstest für Bug 13: Der Wizard muss beim (Re)Initialisieren die
 * gespeicherten Basis-Felder aus der Konfiguration in die Schritt-Felder
 * zurückschreiben – sonst liest das von goToStep() ausgelöste saveCurrentStepData()
 * die leeren Felder und überschreibt die Konfiguration (Datenverlust bei Reload).
 *
 * Alle Werte sind synthetisch.
 */

import { JSDOM } from 'jsdom';

const dom = new JSDOM(
    '<!DOCTYPE html><html><body><div id="wizard-content"></div></body></html>',
    { url: 'http://localhost/' }
);
global.window = dom.window;
global.document = dom.window.document;
global.Event = dom.window.Event;
global.CustomEvent = dom.window.CustomEvent;
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);

const { ConfigManager } = await import('../js/config.js');
const { LanguageManager } = await import('../js/language-manager.js');
const { WizardMode } = await import('../js/wizard.js');
const { UIHelpers } = await import('../js/ui-helpers.js');

LanguageManager.t = (k) => k;
global.window.LanguageManager = LanguageManager;
UIHelpers.showNotification = () => {};

let failures = 0;
function check(name, cond, detail = '') {
    if (!cond) failures++;
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '\n        ' + detail}`);
}

// Reload-Szenario: gespeicherte Konfiguration ist bereits vorhanden, dann wird
// der Wizard initialisiert (wie beim App-Start im Wizard-Modus).
ConfigManager.config = {
    windowsVersion: 'win11pro', computerNameStrategy: 'fixed', computerName: 'SAVED-PC',
    organization: 'ACME-Corp', timezone: 'W. Europe Standard Time',
    partitions: [], users: [], softwarePackages: []
};
ConfigManager.currentMode = 'wizard';
ConfigManager.currentStep = 1;

WizardMode.initializeSteps();

// Die gespeicherten Werte dürfen NICHT durch leere Felder überschrieben werden.
check('Bug13: config.computerName überlebt Wizard-Start', ConfigManager.config.computerName === 'SAVED-PC',
    'computerName=' + JSON.stringify(ConfigManager.config.computerName));
check('Bug13: config.organization überlebt Wizard-Start', ConfigManager.config.organization === 'ACME-Corp',
    'organization=' + JSON.stringify(ConfigManager.config.organization));

// Und die Felder zeigen die gespeicherten Werte (Field-Restore).
check('Bug13: computerName-Feld zeigt gespeicherten Wert',
    document.getElementById('computerName')?.value === 'SAVED-PC',
    'value=' + JSON.stringify(document.getElementById('computerName')?.value));
check('Bug13: organization-Feld zeigt gespeicherten Wert',
    document.getElementById('organization')?.value === 'ACME-Corp',
    'value=' + JSON.stringify(document.getElementById('organization')?.value));

console.log(`\n${failures === 0 ? 'ALLE TESTS BESTANDEN' : failures + ' TEST(S) FEHLGESCHLAGEN'}`);
process.exit(failures === 0 ? 0 : 1);
