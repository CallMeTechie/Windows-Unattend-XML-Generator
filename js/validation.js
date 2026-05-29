/**
 * Validation Utilities
 * Handles all validation logic for the Windows Autounattend.xml Generator
 * Multi-language version - COMPLETE IMPLEMENTATION
 */

import { LanguageManager } from './language-manager.js';

export const ValidationUtils = {
    /**
     * Validate complete configuration
     */
    validateConfiguration(config) {
        const errors = [];
        const warnings = [];

        // Validate basic settings
        this.validateBasicSettings(config, errors, warnings);
        
        // Validate computer name
        this.validateComputerName(config, errors, warnings);
        
        // Validate product key
        this.validateProductKey(config, errors, warnings);
        
        // Validate network settings
        this.validateNetworkSettings(config, errors, warnings);
        
        // Validate users
        this.validateUsers(config, errors, warnings);
        
        // Validate partitions
        this.validatePartitions(config, errors, warnings);
        
        // Validate domain settings
        this.validateDomainSettings(config, errors, warnings);
        
        // Validate software packages
        this.validateSoftwarePackages(config, errors, warnings);
        
        // Validate scripts
        this.validateScripts(config, errors, warnings);
        
        // Validate drivers
        this.validateDrivers(config, errors, warnings);

        // Strengere Defaults- und OOBE-Plausibilitätsprüfung
        this.validateOOBEAndDefaults(config, errors, warnings);

        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings
        };
    },

    /**
     * Strenge Defaults- und OOBE-Plausibilität.
     * Erkennt unangetastete Standardwerte, fehlende OOBE-Bestätigungen und
     * Konfigurationen, die zu pausierten oder unsicheren Installationen führen.
     */
    validateOOBEAndDefaults(config, errors, warnings) {
        const lang = LanguageManager;
        // 1) Standardmäßige Computername-Defaults erkennen (Nutzer hat nichts
        //    geändert) – häufige Vorlagen in Wizard und Pro-Modus.
        const defaultNames = ['PC-001', 'DESKTOP-XXX', 'COMPUTER', 'WIN-PC', 'CHANGE-ME'];
        if (config.computerNameStrategy === 'fixed'
            && config.computerName
            && defaultNames.includes(String(config.computerName).toUpperCase())) {
            warnings.push(lang.t('validation.defaultComputerName', { name: config.computerName }));
        }

        // 2) EULA-Akzeptanz – ohne wird die Installation pausiert.
        if (config.skipEula === false || config.skipEula === undefined) {
            warnings.push(lang.t('validation.eulaNotAccepted',
                'EULA is not auto-accepted – the installation will pause at the license screen.'));
        }

        // 3) Zeitzone explizit gesetzt? Anders als das alte „not set" prüfen
        //    wir hier auch, ob der Wert ein verwendbarer Windows-Zeitzonen-Name
        //    ist (enthält 'Standard Time' oder ist UTC).
        if (config.timezone) {
            const tz = String(config.timezone).trim();
            if (tz && tz !== 'UTC' && !/Standard Time$|Daylight Time$/i.test(tz)) {
                warnings.push(lang.t('validation.timezoneFormat', { tz }));
            }
        }

        // 4) Produktschlüssel und Skip-Strategie konsistent? Wenn weder Key noch
        //    skipProductKey gesetzt, pausiert die Installation am Key-Bildschirm.
        if (!config.productKey && !config.skipProductKey) {
            warnings.push(lang.t('validation.productKeyMissing',
                'No product key set – the installer will prompt for one.'));
        }

        // 5) Online-/Lokales-Konto-Skip Konsistenz: wenn beide übersprungen
        //    werden und kein lokaler Benutzer existiert, gibt es nach dem
        //    Setup keinen Login.
        const hasAdmin = config.enableAdminAccount && config.adminPassword;
        const hasLocalUser = Array.isArray(config.users) && config.users.some(u => u && u.username && u.password);
        if (config.skipOnlineAccount && config.skipLocalAccount && !hasAdmin && !hasLocalUser) {
            errors.push(lang.t('validation.allAccountSetupSkipped',
                'Both online and local account setup are skipped, but no administrator or local user is configured – there would be no way to log in after installation.'));
        }

        // 6) Auto-Logon ohne Benutzer/Passwort.
        if (config.autoLogon && !hasAdmin && !hasLocalUser) {
            warnings.push(lang.t('validation.autoLogonNoAccount',
                'Auto-logon is enabled, but no account is configured.'));
        }

        // 7) Telemetrie-Stufe „Full" warnen.
        if (config.telemetryLevel === '3' || config.telemetryLevel === 'full') {
            warnings.push(lang.t('validation.telemetryFull',
                'Telemetry level "Full" sends the most data to Microsoft – review privacy implications.'));
        }
    },

    /**
     * Validate basic settings
     */
    validateBasicSettings(config, errors, warnings) {
        const lang = LanguageManager;
        
        if (!config.windowsVersion) {
            errors.push(lang.t('validations.required', { field: lang.t('fields.windowsVersion') }));
        }
        
        if (!config.timezone) {
            warnings.push(lang.t('validation.timezoneNotSetDE',
                'Time zone not set – Windows default will be used.'));
        }

        if (!config.uilanguage) {
            warnings.push(lang.t('validation.uiLanguageNotSetDE',
                'UI language not set – en-US will be used.'));
        }
        
        // Validate locale formats
        if (config.inputLocale && !this.isValidLocale(config.inputLocale)) {
            errors.push('Invalid input locale format');
        }
    },

    /**
     * Validate computer name
     */
    validateComputerName(config, errors, warnings) {
        const lang = LanguageManager;
        
        if (config.computerNameStrategy === 'fixed') {
            if (!config.computerName) {
                errors.push(lang.t('validations.required', { field: lang.t('fields.computerName') }));
            } else {
                // Windows computer name rules
                const name = config.computerName;
                
                if (name.length > 15) {
                    errors.push(lang.t('validations.maxLength', { 
                        field: lang.t('fields.computerName'), 
                        length: 15 
                    }));
                }
                
                if (name.length < 1) {
                    errors.push(lang.t('validations.minLength', { 
                        field: lang.t('fields.computerName'), 
                        length: 1 
                    }));
                }
                
                if (!/^[a-zA-Z0-9-]+$/.test(name)) {
                    errors.push(lang.t('validations.computerNameInvalid'));
                }
                
                if (name.startsWith('-') || name.endsWith('-')) {
                    errors.push(lang.t('validations.computerNameStartEnd'));
                }
                
                // Reserved names
                const reserved = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 
                                'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 
                                'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
                                
                if (reserved.includes(name.toUpperCase())) {
                    errors.push(`Computer name cannot be a reserved name: ${name}`);
                }
            }
        } else if (config.computerNameStrategy === 'prefix-counter') {
            if (!config.computerNamePrefix) {
                warnings.push('No prefix set for computer naming');
            }
        }
    },

    /**
     * Validate product key
     */
    validateProductKey(config, errors, warnings) {
        const lang = LanguageManager;
        
        if (config.productKey) {
            // Basic product key format validation
            const keyPattern = /^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/i;
            
            if (!keyPattern.test(config.productKey)) {
                errors.push(lang.t('validations.productKeyFormat'));
            }
            
            // Check for known generic keys (evaluation keys)
            const genericKeys = [
                'W269N-WFGWX-YVC9B-4J6C9-T83GX', // Windows 11 Pro
                'MH37W-N47XK-V7XM9-C7227-GCQG9', // Windows 11 Pro N
                'NPPR9-FWDCX-D2C8J-H872K-2YT43', // Windows 11 Enterprise
                'DPH2V-TTNVB-4X9Q3-TJR4H-KHJW4', // Windows 11 Education
            ];
            
            if (genericKeys.includes(config.productKey.toUpperCase())) {
                warnings.push('Using evaluation product key');
            }
        } else if (!config.skipProductKey) {
            warnings.push('No product key provided, will need to enter during installation');
        }
    },

    /**
     * Validate network settings
     */
    validateNetworkSettings(config, errors, warnings) {
        const lang = LanguageManager;
        
        if (config.networkConfig === 'static') {
            // Validate IP address
            if (!config.ipAddress) {
                errors.push(lang.t('validations.required', { field: lang.t('fields.ipAddress') }));
            } else if (!this.isValidIPAddress(config.ipAddress)) {
                errors.push(lang.t('validations.ipAddressInvalid'));
            }
            
            // Validate subnet mask
            if (!config.subnetMask) {
                errors.push(lang.t('validations.required', { field: lang.t('fields.subnetMask') }));
            } else if (!this.isValidSubnetMask(config.subnetMask)) {
                errors.push(lang.t('validations.subnetMaskInvalid'));
            }
            
            // Validate gateway
            if (!config.gateway) {
                warnings.push('No default gateway specified');
            } else if (!this.isValidIPAddress(config.gateway)) {
                errors.push('Invalid gateway IP address');
            }
            
            // Validate DNS
            if (config.primaryDns && !this.isValidIPAddress(config.primaryDns)) {
                errors.push('Invalid primary DNS server');
            }
            
            if (config.secondaryDns && !this.isValidIPAddress(config.secondaryDns)) {
                errors.push('Invalid secondary DNS server');
            }
            
            // Check for common mistakes
            if (config.ipAddress && config.gateway) {
                if (!this.areInSameSubnet(config.ipAddress, config.gateway, config.subnetMask)) {
                    warnings.push('Gateway appears to be in a different subnet');
                }
            }
        }
    },

    /**
     * Validate users
     */
    validateUsers(config, errors, warnings) {
        const lang = LanguageManager;
        
        // Validate admin password
        if (config.adminPassword) {
            const passwordIssues = this.validatePassword(config.adminPassword);
            if (passwordIssues.length > 0) {
                warnings.push(`Administrator password: ${passwordIssues.join(', ')}`);
            }
            
            if (config.adminPasswordConfirm && config.adminPassword !== config.adminPasswordConfirm) {
                errors.push(lang.t('validations.mustMatch', { field: 'Administrator passwords' }));
            }
        } else {
            // Strenger: wenn das Administrator-Konto aktiv ist, ist ein gesetztes
            // Passwort Pflicht. Ohne wird das Built-in-Admin-Konto ohne Passwort
            // ausgerollt – ein klares Sicherheitsrisiko.
            if (config.enableAdminAccount !== false) {
                errors.push(lang.t('validation.adminPwExposed',
                    'No administrator password set – the built-in account would be exposed without a password.'));
            } else {
                warnings.push(lang.t('validation.adminPwMissing',
                    'No administrator password set.'));
            }
        }
        
        // Validate additional users
        if (config.users && config.users.length > 0) {
            config.users.forEach((user, index) => {
                if (!user.username) {
                    errors.push(`User ${index + 1}: Username is required`);
                } else if (user.username.length > 20) {
                    errors.push(`User ${index + 1}: Username too long (max 20 characters)`);
                } else if (!/^[a-zA-Z0-9._-]+$/.test(user.username)) {
                    errors.push(`User ${index + 1}: Username contains invalid characters`);
                }
                
                if (!user.password) {
                    warnings.push(`User ${index + 1} (${user.username}): No password set`);
                } else {
                    const passwordIssues = this.validatePassword(user.password);
                    if (passwordIssues.length > 0) {
                        warnings.push(`User ${index + 1} (${user.username}): ${passwordIssues.join(', ')}`);
                    }
                }
                
                // Check for duplicate usernames
                const duplicates = config.users.filter(u => u.username === user.username);
                if (duplicates.length > 1) {
                    errors.push(`Duplicate username: ${user.username}`);
                }
            });
        }
    },

    /**
     * Validate partitions
     */
    validatePartitions(config, errors, warnings) {
        if (config.partitions && config.partitions.length > 0) {
            let totalSize = 0;
            let hasSystemPartition = false;
            let hasBootPartition = false;
            
            config.partitions.forEach((partition, index) => {
                // Check partition type
                if (partition.type === 'efi' || partition.type === 'system') {
                    hasSystemPartition = true;
                }
                if (partition.type === 'primary' && partition.active) {
                    hasBootPartition = true;
                }
                
                // Check size
                if (partition.size) {
                    const size = parseInt(partition.size);
                    if (size < 0) {
                        errors.push(`Partition ${index + 1}: Size cannot be negative`);
                    } else if (size > 0 && size < 100 && partition.type === 'primary') {
                        warnings.push(`Partition ${index + 1}: Very small partition size (${size} MB)`);
                    }
                    totalSize += size;
                }
                
                // Check filesystem compatibility
                if (partition.type === 'efi' && partition.filesystem !== 'fat32') {
                    errors.push(`Partition ${index + 1}: EFI partition must use FAT32 filesystem`);
                }
                
                // Check drive letter conflicts
                if (partition.letter) {
                    const letterConflicts = config.partitions.filter(p => p.letter === partition.letter);
                    if (letterConflicts.length > 1) {
                        errors.push(`Partition ${index + 1}: Drive letter ${partition.letter} is already assigned`);
                    }
                }
            });
            
            // UEFI vs BIOS checks
            if (config.bootMode === 'uefi' && !hasSystemPartition) {
                warnings.push('UEFI mode selected but no EFI system partition defined');
            }
            if (config.bootMode === 'bios' && !hasBootPartition) {
                warnings.push('BIOS mode selected but no active boot partition defined');
            }
        }
    },

    /**
     * Validate domain settings
     */
    validateDomainSettings(config, errors, warnings) {
        const lang = LanguageManager;
        
        if (config.joinType === 'domain') {
            if (!config.domainName) {
                errors.push(lang.t('validations.required', { field: lang.t('fields.domainName') }));
            } else if (!this.isValidDomainName(config.domainName)) {
                errors.push(lang.t('validations.domainNameInvalid'));
            }
            
            if (!config.domainUser) {
                errors.push(lang.t('validations.required', { field: lang.t('fields.domainUser') }));
            }
            
            if (!config.domainPassword) {
                errors.push(lang.t('validations.required', { field: lang.t('fields.domainPassword') }));
            }
            
            if (config.ouPath && !this.isValidLDAPPath(config.ouPath)) {
                warnings.push('OU path may be invalid');
            }
        }
    },

    /**
     * Validate software packages
     */
    validateSoftwarePackages(config, errors, warnings) {
        if (config.softwarePackages && config.softwarePackages.length > 0) {
            config.softwarePackages.forEach((pkg, index) => {
                if (!pkg.name) {
                    errors.push(`Software ${index + 1}: Name is required`);
                }
                
                if (!pkg.path) {
                    errors.push(`Software ${index + 1}: Installation path is required`);
                } else if (!this.isValidPath(pkg.path)) {
                    warnings.push(`Software ${index + 1}: Path may be invalid`);
                }
                
                // Check for common silent install parameters
                if (pkg.type === 'msi' && !pkg.arguments) {
                    warnings.push(`Software ${index + 1}: No silent install parameters for MSI`);
                }
                
                if (pkg.type === 'exe' && !pkg.arguments) {
                    warnings.push(`Software ${index + 1}: No silent install parameters for EXE`);
                }
            });
        }
    },

    /**
     * Validate scripts
     */
    validateScripts(config, errors, warnings) {
        if (config.scripts && config.scripts.length > 0) {
            config.scripts.forEach((script, index) => {
                if (!script.command && !script.content) {
                    errors.push(`Script ${index + 1}: Either command or content is required`);
                }
                
                if (script.command && !this.isValidPath(script.command)) {
                    warnings.push(`Script ${index + 1}: Command path may be invalid`);
                }
                
                if (script.type === 'powershell' && script.command && !script.command.includes('-ExecutionPolicy')) {
                    warnings.push(`Script ${index + 1}: PowerShell script without ExecutionPolicy parameter`);
                }
                
                if (script.timeout && parseInt(script.timeout) < 0) {
                    errors.push(`Script ${index + 1}: Timeout cannot be negative`);
                }
            });
        }
    },

    /**
     * Validate drivers
     */
    validateDrivers(config, errors, warnings) {
        if (config.drivers && config.drivers.length > 0) {
            config.drivers.forEach((driver, index) => {
                if (!driver.name) {
                    errors.push(`Driver ${index + 1}: Name is required`);
                }
                
                if (!driver.infPath) {
                    errors.push(`Driver ${index + 1}: INF file path is required`);
                } else if (!driver.infPath.toLowerCase().endsWith('.inf')) {
                    errors.push(`Driver ${index + 1}: Path must point to an INF file`);
                }
                
                if (driver.hardwareId && !this.isValidHardwareId(driver.hardwareId)) {
                    warnings.push(`Driver ${index + 1}: Hardware ID format may be invalid`);
                }
            });
        }
        
        if (config.driverPath && config.autoModelDetection && !config.driverPath.includes('%MODEL%')) {
            warnings.push('Auto model detection enabled but driver path does not contain %MODEL% variable');
        }
    },

    /**
     * Validate password strength
     */
    validatePassword(password) {
        const issues = [];
        
        if (password.length < 8) {
            issues.push('Less than 8 characters');
        }
        if (password.length > 127) {
            issues.push('Too long (max 127 characters)');
        }
        if (!/[A-Z]/.test(password)) {
            issues.push('No uppercase letters');
        }
        if (!/[a-z]/.test(password)) {
            issues.push('No lowercase letters');
        }
        if (!/[0-9]/.test(password)) {
            issues.push('No numbers');
        }
        if (!/[^A-Za-z0-9]/.test(password)) {
            issues.push('No special characters');
        }
        
        // Check for common weak passwords
        const weakPasswords = ['password', '12345678', 'password123', 'admin', 'administrator', 'letmein'];
        if (weakPasswords.includes(password.toLowerCase())) {
            issues.push('Common weak password');
        }
        
        return issues;
    },

    /**
     * Check if valid IP address
     */
    isValidIPAddress(ip) {
        const pattern = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        return pattern.test(ip);
    },

    /**
     * Check if valid subnet mask
     */
    isValidSubnetMask(mask) {
        if (!this.isValidIPAddress(mask)) return false;
        
        // Convert to binary and check if valid mask
        const parts = mask.split('.').map(p => parseInt(p));
        const binary = parts.map(p => p.toString(2).padStart(8, '0')).join('');
        
        // Valid subnet mask has all 1s followed by all 0s
        const firstZero = binary.indexOf('0');
        if (firstZero === -1) return true; // 255.255.255.255
        
        return !binary.substring(firstZero).includes('1');
    },

    /**
     * Check if two IPs are in same subnet
     */
    areInSameSubnet(ip1, ip2, mask) {
        const ip1Parts = ip1.split('.').map(p => parseInt(p));
        const ip2Parts = ip2.split('.').map(p => parseInt(p));
        const maskParts = mask.split('.').map(p => parseInt(p));
        
        for (let i = 0; i < 4; i++) {
            if ((ip1Parts[i] & maskParts[i]) !== (ip2Parts[i] & maskParts[i])) {
                return false;
            }
        }
        return true;
    },

    /**
     * Check if valid domain name
     */
    isValidDomainName(domain) {
        const pattern = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9])*$/;
        return pattern.test(domain);
    },

    /**
     * Check if valid LDAP path
     */
    isValidLDAPPath(path) {
        const pattern = /^(OU|CN)=.+(,\s*(OU|DC|CN)=.+)*$/i;
        return pattern.test(path);
    },

    /**
     * Check if valid GUID
     */
    isValidGUID(guid) {
        const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return pattern.test(guid);
    },

    /**
     * Check if valid file path
     */
    isValidPath(path) {
        // Basic path validation
        if (!path) return false;
        
        // Check for invalid characters
        const invalidChars = ['<', '>', '|', '"', '?', '*'];
        for (const char of invalidChars) {
            if (path.includes(char)) return false;
        }
        
        // Check for UNC path
        if (path.startsWith('\\\\')) {
            return path.length > 4 && !path.endsWith('\\');
        }
        
        // Check for drive letter path
        if (/^[A-Z]:/i.test(path)) {
            return path.length > 3;
        }
        
        // Check for relative path
        return !path.includes(':');
    },

    /**
     * Check if valid hardware ID
     */
    isValidHardwareId(id) {
        // Basic hardware ID format validation
        const pattern = /^[A-Z0-9]+\\(VEN|VID|DEV|PID|SUBSYS)_[A-Z0-9]+/i;
        return pattern.test(id);
    },

    /**
     * Check if valid locale
     */
    isValidLocale(locale) {
        // Windows locale format: LCID:KeyboardID
        const pattern = /^[0-9A-Fa-f]{4}:[0-9A-Fa-f]{8}$/;
        return pattern.test(locale);
    },

    /**
     * Create validation summary
     */
    createValidationSummary(validation) {
        const lang = LanguageManager;
        let summary = '';
        
        if (validation.valid) {
            summary = `✅ ${lang.t('notifications.configValid')}\n`;
            if (validation.warnings.length > 0) {
                summary += `\n⚠️ Warnings (${validation.warnings.length}):\n`;
                validation.warnings.forEach(w => {
                    summary += `• ${w}\n`;
                });
            }
        } else {
            summary = `❌ Configuration Invalid\n\n`;
            summary += `Errors (${validation.errors.length}):\n`;
            validation.errors.forEach(e => {
                summary += `• ${e}\n`;
            });
            
            if (validation.warnings.length > 0) {
                summary += `\n⚠️ Warnings (${validation.warnings.length}):\n`;
                validation.warnings.forEach(w => {
                    summary += `• ${w}\n`;
                });
            }
        }
        
        return summary;
    }
};