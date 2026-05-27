/**
 * End-to-End-Test (jsdom): von Pro-Mode-Eingaben über mehrere Tabs bis zum
 * fertig generierten autounattend.xml.
 *
 * Deckt die Integrationslücke ab, die die Unit-Tests NICHT prüften: dynamische
 * Items werden über verschiedene Tabs verteilt eingegeben; der jeweils inaktive
 * Tab ist NICHT im DOM. collectDynamicData()/persistAllItems() lesen aber den
 * globalen DOM (= aktueller Tab) und dürfen Item-Typen anderer Tabs NICHT aus
 * der Konfiguration löschen.
 *
 * Alle Werte sind synthetisch.
 */

import { JSDOM } from 'jsdom';

const dom = new JSDOM(
    '<!DOCTYPE html><html><body><div id="pro-content"></div><div id="xmlPreview"></div></body></html>',
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
const { ProMode } = await import('../js/pro-mode.js');
const { XMLGenerator } = await import('../js/xml-generator.js');
const { UIHelpers } = await import('../js/ui-helpers.js');

LanguageManager.t = (k) => k;
global.window.LanguageManager = LanguageManager;
UIHelpers.alert = () => {};
UIHelpers.confirm = () => true;

let failures = 0;
function check(name, cond, detail = '') {
    if (!cond) failures++;
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '\n        ' + detail}`);
}

const aPartition = { type: 'primary', size: '40000', filesystem: 'ntfs', label: 'Windows', letter: 'C' };

// -------------------------------------------------------------------------
// (1) persistAllItems darf Items anderer Tabs NICHT löschen.
// -------------------------------------------------------------------------
ConfigManager.config = {
    windowsVersion: 'win11pro', computerNameStrategy: 'fixed', computerName: 'PC1',
    diskMode: 'manual', partitions: [{ ...aPartition }], users: []
};
ProMode.loadContent('users');                 // DOM = Users-Tab (keine Partition-Container)
const uname = document.querySelector('.user-item [data-field="username"]');
const upass = document.querySelector('.user-item [data-field="password"]');
if (uname && upass) {
    uname.value = 'bob';
    upass.value = 'Pw12345!';
    uname.dispatchEvent(new dom.window.Event('input', { bubbles: true })); // -> persistAllItems
}
check('E2E: Partition überlebt Bearbeitung eines Benutzers auf anderem Tab',
    Array.isArray(ConfigManager.config.partitions) && ConfigManager.config.partitions.length === 1,
    'partitions=' + JSON.stringify(ConfigManager.config.partitions));

// -------------------------------------------------------------------------
// (2) generateXML von einem Tab ohne Partition-Container verwirft die Partition nicht.
// -------------------------------------------------------------------------
ConfigManager.config = {
    windowsVersion: 'win11pro', computerNameStrategy: 'fixed', computerName: 'PC1',
    diskMode: 'manual', partitions: [{ ...aPartition }], users: []
};
ProMode.loadContent('users');                 // generieren von einem Nicht-Disk-Tab
const xml = XMLGenerator.generateXML();
check('E2E: generiertes XML enthält die Partition (DiskConfiguration)',
    typeof xml === 'string' && xml.includes('<DiskConfiguration>'),
    'xml-Anfang: ' + String(xml).slice(0, 120));

// -------------------------------------------------------------------------
// (3) Das erzeugte XML ist wohlgeformt – auch mit Sonderzeichen in Werten.
// -------------------------------------------------------------------------
ConfigManager.config = {
    windowsVersion: 'win11pro', computerNameStrategy: 'fixed', computerName: 'PC1',
    organization: 'ACME & Co <Ltd>', owner: 'O\'Brien', timezone: 'W. Europe Standard Time',
    diskMode: 'manual', partitions: [{ ...aPartition }], users: []
};
ProMode.loadContent('disk');                  // Disk-Tab aktiv
const xml2 = XMLGenerator.generateXML();
const parsed = new dom.window.DOMParser().parseFromString(xml2 || '', 'text/xml');
check('E2E: XML ist wohlgeformt (kein parsererror)',
    !!xml2 && !parsed.querySelector('parsererror'),
    parsed.querySelector('parsererror')?.textContent || 'kein XML');
check('E2E: Sonderzeichen in organization sind escaped',
    !!xml2 && xml2.includes('ACME &amp; Co &lt;Ltd&gt;'), 'org nicht escaped');

console.log(`\n${failures === 0 ? 'ALLE TESTS BESTANDEN' : failures + ' TEST(S) FEHLGESCHLAGEN'}`);
process.exit(failures === 0 ? 0 : 1);
