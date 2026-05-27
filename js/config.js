/**
 * Configuration State Management
 * Handles all configuration data and state for the Windows Autounattend.xml Generator
 * Multi-language version
 */

export const ConfigManager = {
    config: {
        windowsVersion: 'win11pro',
        productKey: '',
        computerName: '',
        computerNameStrategy: 'fixed',
        computerNamePrefix: 'PC-',
        computerNameLength: 8,
        organization: '',
        timezone: 'W. Europe Standard Time',
        uilanguage: 'de-DE',
        systemLocale: 'de-DE',
        inputLocale: '0407:00000407',
        skipEula: true,
        skipProductKey: false,
        partitions: [],
        users: [],
        networkSettings: {},
        softwarePackages: [],
        domainSettings: {},
        features: [],
        oobeSettings: {},
        scripts: [],
        drivers: []
    },

    currentStep: 1,
    totalSteps: 6,
    currentMode: 'wizard',

    /**
     * Get current configuration
     */
    getConfig() {
        return this.config;
    },

    /**
     * Update configuration value
     */
    updateConfig(key, value) {
        if (typeof key === 'object') {
            this.config = { ...this.config, ...key };
        } else {
            this.config[key] = value;
        }
    },

    /**
     * Reset configuration to defaults
     */
    resetConfig() {
        this.config = {
            windowsVersion: 'win11pro',
            productKey: '',
            computerName: '',
            computerNameStrategy: 'fixed',
            computerNamePrefix: 'PC-',
            computerNameLength: 8,
            organization: '',
            timezone: 'W. Europe Standard Time',
            uilanguage: 'de-DE',
            systemLocale: 'de-DE',
            inputLocale: '0407:00000407',
            skipEula: true,
            skipProductKey: false,
            partitions: [],
            users: [],
            networkSettings: {},
            softwarePackages: [],
            domainSettings: {},
            features: [],
            oobeSettings: {},
            scripts: [],
            drivers: []
        };
    },

    /**
     * Liefert eine für die Persistenz bereinigte Tiefkopie der Konfiguration.
     *
     * Klartext-Passwörter werden NICHT nach localStorage geschrieben (Schutz auf
     * geteilten Geräten). Die Live-Konfiguration bleibt unverändert, daher sind
     * nur die persistierten Felder leer – nach einem Reload müssen Passwörter
     * neu eingegeben werden.
     */
    getStorableConfig() {
        const clone = JSON.parse(JSON.stringify(this.config));
        delete clone.adminPassword;
        delete clone.adminPasswordConfirm;
        delete clone.domainPassword;
        if (Array.isArray(clone.users)) {
            clone.users.forEach(user => {
                if (user && typeof user === 'object') delete user.password;
            });
        }
        return clone;
    },

    /**
     * Save configuration to localStorage (ohne Klartext-Passwörter).
     */
    saveToStorage(name) {
        try {
            const key = name ? `template_${name}` : 'autounattend_config';
            localStorage.setItem(key, JSON.stringify(this.getStorableConfig()));
            return true;
        } catch (e) {
            console.error('Failed to save configuration:', e);
            return false;
        }
    },

    /**
     * Load configuration from localStorage
     */
    loadFromStorage(name) {
        try {
            const key = name ? `template_${name}` : 'autounattend_config';
            const saved = localStorage.getItem(key);
            if (saved) {
                this.config = JSON.parse(saved);
                return true;
            }
        } catch (e) {
            console.error('Failed to load configuration:', e);
        }
        return false;
    },

    /**
     * Get list of saved templates
     */
    getSavedTemplates() {
        const templates = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('template_')) {
                templates.push(key.replace('template_', ''));
            }
        }
        return templates;
    },

    /**
     * Export configuration as JSON
     */
    exportConfig() {
        return JSON.stringify(this.config, null, 2);
    },

    /**
     * Import configuration from JSON
     */
    importConfig(jsonString) {
        try {
            const imported = JSON.parse(jsonString);
            this.config = { ...this.config, ...imported };
            return true;
        } catch (e) {
            console.error('Failed to import configuration:', e);
            return false;
        }
    },

    /**
     * Validate configuration
     */
    validateConfig() {
        const errors = [];

        // Basic validation
        if (!this.config.windowsVersion) {
            errors.push('windowsVersion');
        }

        if (this.config.computerNameStrategy === 'fixed' && !this.config.computerName) {
            errors.push('computerName');
        }

        if (this.config.joinType === 'domain') {
            if (!this.config.domainName) errors.push('domainName');
            if (!this.config.domainUser) errors.push('domainUser');
            if (!this.config.domainPassword) errors.push('domainPassword');
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    },

    /**
     * Get configuration summary
     */
    getConfigSummary() {
        return {
            mode: this.currentMode,
            windowsVersion: this.config.windowsVersion,
            computerNameStrategy: this.config.computerNameStrategy,
            organization: this.config.organization,
            language: this.config.uilanguage,
            userCount: this.config.users ? this.config.users.length : 0,
            partitionCount: this.config.partitions ? this.config.partitions.length : 0,
            softwareCount: this.config.softwarePackages ? this.config.softwarePackages.length : 0,
            featuresEnabled: this.config.features ? Object.values(this.config.features).filter(f => f).length : 0
        };
    }
};
