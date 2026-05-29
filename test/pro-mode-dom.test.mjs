/**
 * DOM-Integrationstest (jsdom) für Bug 4 (Pro-Mode-Restore/Persist) und Bug 10
 * (Pro-Mode-Item-Sammlung via data-field).
 *
 * Treibt die ECHTE Pro-Mode-Render-Pipeline durch ein jsdom-DOM und prüft das
 * Zusammenspiel mit DynamicElements.collectXxx und ConfigManager. Da die App-
 * Module auf Modulebene window.X setzen bzw. Listener an document binden, werden
 * die Globals VOR dem dynamischen Import bereitgestellt.
 *
 * Alle Werte sind synthetisch (keine echten Zugangsdaten).
 */

import { JSDOM } from 'jsdom';

const dom = new JSDOM(
    '<!DOCTYPE html><html><body><div id="pro-content"></div></body></html>',
    { url: 'http://localhost/' }
);

// Globals, die die Module beim Laden / zur Laufzeit erwarten.
global.window = dom.window;
global.document = dom.window.document;
// global.navigator ist in Node read-only und wird hier nicht benötigt.
global.Event = dom.window.Event;                 // restoreTabValues nutzt bare new Event(...)
global.CustomEvent = dom.window.CustomEvent;
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);

const { ConfigManager } = await import('../js/config.js');
const { DynamicElements } = await import('../js/dynamic-elements.js');
const { LanguageManager } = await import('../js/language-manager.js');
const { ProMode } = await import('../js/pro-mode.js');
const { XMLGenerator } = await import('../js/xml-generator.js');
const { ValidationUtils } = await import('../js/validation.js');
const { UIHelpers } = await import('../js/ui-helpers.js');

// Übersetzungen sind für die Datensammlung irrelevant -> Schlüssel zurückgeben.
LanguageManager.t = (k) => k;
global.window.LanguageManager = LanguageManager;

