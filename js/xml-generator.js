/**
 * XML Generator - ENHANCED VERSION
 * Handles generation of autounattend.xml based on configuration
 * Supports all new data structures from Pro Mode
 * Multi-language version
 */

import { ConfigManager } from './config.js';
import { UIHelpers } from './ui-helpers.js';
import { DynamicElements } from './dynamic-elements.js';
import { ValidationUtils } from './validation.js';
import { LanguageManager } from './language-manager.js';

export const XMLGenerator = {
    /**
     * Generate complete autounattend.xml
     */
    generateXML() {
        const config = ConfigManager.getConfig();
        const dynamicData = DynamicElements.collectDynamicData();
        
        // Merge dynamic data into config
        Object.assign(config, dynamicData);
        
        // Verbindlicher Validierungs-Gate (Lücke 5): Bei Fehlern wird die
        // Generierung hart abgebrochen und ALLE Fehler werden angezeigt (zuvor
        // nur der erste). Liegen nur Warnungen vor, muss der Nutzer die
        // Generierung bewusst bestätigen.
        const validation = ValidationUtils.validateConfiguration(config);
        if (!validation.valid) {
            UIHelpers.alert(ValidationUtils.createValidationSummary(validation));
            return null;
        }
        if (validation.warnings && validation.warnings.length > 0) {
            if (!UIHelpers.confirm(ValidationUtils.createValidationSummary(validation))) {
                return null;
            }
        }

        const xml = this.buildAutounattendXML(config);
        
        // Show in modal
        const xmlPreview = document.getElementById('xmlPreview');
        if (xmlPreview) {
            xmlPreview.innerHTML = UIHelpers.highlightXML(xml);
        }
        
        // Also update pro mode preview if visible
        const proXmlPreview = document.getElementById('pro-xmlPreview');
        if (proXmlPreview) {
            proXmlPreview.innerHTML = UIHelpers.highlightXML(xml);
        }
        
        UIHelpers.showModal('xmlModal');
        
        return xml;
    },

    /**
     * Build autounattend.xml structure
     */
    buildAutounattendXML(config) {
        return `<?xml version="1.0" encoding="utf-8"?>
<unattend xmlns="urn:schemas-microsoft-com:unattend">
    ${this.buildMetadataComment(config)}
    ${this.generateSettings(config)}
</unattend>`;
    },

    /**
     * Bettet die Konfiguration als Base64-JSON in einen XML-Kommentar ein, damit
     * der Import auch Felder verlustfrei wiederherstellen kann, die im XML nur als
     * Shell-Befehle vorliegen (Software/Skripte/Tasks/Treiber) oder gar nicht
     * abgebildet werden. Passwörter werden NICHT eingebettet (Bug 7); sie werden
     * beim Import aus den encoded <Value> dekodiert. Base64 vermeidet Probleme mit
     * '--' und Sonderzeichen in XML-Kommentaren.
     */
    buildMetadataComment(config) {
        const clone = JSON.parse(JSON.stringify(config || {}));
        delete clone.adminPassword;
        delete clone.adminPasswordConfirm;
        delete clone.domainPassword;
        if (Array.isArray(clone.users)) {
            clone.users.forEach(u => { if (u && typeof u === 'object') delete u.password; });
        }
        const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(clone))));
        return `<!-- autounattend-generator-config:${b64} -->`;
    },

    /**
     * Generate all settings passes
     */
    generateSettings(config) {
        let settings = '';
        
        // Pass 1: windowsPE
        settings += this.generateWindowsPEPass(config);
        
        // Pass 2: offlineServicing
        if (this.hasOfflineServicingSettings(config)) {
            settings += this.generateOfflineServicingPass(config);
        }
        
        // Pass 3: generalize
        if (this.hasGeneralizeSettings(config)) {
            settings += this.generateGeneralizePass(config);
        }
        
        // Pass 4: specialize
        settings += this.generateSpecializePass(config);
        
        // Pass 5: auditSystem
        if (this.hasAuditSystemSettings(config)) {
            settings += this.generateAuditSystemPass(config);
        }
        
        // Pass 6: auditUser
        if (this.hasAuditUserSettings(config)) {
            settings += this.generateAuditUserPass(config);
        }
        
        // Pass 7: oobeSystem
        settings += this.generateOobeSystemPass(config);
        
        return settings;
    },

    /**
     * Generate windowsPE pass
     */
    generateWindowsPEPass(config) {
        return `
    <settings pass="windowsPE">
        <component name="Microsoft-Windows-International-Core-WinPE" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS" xmlns:wcm="http://schemas.microsoft.com/WMIConfig/2002/State" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
            <SetupUILanguage>
                <UILanguage>${config.uilanguage || 'en-US'}</UILanguage>
            </SetupUILanguage>
            <InputLocale>${config.inputLocale || '0409:00000409'}</InputLocale>
            <SystemLocale>${config.systemLocale || 'en-US'}</SystemLocale>
            <UILanguage>${config.uilanguage || 'en-US'}</UILanguage>
            <UILanguageFallback>${config.uilanguage || 'en-US'}</UILanguageFallback>
            <UserLocale>${config.userLocale || config.uilanguage || 'en-US'}</UserLocale>
        </component>
        <component name="Microsoft-Windows-Setup" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS" xmlns:wcm="http://schemas.microsoft.com/WMIConfig/2002/State" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
            ${this.generateDiskConfiguration(config)}
            ${this.generateImageInstall(config)}
            ${this.generateUserData(config)}
            ${this.generateDriverPaths(config, 'windowsPE')}
            ${this.generateRunSynchronous(config, 'windowsPE')}
        </component>
    </settings>`;
    },

    /**
     * Generate disk configuration
     */
    generateDiskConfiguration(config) {
        if (config.diskMode === 'auto' || !config.partitions || config.partitions.length === 0) {
            return '';
        }
        
        let diskConfig = `
            <DiskConfiguration>
                <Disk wcm:action="add">
                    <DiskID>${config.targetDisk || 0}</DiskID>
                    <WillWipeDisk>${config.cleanDisk !== false ? 'true' : 'false'}</WillWipeDisk>`;
        
        // Create partitions
        if (config.partitions && config.partitions.length > 0) {
            diskConfig += `
                    <CreatePartitions>`;
            
            config.partitions.forEach((partition, index) => {
                diskConfig += `
                        <CreatePartition wcm:action="add">
                            <Order>${index + 1}</Order>`;
                
                if (partition.type === 'efi') {
                    diskConfig += `
                            <Type>EFI</Type>
                            <Size>500</Size>`;
                } else if (partition.type === 'msr') {
                    diskConfig += `
                            <Type>MSR</Type>
                            <Size>128</Size>`;
                } else if (partition.type === 'recovery') {
                    diskConfig += `
                            <Type>Recovery</Type>
                            <Size>${partition.size || 500}</Size>`;
                } else {
                    diskConfig += `
                            <Type>Primary</Type>`;
                    if (partition.size && partition.size > 0) {
                        diskConfig += `
                            <Size>${partition.size}</Size>`;
                    } else {
                        diskConfig += `
                            <Extend>true</Extend>`;
                    }
                }
                
                diskConfig += `
                        </CreatePartition>`;
            });
            
            diskConfig += `
                    </CreatePartitions>`;
            
            // Modify partitions
            diskConfig += `
                    <ModifyPartitions>`;
            
            config.partitions.forEach((partition, index) => {
                diskConfig += `
                        <ModifyPartition wcm:action="add">
                            <Order>${index + 1}</Order>
                            <PartitionID>${index + 1}</PartitionID>`;
                
                if (partition.label) {
                    diskConfig += `
                            <Label>${partition.label}</Label>`;
                }
                
                if (partition.letter && partition.type !== 'efi' && partition.type !== 'msr') {
                    diskConfig += `
                            <Letter>${partition.letter}</Letter>`;
                }
                
                if (partition.filesystem) {
                    const format = partition.filesystem.toUpperCase().replace('FAT32', 'FAT32');
                    diskConfig += `
                            <Format>${format}</Format>`;
                }
                
                if (partition.active) {
                    diskConfig += `
                            <Active>true</Active>`;
                }
                
                diskConfig += `
                        </ModifyPartition>`;
            });
            
            diskConfig += `
                    </ModifyPartitions>`;
        }
        
        diskConfig += `
                </Disk>
            </DiskConfiguration>`;
        
        return diskConfig;
    },

    /**
     * Generate image install settings
     */
    generateImageInstall(config) {
        let installTo = 0;
        let installPartition = 1;
        
        // Find Windows partition
        if (config.partitions && config.partitions.length > 0) {
            config.partitions.forEach((partition, index) => {
                if (partition.type === 'primary' && (!partition.label || partition.label.toLowerCase().includes('windows'))) {
                    installPartition = index + 1;
                }
            });
        }
        
        return `
            <ImageInstall>
                <OSImage>
                    <InstallFrom>
                        <MetaData wcm:action="add">
                            <Key>/IMAGE/INDEX</Key>
                            <Value>${config.imageIndex || 1}</Value>
                        </MetaData>
                    </InstallFrom>
                    <InstallTo>
                        <DiskID>${installTo}</DiskID>
                        <PartitionID>${installPartition}</PartitionID>
                    </InstallTo>
                </OSImage>
            </ImageInstall>`;
    },

    /**
     * Generate user data
     */
    generateUserData(config) {
        if (!config.productKey && config.skipProductKey) {
            return '';
        }
        
        return `
            <UserData>
                <AcceptEula>${config.skipEula !== false ? 'true' : 'false'}</AcceptEula>
                ${config.organization ? `<Organization>${this.escapeXml(config.organization)}</Organization>` : ''}
                ${config.owner ? `<FullName>${this.escapeXml(config.owner)}</FullName>` : ''}
                ${config.productKey ? `
                <ProductKey>
                    <Key>${config.productKey}</Key>
                    <WillShowUI>OnError</WillShowUI>
                </ProductKey>` : ''}
            </UserData>`;
    },

    /**
     * Generate offline servicing pass
     */
    generateOfflineServicingPass(config) {
        return `
    <settings pass="offlineServicing">
        <component name="Microsoft-Windows-LUA-Settings" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS" xmlns:wcm="http://schemas.microsoft.com/WMIConfig/2002/State" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
            ${config.disableUAC ? '<EnableLUA>false</EnableLUA>' : ''}
        </component>
        ${this.generatePackages(config)}
    </settings>`;
    },

    /**
     * Generate generalize pass
     */
    generateGeneralizePass(config) {
        return `
    <settings pass="generalize">
        <component name="Microsoft-Windows-Security-SPP" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS" xmlns:wcm="http://schemas.microsoft.com/WMIConfig/2002/State" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
            <SkipRearm>1</SkipRearm>
        </component>
    </settings>`;
    },

    /**
     * Generate specialize pass
     */
    generateSpecializePass(config) {
        return `
    <settings pass="specialize">
        <component name="Microsoft-Windows-Shell-Setup" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS" xmlns:wcm="http://schemas.microsoft.com/WMIConfig/2002/State" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
            ${this.generateComputerName(config)}
            ${config.owner ? `<RegisteredOwner>${this.escapeXml(config.owner)}</RegisteredOwner>` : ''}
            ${config.organization ? `<RegisteredOrganization>${this.escapeXml(config.organization)}</RegisteredOrganization>` : ''}
            <TimeZone>${config.timezone || 'GMT Standard Time'}</TimeZone>
        </component>
        ${this.generateNetworkConfiguration(config)}
        ${this.generateWinsConfiguration(config)}
        ${this.generateDomainJoin(config)}
        ${this.generateFirewallSettings(config)}
        ${this.generateIESettings(config)}
        ${this.generateRunSynchronous(config, 'specialize')}
        ${this.generateWindowsFeatures(config)}
    </settings>`;
    },

    /**
     * Generate audit system pass
     */
    generateAuditSystemPass(config) {
        return `
    <settings pass="auditSystem">
        ${this.generateRunSynchronous(config, 'auditSystem')}
    </settings>`;
    },

    /**
     * Generate audit user pass
     */
    generateAuditUserPass(config) {
        return `
    <settings pass="auditUser">
        ${this.generateRunSynchronous(config, 'auditUser')}
    </settings>`;
    },

    /**
     * Generate oobeSystem pass
     */
    generateOobeSystemPass(config) {
        return `
    <settings pass="oobeSystem">
        <component name="Microsoft-Windows-Shell-Setup" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS" xmlns:wcm="http://schemas.microsoft.com/WMIConfig/2002/State" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
            ${this.generateOOBE(config)}
            ${this.generateUserAccounts(config)}
            ${this.generateAutoLogon(config)}
            ${this.generateFirstLogonCommands(config)}
            ${this.generateDisplay(config)}
        </component>
        ${this.generateInternationalCore(config)}
    </settings>`;
    },

    /**
     * Generate computer name
     */
    generateComputerName(config) {
        switch(config.computerNameStrategy) {
            case 'fixed':
                return `<ComputerName>${this.escapeXml(config.computerName || 'COMPUTER')}</ComputerName>`;
            case 'prompt':
                return `<ComputerName>*</ComputerName>`;
            case 'random':
            case 'serial':
            case 'mac':
            case 'hardware':
            case 'prefix-counter':
                // Will be set by script
                return `<ComputerName>TEMP-${Date.now()}</ComputerName>`;
            default:
                return `<ComputerName>${this.escapeXml(config.computerName || 'COMPUTER')}</ComputerName>`;
        }
    },

    /**
     * Generate network configuration
     */
    generateNetworkConfiguration(config) {
        if (config.networkConfig !== 'static') {
            return '';
        }
        
        return `
        <component name="Microsoft-Windows-TCPIP" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS" xmlns:wcm="http://schemas.microsoft.com/WMIConfig/2002/State" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
            <Interfaces>
                <Interface wcm:action="add">
                    <Identifier>Local Area Connection</Identifier>
                    <Ipv4Settings>
                        <DhcpEnabled>false</DhcpEnabled>
                    </Ipv4Settings>
                    <UnicastIpAddresses>
                        <IpAddress wcm:action="add" wcm:keyValue="1">${config.ipAddress}/${this.calculateCIDR(config.subnetMask)}</IpAddress>
                    </UnicastIpAddresses>
                    <Routes>
                        <Route wcm:action="add">
                            <Identifier>0</Identifier>
                            <Prefix>0.0.0.0/0</Prefix>
                            <NextHopAddress>${config.gateway}</NextHopAddress>
                        </Route>
                    </Routes>
                </Interface>
            </Interfaces>
        </component>
        <component name="Microsoft-Windows-DNS-Client" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS" xmlns:wcm="http://schemas.microsoft.com/WMIConfig/2002/State" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
            <Interfaces>
                <Interface wcm:action="add">
                    <DNSServerSearchOrder>
                        ${config.primaryDns ? `<IpAddress wcm:action="add" wcm:keyValue="1">${config.primaryDns}</IpAddress>` : ''}
                        ${config.secondaryDns ? `<IpAddress wcm:action="add" wcm:keyValue="2">${config.secondaryDns}</IpAddress>` : ''}
                    </DNSServerSearchOrder>
                    <Identifier>Local Area Connection</Identifier>
                </Interface>
            </Interfaces>
        </component>`;
    },

    /**
     * Generate WINS (NetBIOS-Nameserver) configuration.
     *
     * Nutzt die Microsoft-Windows-NetBT-Komponente (specialize-Pass). Die vom
     * MS-Schema vorgegebene Elementreihenfolge ist: NameServerList, NetbiosOptions,
     * Identifier. NetbiosOptions=1 aktiviert NetBIOS over TCP/IP (für WINS nötig).
     */
    generateWinsConfiguration(config) {
        if (!config.primaryWINS && !config.secondaryWINS) {
            return '';
        }

        let servers = '';
        if (config.primaryWINS) {
            servers += `
                    <IpAddress wcm:action="add" wcm:keyValue="1">${this.escapeXml(config.primaryWINS)}</IpAddress>`;
        }
        if (config.secondaryWINS) {
            servers += `
                    <IpAddress wcm:action="add" wcm:keyValue="2">${this.escapeXml(config.secondaryWINS)}</IpAddress>`;
        }

        return `
        <component name="Microsoft-Windows-NetBT" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS" xmlns:wcm="http://schemas.microsoft.com/WMIConfig/2002/State" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
            <Interfaces>
                <Interface wcm:action="add">
                    <NameServerList>${servers}
                    </NameServerList>
                    <NetbiosOptions>1</NetbiosOptions>
                    <Identifier>Local Area Connection</Identifier>
                </Interface>
            </Interfaces>
        </component>`;
    },

    /**
     * Generate domain join
     */
    generateDomainJoin(config) {
        if (config.joinType !== 'domain') {
            return '';
        }
        
        return `
        <component name="Microsoft-Windows-UnattendedJoin" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS" xmlns:wcm="http://schemas.microsoft.com/WMIConfig/2002/State" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
            <Identification>
                <Credentials>
                    <Domain>${this.escapeXml(config.domainName)}</Domain>
                    <Password>${this.escapeXml(config.domainPassword)}</Password>
                    <Username>${this.escapeXml(config.domainUser)}</Username>
                </Credentials>
                <JoinDomain>${this.escapeXml(config.domainName)}</JoinDomain>
                ${config.ouPath ? `<MachineObjectOU>${this.escapeXml(config.ouPath)}</MachineObjectOU>` : ''}
            </Identification>
        </component>`;
    },

    /**
     * Generate OOBE settings
     */
    generateOOBE(config) {
        return `
            <OOBE>
                <HideEULAPage>${config.skipEula !== false ? 'true' : 'false'}</HideEULAPage>
                <HideLocalAccountScreen>true</HideLocalAccountScreen>
                <HideOEMRegistrationScreen>${config.skipOEM !== false ? 'true' : 'false'}</HideOEMRegistrationScreen>
                <HideOnlineAccountScreens>${config.skipOnlineAccount !== false ? 'true' : 'false'}</HideOnlineAccountScreens>
                <HideWirelessSetupInOOBE>${config.skipWireless !== false ? 'true' : 'false'}</HideWirelessSetupInOOBE>
                <NetworkLocation>Work</NetworkLocation>
                <ProtectYourPC>${config.skipExpressSettings ? '3' : '1'}</ProtectYourPC>
                <SkipMachineOOBE>${config.skipOOBE ? 'true' : 'false'}</SkipMachineOOBE>
                <SkipUserOOBE>${config.skipOOBE ? 'true' : 'false'}</SkipUserOOBE>
            </OOBE>`;
    },

    /**
     * Generate user accounts
     */
    generateUserAccounts(config) {
        let accounts = '';
        
        // Administrator password
        if (config.adminPassword) {
            accounts += `
            <UserAccounts>
                <AdministratorPassword>
                    <Value>${this.encodePassword(config.adminPassword, 'AdministratorPassword')}</Value>
                    <PlainText>false</PlainText>
                </AdministratorPassword>`;
        }
        
        // Additional users
        if (config.users && config.users.length > 0) {
            if (!accounts) {
                accounts += `
            <UserAccounts>`;
            }
            
            accounts += `
                <LocalAccounts>`;
            
            config.users.forEach(user => {
                accounts += `
                    <LocalAccount wcm:action="add">
                        <Password>
                            <Value>${this.encodePassword(user.password, 'Password')}</Value>
                            <PlainText>false</PlainText>
                        </Password>
                        <Description>${this.escapeXml(user.description || '')}</Description>
                        <DisplayName>${this.escapeXml(user.fullname || user.username)}</DisplayName>
                        <Group>${user.group || 'Users'}</Group>
                        <Name>${this.escapeXml(user.username)}</Name>
                        ${user.passwordNeverExpires ? '<PasswordExpires>false</PasswordExpires>' : ''}
                    </LocalAccount>`;
            });
            
            accounts += `
                </LocalAccounts>`;
        }
        
        // Domain accounts
        if (config.domainAccounts && config.domainAccounts.length > 0) {
            if (!accounts) {
                accounts += `
            <UserAccounts>`;
            }
            
            accounts += `
                <DomainAccounts>
                    <DomainAccountList wcm:action="add">`;
            
            config.domainAccounts.forEach(account => {
                accounts += `
                        <DomainAccount wcm:action="add">
                            <Name>${this.escapeXml(account.name)}</Name>
                            <Group>${account.group || 'Users'}</Group>
                        </DomainAccount>`;
            });
            
            accounts += `
                    </DomainAccountList>
                </DomainAccounts>`;
        }
        
        if (accounts) {
            accounts += `
            </UserAccounts>`;
        }
        
        return accounts;
    },

    /**
     * Generate auto logon
     */
    generateAutoLogon(config) {
        if (!config.autoLogon) {
            return '';
        }
        
        let autoLogonUser = 'Administrator';
        let autoLogonPassword = config.adminPassword;
        
        // Check if specific user should auto-logon
        if (config.users && config.users.length > 0) {
            const autoUser = config.users.find(u => u.autologon);
            if (autoUser) {
                autoLogonUser = autoUser.username;
                autoLogonPassword = autoUser.password;
            }
        }
        
        return `
            <AutoLogon>
                <Password>
                    <Value>${this.encodePassword(autoLogonPassword, 'Password')}</Value>
                    <PlainText>false</PlainText>
                </Password>
                <Enabled>true</Enabled>
                <LogonCount>${config.autoLogonCount || 999999}</LogonCount>
                <Username>${this.escapeXml(autoLogonUser)}</Username>
            </AutoLogon>`;
    },

    /**
     * Generate first logon commands
     */
    generateFirstLogonCommands(config) {
        let commands = [];
        let order = 1;
        
        // Computer naming script for dynamic strategies
        if (['random', 'serial', 'mac', 'hardware', 'prefix-counter'].includes(config.computerNameStrategy)) {
            commands.push({
                order: order++,
                command: this.generateNamingScript(config),
                description: 'Set Computer Name'
            });
        }
        
        // Enable RDP
        if (config.enableRDP) {
            commands.push({
                order: order++,
                command: 'reg add "HKLM\\System\\CurrentControlSet\\Control\\Terminal Server" /v fDenyTSConnections /t REG_DWORD /d 0 /f',
                description: 'Enable Remote Desktop'
            });
            commands.push({
                order: order++,
                command: 'netsh advfirewall firewall set rule group="remote desktop" new enable=yes',
                description: 'Enable RDP Firewall Rule'
            });
        }
        
        // Disable UAC
        if (config.disableUAC) {
            commands.push({
                order: order++,
                command: 'reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v EnableLUA /t REG_DWORD /d 0 /f',
                description: 'Disable UAC'
            });
        }

        // Deactivate accounts that were marked "disabled initially". Das
        // LocalAccount-Schema kennt kein <Disabled>-Element, daher wird das
        // Konto per FirstLogonCommand stillgelegt (net user … /active:no).
        if (config.users && config.users.length > 0) {
            config.users.forEach(user => {
                if (user.disableAccount && user.username) {
                    commands.push({
                        order: order++,
                        command: `net user "${this.cmdArg(user.username)}" /active:no`,
                        description: `Disable account: ${user.username}`
                    });
                }
            });
        }

        // Privacy- & Convenience-Tweaks aus dem Pro-Mode (Lücke 1): bisher
        // ungenutzte Toggles werden hier als reg-/net-Befehle umgesetzt.
        const tweaks = [
            [config.enableAdminAccount, 'net user Administrator /active:yes', 'Enable built-in Administrator'],
            [config.disableCortana,     'reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\Windows Search" /v AllowCortana /t REG_DWORD /d 0 /f', 'Disable Cortana'],
            [config.disableOneDrive,    'reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\OneDrive" /v DisableFileSyncNGSC /t REG_DWORD /d 1 /f', 'Disable OneDrive'],
            [config.disableLocation,    'reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\LocationAndSensors" /v DisableLocation /t REG_DWORD /d 1 /f', 'Disable Location Services'],
            [config.disableAdvertising, 'reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\AdvertisingInfo" /v DisabledByGroupPolicy /t REG_DWORD /d 1 /f', 'Disable Advertising ID'],
            [config.gpUpdate,           'gpupdate /force', 'Apply Group Policy']
        ];
        tweaks.forEach(([enabled, command, description]) => {
            if (enabled) {
                commands.push({ order: order++, command, description });
            }
        });

        // Telemetrie-Stufe (0–3) explizit setzen, falls vorgegeben.
        if (config.telemetryLevel !== undefined && config.telemetryLevel !== '') {
            const level = Math.min(3, Math.max(0, parseInt(config.telemetryLevel, 10) || 0));
            commands.push({
                order: order++,
                command: `reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection" /v AllowTelemetry /t REG_DWORD /d ${level} /f`,
                description: 'Set Telemetry Level'
            });
        }

        // IPv6 nur deaktivieren, wenn explizit abgewählt (Default ist aktiviert).
        if (config.enableIPv6 === false) {
            commands.push({
                order: order++,
                command: 'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\Tcpip6\\Parameters" /v DisabledComponents /t REG_DWORD /d 255 /f',
                description: 'Disable IPv6'
            });
        }

        // Computerbeschreibung (srvcomment) – es gibt kein Unattend-Element dafür.
        if (config.computerDescription) {
            commands.push({
                order: order++,
                command: `reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\lanmanserver\\Parameters" /v srvcomment /t REG_SZ /d "${this.cmdArg(config.computerDescription)}" /f`,
                description: 'Set Computer Description'
            });
        }

        // Sperrbildschirm-/Anmeldebild (Personalization-Policy, Enterprise/Education).
        if (config.lockscreen) {
            commands.push({
                order: order++,
                command: `reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\Personalization" /v LockScreenImage /t REG_SZ /d "${this.cmdArg(config.lockscreen)}" /f`,
                description: 'Set Lock Screen Image'
            });
        }

        // Configure Windows Update
        if (config.updateMode && config.updateMode !== 'auto') {
            commands.push({
                order: order++,
                command: this.generateUpdateScript(config),
                description: 'Configure Windows Update'
            });
        }
        
        // Install software
        if (config.softwarePackages && config.softwarePackages.length > 0) {
            config.softwarePackages.forEach(pkg => {
                if (pkg.phase === 'firstlogon' || !pkg.phase) {
                    commands.push({
                        order: pkg.order || order++,
                        command: this.generateSoftwareInstallCommand(pkg),
                        description: `Install ${pkg.name}`
                    });
                }
            });
        }
        
        // Execute scripts
        if (config.scripts && config.scripts.length > 0) {
            config.scripts
                .filter(script => script.phase === 'firstLogon' || !script.phase)
                .forEach(script => {
                    commands.push({
                        order: script.order || order++,
                        command: this.generateScriptCommand(script),
                        description: script.name || 'Run Script'
                    });
                });
        }
        
        // Create scheduled tasks
        if (config.tasks && config.tasks.length > 0) {
            config.tasks.forEach(task => {
                commands.push({
                    order: order++,
                    command: this.generateScheduledTaskCommand(task),
                    description: `Create Task: ${task.name}`
                });
            });
        }
        
        if (commands.length === 0) {
            return '';
        }
        
        // Sort by order
        commands.sort((a, b) => a.order - b.order);
        
        let xml = `
            <FirstLogonCommands>`;
        
        commands.forEach((cmd, index) => {
            xml += `
                <SynchronousCommand wcm:action="add">
                    <Order>${index + 1}</Order>
                    <CommandLine>${this.escapeXml(cmd.command)}</CommandLine>
                    <Description>${this.escapeXml(cmd.description)}</Description>
                    <RequiresUserInput>false</RequiresUserInput>
                </SynchronousCommand>`;
        });
        
        xml += `
            </FirstLogonCommands>`;
        
        return xml;
    },

    /**
     * Generate RunSynchronous commands for different passes
     */
    generateRunSynchronous(config, pass) {
        let commands = [];
        
        // Add phase-specific scripts
        if (config.scripts && config.scripts.length > 0) {
            config.scripts
                .filter(script => script.phase === pass)
                .forEach(script => {
                    commands.push({
                        order: script.order || commands.length + 1,
                        path: this.generateScriptCommand(script),
                        description: script.name || `Run ${script.type} script`
                    });
                });
        }
        
        // Add phase-specific software
        if (config.softwarePackages && config.softwarePackages.length > 0) {
            config.softwarePackages
                .filter(pkg => pkg.phase === pass)
                .forEach(pkg => {
                    commands.push({
                        order: pkg.order || commands.length + 1,
                        path: this.generateSoftwareInstallCommand(pkg),
                        description: `Install ${pkg.name}`
                    });
                });
        }
        
        if (commands.length === 0) {
            return '';
        }
        
        commands.sort((a, b) => a.order - b.order);
        
        let xml = `
            <RunSynchronous>`;
        
        commands.forEach(cmd => {
            xml += `
                <RunSynchronousCommand wcm:action="add">
                    <Order>${cmd.order}</Order>
                    <Path>${this.escapeXml(cmd.path)}</Path>
                    <Description>${this.escapeXml(cmd.description)}</Description>
                </RunSynchronousCommand>`;
        });
        
        xml += `
            </RunSynchronous>`;
        
        return xml;
    },

    /**
     * Generate Windows Features
     */
    generateWindowsFeatures(config) {
        if (!config.features || config.features.length === 0) {
            return '';
        }
        
        const featureMap = {
            'netfx3': 'NetFx3',
            'netfx48': 'NetFx4-AdvSrvs',
            'hyperv': 'Microsoft-Hyper-V-All',
            'wsl': 'Microsoft-Windows-Subsystem-Linux',
            'sandbox': 'Windows-Sandbox',
            'containers': 'Containers',
            'telnet': 'TelnetClient',
            'tftp': 'TFTP',
            'smb1': 'SMB1Protocol',
            'directplay': 'DirectPlay',
            'iis': 'IIS-WebServerRole',
            'dns': 'DNS-Server-Core-Role',
            'dhcp': 'DHCP',
            'fileserver': 'FileAndStorage-Services',
            'printserver': 'Print-Services',
            'rds': 'Remote-Desktop-Services',
            'wds': 'WDS'
        };
        
        let xml = `
        <component name="Microsoft-Windows-ServerManager-SvrMgrNc" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS" xmlns:wcm="http://schemas.microsoft.com/WMIConfig/2002/State" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
            <DoNotOpenServerManagerAtLogon>true</DoNotOpenServerManagerAtLogon>
        </component>
        <component name="Microsoft-Windows-Foundation-Package" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS" xmlns:wcm="http://schemas.microsoft.com/WMIConfig/2002/State" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">`;
        
        config.features.forEach(feature => {
            let featureName = feature.name || feature;
            if (typeof feature === 'object' && feature.checked) {
                featureName = feature.name;
            }
            
            // Map short names to Windows feature names
            const mappedName = featureMap[featureName] || featureName;
            
            xml += `
            <Selection>${mappedName}</Selection>`;
        });
        
        xml += `
        </component>`;
        
        return xml;
    },

    /**
     * Generate driver paths
     */
    generateDriverPaths(config, pass) {
        if (!config.drivers || config.drivers.length === 0) {
            return '';
        }
        
        const relevantDrivers = config.drivers.filter(driver => {
            if (pass === 'windowsPE') {
                return driver.critical || driver.phase === 'windowsPE';
            }
            return driver.phase === pass;
        });
        
        if (relevantDrivers.length === 0) {
            return '';
        }
        
        let xml = `
            <DriverPaths>`;
        
        relevantDrivers.forEach((driver, index) => {
            xml += `
                <PathAndCredentials wcm:action="add" wcm:keyValue="${index + 1}">
                    <Path>${this.escapeXml(driver.infPath)}</Path>
                </PathAndCredentials>`;
        });
        
        xml += `
            </DriverPaths>`;
        
        return xml;
    },

    /**
     * Generate naming script
     */
    generateNamingScript(config) {
        // prefix wird in PowerShell-Single-Quotes ('...') eingebettet -> absichern.
        const prefix = this.psArg(config.computerNamePrefix || '');
        
        const scripts = {
            'random': `powershell.exe -Command "$name='${prefix}'+(Get-Random -Maximum 999999).ToString('000000'); Rename-Computer -NewName $name -Force"`,
            'serial': `powershell.exe -Command "$serial=(Get-WmiObject Win32_BIOS).SerialNumber -replace '[^a-zA-Z0-9]',''; if($serial.Length -gt 12){$serial=$serial.Substring(0,12)}; $name='${prefix}'+$serial; Rename-Computer -NewName $name -Force"`,
            'mac': `powershell.exe -Command "$mac=(Get-WmiObject Win32_NetworkAdapter | Where {$_.MacAddress} | Select -First 1).MacAddress -replace ':',''; $name='${prefix}'+$mac.Substring([Math]::Max(0,$mac.Length-6)); Rename-Computer -NewName $name -Force"`,
            'hardware': `powershell.exe -Command "$v=(Get-WmiObject Win32_ComputerSystem).Manufacturer.Substring(0,3); $m=(Get-WmiObject Win32_ComputerSystem).Model -replace '[^a-zA-Z0-9]',''; $s=(Get-WmiObject Win32_BIOS).SerialNumber -replace '[^a-zA-Z0-9]',''; $name=($v+$m+$s).Substring(0,[Math]::Min(15,($v+$m+$s).Length)); Rename-Computer -NewName $name -Force"`,
            // Präfix + Zähler: bevorzugt die numerischen Stellen der BIOS-Seriennummer
            // (zustandslos, pro Gerät eindeutig), fällt sonst auf alphanumerische
            // Stellen zurück; auf die letzten 6 Stellen und NetBIOS-Limit (15) gekürzt.
            'prefix-counter': `powershell.exe -Command "$sn=(Get-WmiObject Win32_BIOS).SerialNumber -replace '[^0-9]',''; if(-not $sn){$sn=(Get-WmiObject Win32_BIOS).SerialNumber -replace '[^a-zA-Z0-9]',''}; if($sn.Length -gt 6){$sn=$sn.Substring($sn.Length-6)}; $name='${prefix}'+$sn; if($name.Length -gt 15){$name=$name.Substring(0,15)}; Rename-Computer -NewName $name -Force"`
        };
        
        return scripts[config.computerNameStrategy] || '';
    },

    /**
     * Shell-Quoting-Helfer (Lücke 4): neutralisieren DATEN-Werte, die in erzeugte
     * Shell-Befehle eingebettet werden, gegen Command-Injection. Reine Befehls-/
     * Argument-Felder (script.command, script.content via Base64, pkg.arguments)
     * bleiben bewusst unverändert – sie sind per Design beliebiger Code.
     */
    /** Wert für cmd-Doppelquotes "..." absichern. Innerhalb intakter Quotes sind
     *  & | < > literal; gefährlich ist nur das schließende " (Quote-Breakout) und
     *  Zeilenumbrüche – beide werden entfernt. */
    cmdArg(value) {
        return String(value == null ? '' : value).replace(/["\r\n]/g, '');
    },
    /** Wert für PowerShell-Single-Quotes '...' absichern: ' wird zu '' verdoppelt,
     *  Zeilenumbrüche werden zu Leerzeichen. */
    psArg(value) {
        return String(value == null ? '' : value).replace(/[\r\n]+/g, ' ').replace(/'/g, "''");
    },

    /**
     * Generate update configuration script
     */
    generateUpdateScript(config) {
        const wsus = this.cmdArg(config.wsusServer);
        const scripts = {
            'disabled': 'reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU" /v NoAutoUpdate /t REG_DWORD /d 1 /f',
            'notify': 'reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU" /v AUOptions /t REG_DWORD /d 2 /f',
            'download': 'reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU" /v AUOptions /t REG_DWORD /d 3 /f',
            'wsus': `reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate" /v WUServer /t REG_SZ /d "${wsus}" /f & reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate" /v WUStatusServer /t REG_SZ /d "${wsus}" /f`
        };

        return scripts[config.updateMode] || '';
    },

    /**
     * Generate software install command
     */
    generateSoftwareInstallCommand(pkg) {
        let command = '';
        const path = this.cmdArg(pkg.path);    // Pfad in cmd-Doppelquotes (Daten)
        const psPath = this.psArg(pkg.path);   // Pfad in PowerShell-Single-Quotes
        const args = pkg.arguments;            // Argument-Feld: bewusst roh (Code)

        switch(pkg.type) {
            case 'msi':
                command = `msiexec /i "${path}" ${args || '/quiet /norestart'}`;
                break;
            case 'exe':
                command = `"${path}" ${args || '/S'}`;
                break;
            case 'script':
            case 'ps1':
                command = `powershell.exe -ExecutionPolicy Bypass -File "${path}" ${args || ''}`;
                break;
            case 'bat':
            case 'cmd':
                command = `cmd.exe /c "${path}" ${args || ''}`;
                break;
            case 'appx':
            case 'msix':
                command = `powershell.exe -Command "Add-AppxPackage -Path '${psPath}'"`;
                break;
            case 'zip':
                command = `powershell.exe -Command "Expand-Archive -Path '${psPath}' -DestinationPath 'C:\\Temp\\${this.psArg(pkg.name)}' -Force"`;
                break;
            default:
                command = `"${path}" ${args || ''}`;
        }
        
        if (pkg.continueOnError) {
            command = `cmd.exe /c "${command} || exit 0"`;
        }
        
        return command;
    },

    /**
     * Generate script command
     */
    generateScriptCommand(script) {
        let command = '';
        
        if (script.content) {
            // Inline script - create temporary file
            const tempFile = `C:\\Windows\\Temp\\script_${Date.now()}.${script.type}`;
            const createFile = `echo ${btoa(script.content)} | powershell -Command "[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String((Get-Content -Raw))) | Out-File -FilePath '${tempFile}' -Encoding UTF8"`;
            const runScript = this.getScriptExecutor(script.type, tempFile);
            command = `cmd.exe /c "${createFile} && ${runScript}"`;
        } else if (script.command) {
            if (script.type === 'powershell') {
                command = `powershell.exe -ExecutionPolicy ${script.executionPolicy || 'Bypass'} ${script.hidden ? '-WindowStyle Hidden' : ''} -Command "${script.command}"`;
            } else if (script.type === 'cmd') {
                command = `cmd.exe /c "${script.command}"`;
            } else {
                command = script.command;
            }
        }
        
        if (script.async) {
            command = `start /b ${command}`;
        }
        
        if (script.timeout && parseInt(script.timeout, 10) > 0) {
            command = `timeout /t ${parseInt(script.timeout, 10)} & ${command}`;
        }
        
        return command;
    },

    /**
     * Get script executor based on type
     */
    getScriptExecutor(type, path) {
        const executors = {
            'powershell': `powershell.exe -ExecutionPolicy Bypass -File "${path}"`,
            'cmd': `cmd.exe /c "${path}"`,
            'bat': `cmd.exe /c "${path}"`,
            'vbs': `cscript.exe "${path}"`,
            'js': `cscript.exe "${path}"`,
            'reg': `reg import "${path}"`,
            'exe': `"${path}"`
        };
        
        return executors[type] || `"${path}"`;
    },

    /**
     * Generate scheduled task command
     */
    generateScheduledTaskCommand(task) {
        // startTime steht nicht in Quotes -> nur Ziffern und ':' zulassen.
        const startTime = (String(task.startTime || '').replace(/[^0-9:]/g, '')) || '00:00';
        let triggers = {
            'startup': '/sc onstart',
            'logon': '/sc onlogon',
            'daily': '/sc daily /st ' + startTime,
            'weekly': '/sc weekly /d MON /st ' + startTime,
            'monthly': '/sc monthly /d 1 /st ' + startTime,
            'once': '/sc once /st ' + startTime,
            'idle': '/sc onidle /i 10'
        };

        let command = `schtasks /create /tn "${this.cmdArg(task.name)}" ${triggers[task.trigger] || triggers.daily} /tr "${this.cmdArg(task.action)}" /ru "${this.cmdArg(task.runAs || 'SYSTEM')}"`;
        
        if (task.runWithHighest) {
            command += ' /rl highest';
        }
        
        if (!task.enabled) {
            command += ' /disable';
        }
        
        command += ' /f';
        
        return command;
    },

    /**
     * Generate firewall settings
     */
    generateFirewallSettings(config) {
        if (!config.enableFirewall && config.enableFirewall !== false) {
            return '';
        }
        
        let xml = `
        <component name="Networking-MPSSVC-Svc" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS" xmlns:wcm="http://schemas.microsoft.com/WMIConfig/2002/State" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
            <FirewallGroups>
                <FirewallGroup wcm:action="add" wcm:keyValue="1">
                    <Active>${config.enableFirewall ? 'true' : 'false'}</Active>
                    <Profile>all</Profile>
                </FirewallGroup>
            </FirewallGroups>`;
        
        if (config.enablePing || config.enableFileSharing || config.enableWMI) {
            xml += `
            <FirewallRules>`;
            
            if (config.enablePing) {
                xml += `
                <FirewallRule wcm:action="add" wcm:keyValue="1">
                    <Name>Allow ICMP Echo</Name>
                    <Direction>in</Direction>
                    <Protocol>ICMPv4</Protocol>
                    <Action>allow</Action>
                </FirewallRule>`;
            }
            
            if (config.enableFileSharing) {
                xml += `
                <FirewallRule wcm:action="add" wcm:keyValue="2">
                    <Name>File and Printer Sharing</Name>
                    <Direction>in</Direction>
                    <Protocol>6</Protocol>
                    <LocalPort>445</LocalPort>
                    <Action>allow</Action>
                </FirewallRule>`;
            }
            
            xml += `
            </FirewallRules>`;
        }
        
        xml += `
        </component>`;
        
        return xml;
    },

    /**
     * Generate IE settings
     */
    generateIESettings(config) {
        if (!config.disableIEEnhancedSecurity) {
            return '';
        }
        
        return `
        <component name="Microsoft-Windows-IE-ESC" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS" xmlns:wcm="http://schemas.microsoft.com/WMIConfig/2002/State" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
            <IEHardenAdmin>false</IEHardenAdmin>
            <IEHardenUser>false</IEHardenUser>
        </component>`;
    },

    /**
     * Generate display settings
     */
    generateDisplay(config) {
        if (!config.displayMode || config.displayMode === 'default') {
            return '';
        }
        
        let xml = '';
        
        if (config.wallpaper) {
            xml += `
            <DesktopBackground>${this.escapeXml(config.wallpaper)}</DesktopBackground>`;
        }
        
        if (config.displayMode === 'retail') {
            xml += `
            <ShowWindowsLive>false</ShowWindowsLive>`;
        }
        
        return xml;
    },

    /**
     * Generate international core settings for oobeSystem
     */
    generateInternationalCore(config) {
        return `
        <component name="Microsoft-Windows-International-Core" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS" xmlns:wcm="http://schemas.microsoft.com/WMIConfig/2002/State" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
            <InputLocale>${config.inputLocale || '0409:00000409'}</InputLocale>
            <SystemLocale>${config.systemLocale || 'en-US'}</SystemLocale>
            <UILanguage>${config.uilanguage || 'en-US'}</UILanguage>
            <UILanguageFallback>${config.uilanguage || 'en-US'}</UILanguageFallback>
            <UserLocale>${config.userLocale || config.uilanguage || 'en-US'}</UserLocale>
        </component>`;
    },

    /**
     * Generate packages for offline servicing
     */
    generatePackages(config) {
        if (!config.packages || config.packages.length === 0) {
            return '';
        }
        
        let xml = `
        <component name="Microsoft-Windows-PnpCustomizationsNonWinPE" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS" xmlns:wcm="http://schemas.microsoft.com/WMIConfig/2002/State" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
            <DriverPaths>`;
        
        config.packages.forEach((pkg, index) => {
            xml += `
                <PathAndCredentials wcm:action="add" wcm:keyValue="${index + 1}">
                    <Path>${this.escapeXml(pkg.path)}</Path>
                </PathAndCredentials>`;
        });
        
        xml += `
            </DriverPaths>
        </component>`;
        
        return xml;
    },

    /**
     * Calculate CIDR from subnet mask
     */
    calculateCIDR(subnetMask) {
        // Robust gegen fehlende/ungültige Maske (z. B. nach einem Import, der nur
        // die IP zurückliest): sinnvoller /24-Default statt Absturz.
        if (typeof subnetMask !== 'string' || !subnetMask) {
            return 24;
        }
        const parts = subnetMask.split('.');
        let cidr = 0;

        parts.forEach(part => {
            const binary = parseInt(part).toString(2);
            cidr += binary.split('1').length - 1;
        });

        return cidr;
    },

    /**
     * Convert a CIDR prefix length to a dotted subnet mask ('255.255.255.0').
     * Gegenstück zu calculateCIDR – beim Import wird die Maske aus dem im XML
     * gespeicherten ip/cidr rekonstruiert.
     */
    cidrToSubnetMask(cidr) {
        const n = Math.max(0, Math.min(32, parseInt(cidr, 10) || 0));
        const octets = [];
        for (let i = 0; i < 4; i++) {
            const bits = Math.max(0, Math.min(8, n - i * 8));
            octets.push(256 - Math.pow(2, 8 - bits));
        }
        return octets.join('.');
    },

    /**
     * Check if has settings for a pass
     */
    hasOfflineServicingSettings(config) {
        return config.disableUAC || (config.packages && config.packages.length > 0);
    },
    
    hasGeneralizeSettings(config) {
        return config.skipRearm;
    },
    
    hasAuditSystemSettings(config) {
        return config.scripts && config.scripts.some(s => s.phase === 'auditSystem');
    },
    
    hasAuditUserSettings(config) {
        return config.scripts && config.scripts.some(s => s.phase === 'auditUser');
    },

    /**
     * Encode password for XML.
     *
     * Windows obfuscates answer-file passwords by appending the NAME OF THE
     * ENCLOSING XML ELEMENT to the plaintext, encoding the result as UTF-16LE
     * and then Base64. When reading the file Windows strips exactly that suffix
     * again. The suffix therefore depends on where the <Value> lives:
     *   <AdministratorPassword>            -> "AdministratorPassword"
     *   <AutoLogon><Password>              -> "Password"
     *   <LocalAccount><Password>           -> "Password"
     * Using the wrong suffix yields a password that decodes to a different
     * value, so the account cannot be used to log in.
     *
     * @param {string} password    Plaintext password.
     * @param {string} elementName Name of the enclosing element ("Password" or
     *                             "AdministratorPassword").
     */
    encodePassword(password, elementName = 'Password') {
        if (!password) return '';

        try {
            // Base64-encoded UTF-16LE of: password + <enclosing element name>
            const fullPassword = password + elementName;
            
            // Create a buffer for UTF-16LE encoding
            const buffer = new ArrayBuffer(fullPassword.length * 2);
            const utf16le = new Uint16Array(buffer);
            
            // charCodeAt liefert bereits einzelne UTF-16-Code-Units (Surrogate-
            // Hälften für Zeichen außerhalb der BMP, z. B. Emoji, sind getrennt),
            // daher genügt direktes Kopieren Unit für Unit. Der Puffer hat exakt
            // fullPassword.length * 2 Bytes, passt also 1:1.
            for (let i = 0; i < fullPassword.length; i++) {
                utf16le[i] = fullPassword.charCodeAt(i);
            }
            
            // Convert to byte array for Base64 encoding
            const bytes = new Uint8Array(buffer);
            const binaryString = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
            
            // Base64 encode
            return btoa(binaryString);
        } catch (error) {
            console.error('Error encoding password:', error);
            // Fallback to simple encoding - still better than plain text
            try {
                return btoa(unescape(encodeURIComponent(password + elementName)));
            } catch (fallbackError) {
                console.error('Fallback encoding also failed:', fallbackError);
                // Last resort - just base64 the password
                return btoa(password);
            }
        }
    },

    /**
     * Escape special characters for embedding in XML.
     *
     * Delegiert an die einzige Escaping-Implementierung UIHelpers.escapeHtml
     * (Lücke 6: keine doppelte Logik mehr). Das Apostroph wird als numerische
     * Referenz &#39; kodiert – in XML wie in HTML gleichermaßen gültig.
     */
    escapeXml(text) {
        return UIHelpers.escapeHtml(text);
    },

    /**
     * Validate configuration
     */
    validateConfig() {
        const config = ConfigManager.getConfig();
        const dynamicData = DynamicElements.collectDynamicData();
        Object.assign(config, dynamicData);
        
        const validation = ValidationUtils.validateConfiguration(config);
        const lang = window.LanguageManager || { t: (key) => key };
        
        if (validation.valid) {
            UIHelpers.showNotification(lang.t('notifications.configValid'), 'success');
            
            // Generate preview
            const xml = this.buildAutounattendXML(config);
            const previewElement = document.getElementById('pro-xmlPreview');
            if (previewElement) {
                previewElement.innerHTML = UIHelpers.highlightXML(xml);
            }
            
            return true;
        } else {
            const summary = ValidationUtils.createValidationSummary(validation);
            UIHelpers.alert(summary);
            return false;
        }
    },

    /**
     * Export XML file
     */
    exportXML() {
        const xml = this.generateXML();
        if (xml) {
            UIHelpers.downloadFile(xml, 'autounattend.xml', 'text/xml');
        }
    },

    /**
     * Copy XML to clipboard
     */
    copyXML() {
        const xml = this.generateXML();
        if (xml) {
            UIHelpers.copyToClipboard(xml);
        }
    },

    /**
     * Import XML file
     */
    importXML(xmlContent) {
        const lang = window.LanguageManager || { t: (key) => key };
        
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
            
            // Check for parse errors
            const parseError = xmlDoc.querySelector('parsererror');
            if (parseError) {
                throw new Error('XML parsing error');
            }
            
            // Extract configuration from XML
            const config = this.extractConfigFromXML(xmlDoc);
            
            // Update configuration
            ConfigManager.updateConfig(config);
            
            UIHelpers.showNotification(lang.t('notifications.xmlImported'), 'success');
            return true;
        } catch (error) {
            console.error('XML import error:', error);
            UIHelpers.showNotification(lang.t('notifications.xmlImportFailed'), 'error');
            return false;
        }
    },

    /**
     * Decode a Windows answer-file password (inverse of encodePassword):
     * Base64 -> UTF-16LE -> den angehängten Eltern-Elementnamen entfernen.
     */
    decodePassword(encoded, elementName = 'Password') {
        if (!encoded) return '';
        try {
            const binary = atob(encoded);
            let str = '';
            for (let i = 0; i + 1 < binary.length; i += 2) {
                str += String.fromCharCode(binary.charCodeAt(i) + (binary.charCodeAt(i + 1) << 8));
            }
            return str.endsWith(elementName) ? str.slice(0, -elementName.length) : str;
        } catch (e) {
            return '';
        }
    },

    /**
     * Extract partitions from a parsed DiskConfiguration (inverse of
     * generateDiskConfiguration). CreatePartition liefert Typ/Größe,
     * ModifyPartition (gleiche Order) liefert Label/Letter/Format/Active.
     */
    extractPartitions(xmlDoc) {
        const partitions = [];
        const modifyByOrder = {};
        xmlDoc.querySelectorAll('ModifyPartition').forEach(mp => {
            const order = mp.querySelector('Order')?.textContent;
            if (order) modifyByOrder[order] = mp;
        });
        xmlDoc.querySelectorAll('CreatePartition').forEach(cp => {
            const order = cp.querySelector('Order')?.textContent;
            const partition = {
                type: (cp.querySelector('Type')?.textContent || 'primary').toLowerCase(),
                size: cp.querySelector('Size')?.textContent || ''
            };
            const mp = order ? modifyByOrder[order] : null;
            if (mp) {
                const label = mp.querySelector('Label')?.textContent;
                const letter = mp.querySelector('Letter')?.textContent;
                const format = mp.querySelector('Format')?.textContent;
                if (label != null) partition.label = label;
                if (letter != null) partition.letter = letter;
                if (format) partition.filesystem = format.toLowerCase();
                if (mp.querySelector('Active')?.textContent === 'true') partition.active = true;
            }
            partitions.push(partition);
        });
        return partitions;
    },

    /**
     * Extract local user accounts (inverse of generateUserAccounts).
     * Passwörter werden über decodePassword zurückgewonnen.
     */
    extractUsers(xmlDoc) {
        const users = [];
        xmlDoc.querySelectorAll('LocalAccount').forEach(acc => {
            const username = acc.querySelector('Name')?.textContent;
            if (!username) return;
            const user = { username };
            const fullname = acc.querySelector('DisplayName')?.textContent;
            const description = acc.querySelector('Description')?.textContent;
            const group = acc.querySelector('Group')?.textContent;
            const pwValue = acc.querySelector('Password > Value')?.textContent;
            if (fullname) user.fullname = fullname;
            if (description) user.description = description;
            if (group) user.group = group;
            if (pwValue) user.password = this.decodePassword(pwValue, 'Password');
            if (acc.querySelector('PasswordExpires')?.textContent === 'false') user.passwordNeverExpires = true;
            users.push(user);
        });
        return users;
    },

    /**
     * Liest den eingebetteten Metadaten-Kommentar (Base64-JSON) aus dem geparsten
     * Dokument. Liefert das Konfigurationsobjekt oder null, wenn nicht vorhanden.
     */
    extractMetadata(xmlDoc) {
        const root = xmlDoc.documentElement;
        if (!root) return null;
        for (const node of Array.from(root.childNodes)) {
            if (node.nodeType === 8) {   // COMMENT_NODE
                const m = node.textContent.match(/autounattend-generator-config:([A-Za-z0-9+/=]+)/);
                if (m) {
                    try {
                        return JSON.parse(decodeURIComponent(escape(atob(m[1]))));
                    } catch (e) {
                        return null;
                    }
                }
            }
        }
        return null;
    },

    /**
     * Extract configuration from XML document
     */
    extractConfigFromXML(xmlDoc) {
        const config = {};
        
        // Extract basic settings
        const computerName = xmlDoc.querySelector('ComputerName');
        if (computerName) {
            config.computerName = computerName.textContent;
            config.computerNameStrategy = computerName.textContent === '*' ? 'prompt' : 'fixed';
        }
        
        const organization = xmlDoc.querySelector('Organization, RegisteredOrganization');
        if (organization) {
            config.organization = organization.textContent;
        }
        
        const timezone = xmlDoc.querySelector('TimeZone');
        if (timezone) {
            config.timezone = timezone.textContent;
        }
        
        const uiLanguage = xmlDoc.querySelector('UILanguage');
        if (uiLanguage) {
            config.uilanguage = uiLanguage.textContent;
        }
        
        const productKey = xmlDoc.querySelector('ProductKey Key');
        if (productKey) {
            config.productKey = productKey.textContent;
        }
        
        // Extract network settings
        const dhcpEnabled = xmlDoc.querySelector('DhcpEnabled');
        if (dhcpEnabled && dhcpEnabled.textContent === 'false') {
            config.networkConfig = 'static';
            
            const ipAddress = xmlDoc.querySelector('IpAddress');
            if (ipAddress) {
                const [ip, cidr] = ipAddress.textContent.split('/');
                config.ipAddress = ip;
                // Subnetzmaske aus der CIDR-Präfixlänge rekonstruieren (im XML als
                // ip/cidr gespeichert) – sonst fehlt sie beim erneuten Generieren.
                if (cidr) config.subnetMask = this.cidrToSubnetMask(cidr);
            }
            
            const gateway = xmlDoc.querySelector('NextHopAddress');
            if (gateway) {
                config.gateway = gateway.textContent;
            }
        }
        
        // Extract domain settings
        const joinDomain = xmlDoc.querySelector('JoinDomain');
        if (joinDomain) {
            config.joinType = 'domain';
            config.domainName = joinDomain.textContent;
        }

        // Owner / RegisteredOwner
        const owner = xmlDoc.querySelector('FullName, RegisteredOwner');
        if (owner) config.owner = owner.textContent;

        // Regionale Einstellungen
        const systemLocale = xmlDoc.querySelector('SystemLocale');
        if (systemLocale) config.systemLocale = systemLocale.textContent;
        const inputLocale = xmlDoc.querySelector('InputLocale');
        if (inputLocale) config.inputLocale = inputLocale.textContent;
        const userLocale = xmlDoc.querySelector('UserLocale');
        if (userLocale) config.userLocale = userLocale.textContent;

        // EULA (AcceptEula/HideEULAPage = true -> skipEula)
        const acceptEula = xmlDoc.querySelector('AcceptEula');
        if (acceptEula) config.skipEula = acceptEula.textContent === 'true';

        // Administrator-Passwort (dekodiert)
        const adminPw = xmlDoc.querySelector('AdministratorPassword > Value');
        if (adminPw) config.adminPassword = this.decodePassword(adminPw.textContent, 'AdministratorPassword');

        // Partitionen + lokale Benutzerkonten (strukturierte dynamische Items)
        const partitions = this.extractPartitions(xmlDoc);
        if (partitions.length > 0) {
            config.partitions = partitions;
            config.diskMode = 'manual';
        }
        const users = this.extractUsers(xmlDoc);
        if (users.length > 0) config.users = users;

        // Eingebettete Metadaten (eigene XMLs) haben Vorrang und ergänzen alle
        // Felder, die im XML nicht (zuverlässig) abgebildet sind – inkl.
        // Software/Skripte/Tasks/Treiber. Die aus den encoded <Value> dekodierten
        // Passwörter werden dabei beibehalten (die Metadaten enthalten keine).
        const meta = this.extractMetadata(xmlDoc);
        if (meta && typeof meta === 'object') {
            if (config.adminPassword) meta.adminPassword = config.adminPassword;
            if (Array.isArray(meta.users) && Array.isArray(config.users)) {
                meta.users.forEach((u, i) => {
                    if (u && config.users[i] && config.users[i].password) u.password = config.users[i].password;
                });
            }
            return meta;
        }

        return config;
    }
};