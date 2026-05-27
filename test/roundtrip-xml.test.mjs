/**
 * Roundtrip-Test: generieren -> importieren -> erneut generieren.
 *
 * Prüft XMLGenerator.extractConfigFromXML() (Import) gegen buildAutounattendXML()
 * (Generierung). extractConfigFromXML liest bewusst nur Basis-Felder zurück
 * (computerName, organization, timezone, uilanguage, productKey, statisches Netz,
 * Domänen-Name) – dynamische Items werden NICHT importiert. Der Test verifiziert
 * den unterstützten Roundtrip und deckt auf, ob das erneute Generieren nach einem
 * Import robust ist.
 *
 * Alle Werte sind synthetisch (generischer Windows-11-Pro-Evaluierungsschlüssel).
 */

import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost/' });
global.window = dom.window;
global.document = dom.window.document;

const { XMLGenerator } = await import('../js/xml-generator.js');
const { LanguageManager } = await import('../js/language-manager.js');
LanguageManager.t = (k) => k;
global.window.LanguageManager = LanguageManager;

const parse = (xml) => new dom.window.DOMParser().parseFromString(xml, 'text/xml');

let failures = 0;
function check(name, cond, detail = '') {
    if (!cond) failures++;
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '\n        ' + detail}`);
}

// =========================================================================
// (1) Basis-Roundtrip: generieren -> importieren -> erneut generieren.
// =========================================================================
const base = {
    windowsVersion: 'win11pro', computerName: 'RT-PC', computerNameStrategy: 'fixed',
    organization: 'ACME GmbH', timezone: 'W. Europe Standard Time', uilanguage: 'de-DE',
    productKey: 'VK7JG-NPHTM-C97JM-9MPGT-3V66T'
};
const xml1 = XMLGenerator.buildAutounattendXML(base);
const doc1 = parse(xml1);
check('Roundtrip: erstes XML wohlgeformt', !doc1.querySelector('parsererror'));

const imported = XMLGenerator.extractConfigFromXML(doc1);
check('Roundtrip: computerName importiert', imported.computerName === 'RT-PC', imported.computerName);
check('Roundtrip: computerNameStrategy=fixed', imported.computerNameStrategy === 'fixed', imported.computerNameStrategy);
check('Roundtrip: organization importiert', imported.organization === 'ACME GmbH', imported.organization);
check('Roundtrip: timezone importiert', imported.timezone === 'W. Europe Standard Time', imported.timezone);
check('Roundtrip: uilanguage importiert', imported.uilanguage === 'de-DE', imported.uilanguage);
check('Roundtrip: productKey importiert', imported.productKey === 'VK7JG-NPHTM-C97JM-9MPGT-3V66T', imported.productKey);

// Erneut generieren: die importierten Basiswerte müssen stabil bleiben.
const xml2 = XMLGenerator.buildAutounattendXML({ ...base, ...imported });
check('Roundtrip: zweites XML wohlgeformt', !parse(xml2).querySelector('parsererror'));
check('Roundtrip: computerName stabil', xml2.includes('<ComputerName>RT-PC</ComputerName>'));
check('Roundtrip: organization stabil', xml2.includes('ACME GmbH'));

// =========================================================================
// (2) Domänen-Roundtrip.
// =========================================================================
const dom1 = XMLGenerator.buildAutounattendXML({
    windowsVersion: 'win11pro', computerName: 'D-PC', computerNameStrategy: 'fixed',
    joinType: 'domain', domainName: 'corp.local', domainUser: 'admin', domainPassword: 'pw'
});
const dImp = XMLGenerator.extractConfigFromXML(parse(dom1));
check('Roundtrip: joinType=domain importiert', dImp.joinType === 'domain', dImp.joinType);
check('Roundtrip: domainName importiert', dImp.domainName === 'corp.local', dImp.domainName);

// =========================================================================
// (3) Netzwerk-Roundtrip: realistischer Fall – frische Konfiguration importiert
//     eine generierte XML und generiert erneut. extractConfigFromXML liest
//     subnetMask NICHT zurück -> erneutes Generieren muss trotzdem robust sein.
// =========================================================================
const net1 = XMLGenerator.buildAutounattendXML({
    windowsVersion: 'win11pro', computerName: 'N-PC', computerNameStrategy: 'fixed',
    networkConfig: 'static', ipAddress: '192.168.1.50', subnetMask: '255.255.255.0', gateway: '192.168.1.1'
});
const nImp = XMLGenerator.extractConfigFromXML(parse(net1));
check('Roundtrip: networkConfig=static importiert', nImp.networkConfig === 'static', nImp.networkConfig);
check('Roundtrip: ipAddress importiert', nImp.ipAddress === '192.168.1.50', nImp.ipAddress);
check('Roundtrip: gateway importiert', nImp.gateway === '192.168.1.1', nImp.gateway);
check('Roundtrip: subnetMask aus CIDR rekonstruiert', nImp.subnetMask === '255.255.255.0', nImp.subnetMask);

// calculateCIDR muss robust gegen fehlende Maske sein (defensive Härtung).
check('Roundtrip: calculateCIDR(undefined) crasht nicht', XMLGenerator.calculateCIDR(undefined) === 24,
    String(XMLGenerator.calculateCIDR(undefined)));

// Frische Konfiguration + Import -> erneut generieren (muss robust sein).
let crashed = false;
let net2 = '';
try {
    net2 = XMLGenerator.buildAutounattendXML({ windowsVersion: 'win11pro', ...nImp });
} catch (e) {
    crashed = true;
    console.log('        [crash]:', e.message);
}
check('Roundtrip: Generieren nach Netzwerk-Import crasht nicht', !crashed);
check('Roundtrip: drittes XML wohlgeformt', !crashed && !parse(net2).querySelector('parsererror'));

// =========================================================================
// (4) Vollständiger Import: strukturierte Daten (Partitionen, Benutzer inkl.
//     dekodierter Passwörter, erweiterte Basis-Felder) roundtrippen.
// =========================================================================
const full = {
    windowsVersion: 'win11pro', computerName: 'FULL-PC', computerNameStrategy: 'fixed',
    owner: 'Max Mustermann', organization: 'ACME', systemLocale: 'de-DE',
    inputLocale: '0407:00000407', userLocale: 'de-DE', adminPassword: 'Admin#123',
    diskMode: 'manual',
    partitions: [
        { type: 'efi', size: '500', filesystem: 'fat32', label: 'System', letter: '' },
        { type: 'primary', size: '', filesystem: 'ntfs', label: 'Windows', letter: 'C', active: true }
    ],
    users: [
        { username: 'alice', password: 'Alice#1Pw', fullname: 'Alice A', description: 'Admin-Konto', group: 'Administrators' }
    ]
};
const fXml = XMLGenerator.buildAutounattendXML(full);
const fImp = XMLGenerator.extractConfigFromXML(parse(fXml));

check('VollImport: owner', fImp.owner === 'Max Mustermann', fImp.owner);
check('VollImport: systemLocale', fImp.systemLocale === 'de-DE', fImp.systemLocale);
check('VollImport: inputLocale', fImp.inputLocale === '0407:00000407', fImp.inputLocale);

check('VollImport: 2 Partitionen', Array.isArray(fImp.partitions) && fImp.partitions.length === 2,
    JSON.stringify(fImp.partitions));
check('VollImport: Partition[0] type=efi', fImp.partitions?.[0]?.type === 'efi', JSON.stringify(fImp.partitions?.[0]));
check('VollImport: Windows-Partition vorhanden',
    !!fImp.partitions?.some(p => p.label === 'Windows' && p.filesystem === 'ntfs'), JSON.stringify(fImp.partitions));

check('VollImport: 1 Benutzer', Array.isArray(fImp.users) && fImp.users.length === 1, JSON.stringify(fImp.users));
check('VollImport: Benutzername', fImp.users?.[0]?.username === 'alice', JSON.stringify(fImp.users?.[0]));
check('VollImport: Benutzer-Vollname', fImp.users?.[0]?.fullname === 'Alice A', fImp.users?.[0]?.fullname);
check('VollImport: Benutzer-Passwort dekodiert', fImp.users?.[0]?.password === 'Alice#1Pw', fImp.users?.[0]?.password);
check('VollImport: adminPassword dekodiert', fImp.adminPassword === 'Admin#123', fImp.adminPassword);

// =========================================================================
// (5) Metadaten-Kommentar: shell-basierte Items (Software/Skripte/Tasks/Treiber)
//     roundtrippen über den eingebetteten Metadaten-Kommentar – verlustfrei.
// =========================================================================
const meta = {
    windowsVersion: 'win11pro', computerName: 'META-PC', computerNameStrategy: 'fixed', diskMode: 'manual',
    softwarePackages: [{ name: '7zip', type: 'msi', path: 'C:\\7z.msi', arguments: '/quiet' }],
    scripts: [{ name: 'cfg', type: 'powershell', command: 'Set-X', phase: 'firstLogon' }],
    tasks: [{ name: 'Backup', trigger: 'daily', action: 'C:\\b.exe', startTime: '02:00' }],
    drivers: [{ name: 'NIC', type: 'network', infPath: 'C:\\nic.inf' }]
};
const mXml = XMLGenerator.buildAutounattendXML(meta);
const mImp = XMLGenerator.extractConfigFromXML(parse(mXml));
check('Meta: Software roundtrippt', mImp.softwarePackages?.[0]?.name === '7zip' && mImp.softwarePackages?.[0]?.path === 'C:\\7z.msi',
    JSON.stringify(mImp.softwarePackages));
check('Meta: Skripte roundtrippen', mImp.scripts?.[0]?.command === 'Set-X', JSON.stringify(mImp.scripts));
check('Meta: Tasks roundtrippen', mImp.tasks?.[0]?.name === 'Backup', JSON.stringify(mImp.tasks));
check('Meta: Treiber roundtrippen', mImp.drivers?.[0]?.infPath === 'C:\\nic.inf', JSON.stringify(mImp.drivers));

// Sicherheit: KEINE Klartext-Passwörter im Metadaten-Kommentar (Bug-7-konform);
// dennoch werden Passwörter über die encoded <Value> beim Import dekodiert.
const pwCfg = {
    windowsVersion: 'win11pro', computerName: 'PW-PC', computerNameStrategy: 'fixed',
    adminPassword: 'Secret#1', users: [{ username: 'u', password: 'Upw#2', group: 'Users' }]
};
const pwXml = XMLGenerator.buildAutounattendXML(pwCfg);
check('Meta: kein Klartext-Admin-Passwort im XML', !pwXml.includes('Secret#1'), 'Klartext gefunden!');
check('Meta: kein Klartext-Benutzer-Passwort im XML', !pwXml.includes('Upw#2'), 'Klartext gefunden!');
const pwImp = XMLGenerator.extractConfigFromXML(parse(pwXml));
check('Meta: adminPassword trotzdem dekodiert importiert', pwImp.adminPassword === 'Secret#1', pwImp.adminPassword);
check('Meta: Benutzer-Passwort dekodiert importiert', pwImp.users?.[0]?.password === 'Upw#2', pwImp.users?.[0]?.password);

console.log(`\n${failures === 0 ? 'ALLE TESTS BESTANDEN' : failures + ' TEST(S) FEHLGESCHLAGEN'}`);
process.exit(failures === 0 ? 0 : 1);