let failures = 0;
function check(name, cond, detail = '') {
    if (!cond) failures++;
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '\n        ' + detail}`);
}

// =========================================================================
// Bug 10 — Im Pro-Mode gerenderte Items werden von collectXxx erfasst
// =========================================================================

// Partition: renderDiskTab enthält eine vorausgefüllte Default-Partition.
ConfigManager.config.partitions = [];
ProMode.loadContent('disk');
const partitions = DynamicElements.collectPartitions();
check('Bug10: Disk-Tab liefert >= 1 Partition', partitions.length >= 1, JSON.stringify(partitions));
check('Bug10: partition.type erfasst (primary)', partitions[0]?.type === 'primary', JSON.stringify(partitions[0]));
check('Bug10: partition.filesystem erfasst (ntfs)', partitions[0]?.filesystem === 'ntfs', JSON.stringify(partitions[0]));
check('Bug10: partition.size erfasst (500)', partitions[0]?.size === '500', JSON.stringify(partitions[0]));
check('Bug10: partition.label erfasst (EFI)', partitions[0]?.label === 'EFI', JSON.stringify(partitions[0]));

// User: Im Settings-Stil-Redesign gibt es kein vorgerendertes Default-Item mehr
// (der Add-Icon im Card-Title legt eines an). Wir klicken den Add-Button und
// prüfen anschließend die data-field-Attribute.
ProMode.loadContent('users');
document.getElementById('pro-addUserBtn')?.click();
const uName = document.querySelector('.user-item [data-field="username"]');
const uPass = document.querySelector('.user-item [data-field="password"]');
check('Bug10: User-Item hat data-field-Felder', !!uName && !!uPass);
if (uName && uPass) {
    uName.value = 'alice';
    uPass.value = 'Secret1!';
    const users = DynamicElements.collectUsers();
    check('Bug10: ausgefüllter Pro-Mode-User wird gesammelt',
        users.some(u => u.username === 'alice' && u.password === 'Secret1!'), JSON.stringify(users));
}

// Software: analog – Add-Button legt das Item an.
ProMode.loadContent('software');
document.getElementById('pro-addSoftwareBtn')?.click();
const sName = document.querySelector('.software-item [data-field="name"]');
const sPath = document.querySelector('.software-item [data-field="path"]');
const sArgs = document.querySelector('.software-item [data-field="arguments"]');
check('Bug10: Software-Item hat data-field name/path/arguments', !!sName && !!sPath && !!sArgs);
if (sName && sPath && sArgs) {
    sName.value = 'AppX';
    sPath.value = 'C:\\setup.msi';
    sArgs.value = '/quiet /norestart';
    const sw = DynamicElements.collectSoftware();
    check('Bug10: Software gesammelt (name+path)',
        sw.some(s => s.name === 'AppX' && s.path === 'C:\\setup.msi'), JSON.stringify(sw));
    check('Bug10: software-args -> arguments korrekt gemappt',
        sw.some(s => s.arguments === '/quiet /norestart'), JSON.stringify(sw));
}

// Driver: driver-path muss als data-field="infPath" ankommen.
ProMode.loadContent('drivers');
ProMode.addDriver();
const dName = document.querySelector('.driver-item [data-field="name"]');
const dPath = document.querySelector('.driver-item [data-field="infPath"]');
check('Bug10: Driver-Item hat data-field name/infPath', !!dName && !!dPath);
if (dName && dPath) {
    dName.value = 'NIC';
    dPath.value = '\\\\srv\\drivers\\e1000.inf';
    const drv = DynamicElements.collectDrivers();
    check('Bug10: driver-path -> infPath korrekt gemappt + gesammelt',
        drv.some(d => d.name === 'NIC' && d.infPath === '\\\\srv\\drivers\\e1000.inf'), JSON.stringify(drv));
}

// =========================================================================
// Bug 4 — Pro-Mode-Restore (config -> Felder) und Persist (Felder -> config)
// =========================================================================

// Restore eines statischen Textfelds.
ConfigManager.config.organization = 'ACME-Corp';
ProMode.loadContent('basic');
const orgField = document.getElementById('pro-organization');
check('Bug4: organization aus config wiederhergestellt',
    orgField?.value === 'ACME-Corp', orgField?.value);

// Restore einer Feature-Checkbox aus config.features (Array-Form).
ConfigManager.config.features = [{ name: 'hyperv', checked: true }];
ProMode.loadContent('features');
const hyperv = document.getElementById('pro-feat-hyperv');
check('Bug4: Feature-Checkbox aus config.features wiederhergestellt',
    hyperv?.checked === true, String(hyperv?.checked));

// Restore über Alias: networkMode-Feld <- config.networkConfig (Bug 10 Teil A).
ConfigManager.config.networkConfig = 'static';
ProMode.loadContent('network');
const nm = document.getElementById('pro-networkMode');
check('Bug4/10: networkMode aus config.networkConfig (Alias) wiederhergestellt',
    nm?.value === 'static', nm?.value);

// Persist: Eingabe in ein statisches Feld landet in config.
ProMode.loadContent('basic');
const orgField2 = document.getElementById('pro-organization');
orgField2.value = 'NeueFirma';
orgField2.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
check('Bug4: persistField schreibt organization-Änderung nach config',
    ConfigManager.config.organization === 'NeueFirma', ConfigManager.config.organization);

// Persist über Alias: acceptEula-Checkbox -> config.skipEula.
const eula = document.getElementById('pro-acceptEula');
check('Bug10: acceptEula-Feld vorhanden', !!eula);
if (eula) {
    eula.checked = false;
    eula.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    check('Bug4/10: acceptEula persistiert als config.skipEula (Alias)',
        ConfigManager.config.skipEula === false, String(ConfigManager.config.skipEula));
}

// Persist einer Feature-Checkbox -> config.features (Aggregation).
ProMode.loadContent('features');
const wsl = document.getElementById('pro-feat-wsl');
if (wsl) {
    wsl.checked = true;
    wsl.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    const feats = ConfigManager.config.features;
    check('Bug4: Feature-Änderung nach config.features aggregiert',
        Array.isArray(feats) && feats.some(f => f.name === 'wsl'), JSON.stringify(feats));
}

// =========================================================================
// Lücke 2/3 — Pro-Mode-Items werden persistiert und nach Tab-Wechsel/Reload
//             wiederhergestellt (gemeinsame Datenschicht).
// =========================================================================

// Partition: Default-Partition ausfüllen -> persistieren -> Tab wechseln -> zurück.
ConfigManager.config.partitions = [];
ProMode.loadContent('disk');
const labelField = document.querySelector('.partition-item [data-field="label"]');
check('Lücke2: Partition-Label-Feld vorhanden', !!labelField);
if (labelField) {
    labelField.value = 'SYSTEM';
    labelField.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    check('Lücke2: Partition nach Eingabe in config persistiert',
        Array.isArray(ConfigManager.config.partitions)
        && ConfigManager.config.partitions.some(p => p.label === 'SYSTEM'),
        JSON.stringify(ConfigManager.config.partitions));

    ProMode.loadContent('basic');   // Tab wechseln
    ProMode.loadContent('disk');    // zurück -> restoreItems
    const restoredLabel = document.querySelector('.partition-item [data-field="label"]');
    check('Lücke2: Partition-Label nach Tab-Wechsel wiederhergestellt',
        restoredLabel?.value === 'SYSTEM', restoredLabel?.value);
    check('Lücke2: genau 1 Partition (Default ersetzt, nicht dupliziert)',
        document.querySelectorAll('#pro-partitionList .partition-item').length === 1,
        String(document.querySelectorAll('#pro-partitionList .partition-item').length));
}

// User: ausfüllen -> persistieren -> Tab-Wechsel -> Restore.
ConfigManager.config.users = [];
ProMode.loadContent('users');
const u2Name = document.querySelector('.user-item [data-field="username"]');
const u2Pass = document.querySelector('.user-item [data-field="password"]');
if (u2Name && u2Pass) {
    u2Name.value = 'bob';
    u2Pass.value = 'Pw12345!';
    u2Name.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    u2Pass.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    check('Lücke2: User nach Eingabe persistiert',
        ConfigManager.config.users.some(u => u.username === 'bob'), JSON.stringify(ConfigManager.config.users));
    ProMode.loadContent('basic');
    ProMode.loadContent('users');
    const rName = document.querySelector('.user-item [data-field="username"]');
    check('Lücke2: User nach Tab-Wechsel wiederhergestellt', rName?.value === 'bob', rName?.value);
}

// =========================================================================
// Lücke 1 — Bisher ungenutzte Pro-Mode-Toggles landen jetzt im XML.
// =========================================================================
const flc = XMLGenerator.generateFirstLogonCommands({
    enableAdminAccount: true, disableCortana: true, disableOneDrive: true,
    disableLocation: true, disableAdvertising: true, gpUpdate: true,
    telemetryLevel: '1', enableIPv6: false
});
check('Lücke1: Cortana-Tweak im XML', flc.includes('AllowCortana'), flc);
check('Lücke1: OneDrive-Tweak im XML', flc.includes('DisableFileSyncNGSC'));
check('Lücke1: Location-Tweak im XML', flc.includes('DisableLocation'));
check('Lücke1: Advertising-Tweak im XML', flc.includes('DisabledByGroupPolicy'));
check('Lücke1: Telemetrie-Tweak im XML', flc.includes('AllowTelemetry'));
check('Lücke1: Admin-Konto aktiviert im XML', flc.includes('Administrator /active:yes'));
check('Lücke1: gpupdate im XML', flc.includes('gpupdate /force'));
check('Lücke1: IPv6-Deaktivierung im XML', flc.includes('DisabledComponents'));
check('Lücke1: ohne Toggles keine Privacy-Befehle',
    !XMLGenerator.generateFirstLogonCommands({}).includes('AllowCortana'));

// Default-Persistenz: ein besuchter Tab schreibt seine vorausgewählten Toggles in config.
ConfigManager.config.disableCortana = undefined;
ProMode.loadContent('oobe');
const cortanaBox = document.getElementById('pro-disableCortana');
check('Lücke1: disableCortana-Feld im oobe-Tab gefunden', !!cortanaBox);
if (cortanaBox) {
    check('Lücke1: vorausgewählter disableCortana-Default in config persistiert',
        ConfigManager.config.disableCortana === true, String(ConfigManager.config.disableCortana));
}

// =========================================================================
// Komplexe Felder (recherchiert): WINS/computerDescription/lockscreen landen im
// XML; Azure-AD-/Hybrid-Join & startLayout sind ENTFERNT (nicht via unattend möglich).
// =========================================================================

// WINS -> Microsoft-Windows-NetBT.
const wins = XMLGenerator.generateWinsConfiguration({ primaryWINS: '10.0.0.5', secondaryWINS: '10.0.0.6' });
check('Komplex: WINS erzeugt NetBT-Komponente', wins.includes('Microsoft-Windows-NetBT'), wins);
check('Komplex: WINS primär im XML', wins.includes('10.0.0.5'));
check('Komplex: WINS sekundär im XML', wins.includes('10.0.0.6'));
check('Komplex: ohne WINS keine NetBT-Komponente', XMLGenerator.generateWinsConfiguration({}) === '');

// computerDescription + lockscreen -> FirstLogonCommands.
const flc2 = XMLGenerator.generateFirstLogonCommands({
    computerDescription: 'Empfang-PC', lockscreen: 'C:\\brand\\lock.jpg'
});
check('Komplex: computerDescription -> srvcomment', flc2.includes('srvcomment') && flc2.includes('Empfang-PC'), flc2);
check('Komplex: lockscreen -> LockScreenImage', flc2.includes('LockScreenImage'), flc2);

// Azure-AD-/Hybrid-Join & startLayout sind aus der UI entfernt.
ProMode.loadContent('domain');
check('Entfernt: keine azuread-Option im Domain-Tab',
    !document.querySelector('#pro-joinType option[value="azuread"]'));
check('Entfernt: keine hybrid-Option im Domain-Tab',
    !document.querySelector('#pro-joinType option[value="hybrid"]'));
check('Entfernt: kein tenantId-Feld', !document.getElementById('pro-tenantId'));
ProMode.loadContent('oobe');
check('Entfernt: kein startLayout-Feld', !document.getElementById('pro-startLayout'));

// Validierung erzeugt keine Azure-AD-Warnung mehr (Feld/Zweig entfernt).
const azCheck = ValidationUtils.validateConfiguration({ windowsVersion: 'win11pro', joinType: 'azuread' });
check('Entfernt: keine Azure-AD-Warnung mehr in der Validierung',
    !azCheck.warnings.some(w => w.includes('Microsoft Entra')), JSON.stringify(azCheck.warnings));

// =========================================================================
// Lücke 4 — Shell-Command-Injection: Daten-Werte brechen nicht aus Shell-Quotes
// aus; reine Befehls-Felder bleiben bewusst unverändert.
// =========================================================================

check('Lücke4: cmdArg entfernt alle Quotes', !XMLGenerator.cmdArg('a"b"c').includes('"'));
check('Lücke4: cmdArg entfernt Zeilenumbrüche', !/[\r\n]/.test(XMLGenerator.cmdArg('a\r\nb')));
check('Lücke4: psArg verdoppelt Single-Quotes', XMLGenerator.psArg("a'b") === "a''b");

// Geplante Aufgabe: bösartiger Name darf nicht aus dem /tn-Quote ausbrechen.
const taskCmd = XMLGenerator.generateScheduledTaskCommand({
    name: 'evil" & calc & "', trigger: 'logon', action: 'C:\\a.exe', runAs: 'SYSTEM'
});
check('Lücke4: schtasks-Name ohne ausbrechende Quote', !taskCmd.includes('evil"'), taskCmd);

// startTime steht nicht in Quotes -> nur Ziffern/Doppelpunkt.
const taskTime = XMLGenerator.generateScheduledTaskCommand({
    name: 'T', trigger: 'daily', action: 'x', startTime: '08:00 & calc'
});
check('Lücke4: startTime numerisch gesäubert (kein calc)', !taskTime.includes('calc'), taskTime);

// MSI-Pfad (cmd-Quotes) und AppX-Pfad (PowerShell-Single-Quotes).
const swMsi = XMLGenerator.generateSoftwareInstallCommand({ type: 'msi', path: 'a.msi" & del C:\\* & "', arguments: '/q' });
check('Lücke4: MSI-Pfad ohne ausbrechende Quote', !swMsi.includes('.msi"'), swMsi);
const swAppx = XMLGenerator.generateSoftwareInstallCommand({ type: 'appx', path: "a'; calc; '" });
check('Lücke4: AppX-Pfad Single-Quotes verdoppelt', swAppx.includes("''"), swAppx);

// Naming-Skript: Präfix in PowerShell-Single-Quotes.
const naming = XMLGenerator.generateNamingScript({ computerNameStrategy: 'random', computerNamePrefix: "P'X" });
check('Lücke4: Naming-Präfix Single-Quotes verdoppelt', naming.includes("P''X"), naming);

// Befehls-Feld bleibt bewusst roh (kein versehentliches Escaping).
const psScript = XMLGenerator.generateScriptCommand({ type: 'powershell', command: 'Get-Process | Stop-Process' });
check('Lücke4: script.command bleibt roh (by-design Code)',
    psScript.includes('Get-Process | Stop-Process'), psScript);

// =========================================================================
// Lücke 5 — Verbindlicher Validierungs-Gate vor der XML-Generierung.
// =========================================================================
// alert/confirm in jsdom mocken, um die Gate-Pfade deterministisch zu prüfen.
let alertCount = 0;
let confirmResult = true;
UIHelpers.alert = () => { alertCount++; };
UIHelpers.confirm = () => confirmResult;
// Item-Container leeren, damit collectDynamicData() leere Listen liefert.
document.getElementById('pro-content').replaceChildren();

// (a) Fehlerhafte Konfiguration -> harter Abbruch, Fehlerübersicht, kein XML.
ConfigManager.config = { windowsVersion: 'win11pro', computerNameStrategy: 'fixed', computerName: '' };
alertCount = 0;
const genErr = XMLGenerator.generateXML();
check('Lücke5: Fehler blockiert Generierung (null)', genErr === null, String(genErr));
check('Lücke5: Fehler zeigt Übersicht (alert aufgerufen)', alertCount === 1, 'alertCount=' + alertCount);

// (b) Nur Warnungen + Nutzer bricht ab -> kein XML.
ConfigManager.config = { windowsVersion: 'win11pro', computerNameStrategy: 'prompt' };
confirmResult = false;
const genCancel = XMLGenerator.generateXML();
check('Lücke5: Warnung + Abbruch -> kein XML', genCancel === null, String(genCancel));

// (c) Nur Warnungen + Nutzer bestätigt -> XML wird generiert.
confirmResult = true;
const genOk = XMLGenerator.generateXML();
check('Lücke5: Warnung + Bestätigung -> XML generiert',
    typeof genOk === 'string' && genOk.includes('<unattend'), String(genOk).slice(0, 40));

// =========================================================================
// Lücke 6 — escapeXml/escapeHtml konsolidiert (eine Implementierung).
// =========================================================================
check('Lücke6: escapeXml liefert dasselbe wie escapeHtml',
    XMLGenerator.escapeXml(`<a b="c">&'`) === UIHelpers.escapeHtml(`<a b="c">&'`),
    XMLGenerator.escapeXml(`<a b="c">&'`));
check('Lücke6: Apostroph als &#39; (in XML & HTML gültig)',
    XMLGenerator.escapeXml("O'Brien") === 'O&#39;Brien', XMLGenerator.escapeXml("O'Brien"));
check('Lücke6: weiterhin korrekt für < > & "',
    XMLGenerator.escapeXml('<x> & "y"') === '&lt;x&gt; &amp; &quot;y&quot;', XMLGenerator.escapeXml('<x> & "y"'));

console.log(`\n${failures === 0 ? 'ALLE TESTS BESTANDEN' : failures + ' TEST(S) FEHLGESCHLAGEN'}`);
process.exit(failures === 0 ? 0 : 1);
