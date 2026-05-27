/**
 * End-to-End-Test (jsdom) für den Wizard-Modus.
 *
 * Der Wizard rendert über initializeSteps() ALLE 6 Schritte gleichzeitig
 * (inaktive nur per display:none) – die Item-Container partitionList/userList/
 * softwareList sind also dauerhaft im DOM. Dieser Test legt in den verschiedenen
 * Schritten Partition, Benutzer und Software an und prüft, dass alle drei im
 * generierten, wohlgeformten autounattend.xml landen (Gegenstück zum Pro-Mode-
 * E2E-Test; sichert ab, dass der Cross-Container-Fix auch hier greift).
 *
 * Alle Werte sind synthetisch.
 */

import { JSDOM } from 'jsdom';

const dom = new JSDOM(
    '<!DOCTYPE html><html><body><div id="wizard-content"></div><div id="xmlPreview"></div></body></html>',
    { url: 'http://localhost/' }
);
global.window = dom.window;
global.document = dom.window.document;
global.Event = dom.window.Event;
global.CustomEvent = dom.window.CustomEvent;
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);

const { ConfigManager } = await import('../js/config.js');
const { DynamicElements } = await import('../js/dynamic-elements.js');
const { LanguageManager } = await import('../js/language-manager.js');
const { WizardMode } = await import('../js/wizard.js');
const { XMLGenerator } = await import('../js/xml-generator.js');
const { UIHelpers } = await import('../js/ui-helpers.js');

LanguageManager.t = (k) => k;
global.window.LanguageManager = LanguageManager;
UIHelpers.alert = () => {};
UIHelpers.confirm = () => true;
UIHelpers.showNotification = () => {};   // im Test irrelevant

let failures = 0;
function check(name, cond, detail = '') {
    if (!cond) failures++;
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '\n        ' + detail}`);
}

function fill(item, field, value) {
    const el = item.querySelector(`[data-field="${field}"]`);
    if (el) el.value = value;
}

// --- Wizard initialisieren -------------------------------------------------
ConfigManager.config = { partitions: [], users: [], softwarePackages: [] };
ConfigManager.currentMode = 'wizard';
ConfigManager.currentStep = 1;
WizardMode.initializeSteps();   // rendert ALLE Schritte gleichzeitig

// Basis-Felder NACH dem Rendern setzen: initializeSteps() -> goToStep(1) ruft
// saveCurrentStepData() und liest dabei die (vom Wizard NICHT aus config
// befüllten) leeren Schritt-1-Felder. Würden wir die Basis vorher setzen, würde
// sie hier mit '' überschrieben (separater Befund: Wizard-Field-Restore fehlt).
Object.assign(ConfigManager.config, {
    windowsVersion: 'win11pro', computerNameStrategy: 'fixed', computerName: 'WIZ-PC',
    organization: 'ACME', adminPassword: 'Admin123!', diskMode: 'manual'
});
check('Wizard: alle Item-Container gerendert',
    !!document.getElementById('partitionList') && !!document.getElementById('userList')
    && !!document.getElementById('softwareList'));

// --- Schritt 2: Partition anlegen + füllen ---------------------------------
DynamicElements.addPartition();
const part = document.querySelector('#partitionList .partition-item');
check('Wizard: Partition-Item angelegt', !!part);
if (part) {
    fill(part, 'type', 'primary');
    fill(part, 'size', '50000');
    fill(part, 'filesystem', 'ntfs');
    fill(part, 'label', 'Windows');
    fill(part, 'letter', 'C');
}

// --- Schritt 3: Benutzer anlegen + füllen ----------------------------------
DynamicElements.addUser();
const user = document.querySelector('#userList .user-item');
check('Wizard: User-Item angelegt', !!user);
if (user) {
    fill(user, 'username', 'wizuser');
    fill(user, 'password', 'UserPw1!');
    fill(user, 'group', 'administrators');
}

// --- Schritt 5: Software anlegen + füllen -----------------------------------
DynamicElements.addSoftware();
const sw = document.querySelector('#softwareList .software-item');
check('Wizard: Software-Item angelegt', !!sw);
if (sw) {
    fill(sw, 'name', '7zip');
    fill(sw, 'type', 'msi');
    fill(sw, 'path', 'C:\\inst\\7z.msi');
    fill(sw, 'arguments', '/quiet');
}

// --- Generierung (Items aus allen Schritten müssen einfließen) -------------
const xml = XMLGenerator.generateXML();
check('Wizard: XML generiert', typeof xml === 'string' && xml.includes('<unattend'), String(xml).slice(0, 60));
check('Wizard: Partition im XML (DiskConfiguration)', !!xml && xml.includes('<DiskConfiguration>'), 'fehlt');
check('Wizard: Benutzer im XML (Name=wizuser)', !!xml && xml.includes('<Name>wizuser</Name>'), 'fehlt');
check('Wizard: Software im XML (7z.msi)', !!xml && xml.includes('7z.msi'), 'fehlt');
check('Wizard: Computername im XML', !!xml && xml.includes('<ComputerName>WIZ-PC</ComputerName>'), 'fehlt');

// --- Wohlgeformtheit --------------------------------------------------------
const parsed = new dom.window.DOMParser().parseFromString(xml || '', 'text/xml');
check('Wizard: XML ist wohlgeformt (kein parsererror)', !!xml && !parsed.querySelector('parsererror'),
    parsed.querySelector('parsererror')?.textContent || 'kein XML');

console.log(`\n${failures === 0 ? 'ALLE TESTS BESTANDEN' : failures + ' TEST(S) FEHLGESCHLAGEN'}`);
process.exit(failures === 0 ? 0 : 1);
