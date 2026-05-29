/**
 * Wizard Mode Functions
 * Handles all wizard-specific functionality for step-by-step configuration
 * Multi-language version
 */

import { ConfigManager } from './config.js';
import { UIHelpers } from './ui-helpers.js';
import { DynamicElements } from './dynamic-elements.js';
import { LanguageManager } from './language-manager.js';

export const WizardMode = {
    /**
     * Initialize wizard steps
     */
    initializeSteps() {
        const wizardContent = document.getElementById('wizard-content');
        
        // Make sure we have a current step
        if (!ConfigManager.currentStep || ConfigManager.currentStep < 1) {
            ConfigManager.currentStep = 1;
        }
        
        wizardContent.innerHTML = `
            <div class="wizard-page" id="step-1">
                ${this.renderStep1()}
            </div>
            <div class="wizard-page" id="step-2" style="display:none;">
                ${this.renderStep2()}
            </div>
            <div class="wizard-page" id="step-3" style="display:none;">
                ${this.renderStep3()}
            </div>
            <div class="wizard-page" id="step-4" style="display:none;">
                ${this.renderStep4()}
            </div>
            <div class="wizard-page" id="step-5" style="display:none;">
                ${this.renderStep5()}
            </div>
            <div class="wizard-page" id="step-6" style="display:none;">
                ${this.renderStep6()}
            </div>
        `;

        this.attachEventListeners();

        // Gespeicherte Werte zurück in die Felder schreiben (Bug 13), BEVOR
        // goToStep() via saveCurrentStepData() die sonst leeren Felder liest und
        // damit die Konfiguration überschreibt (Datenverlust bei Reload/Sprachwechsel).
        this.restoreStepFields();

        // Settings-Stil: jede Setting-Zeile bekommt ein passendes Icon links.
        if (typeof UIHelpers !== 'undefined' && UIHelpers.applyRowIcons) {
            UIHelpers.applyRowIcons(wizardContent);
        }

        // Make first step visible and set indicators
        this.goToStep(ConfigManager.currentStep);
    },

    /**
     * Schreibt gespeicherte Konfigurationswerte zurück in die Schritt-Felder
     * (Bug 13). Werte werden ausschließlich über DOM-Properties (.value/.checked)
     * gesetzt – kein Markup-Einfügen, also kein XSS-Vektor.
     */
    restoreStepFields() {
        const config = ConfigManager.getConfig();

        // Generisch: Wizard-Felder haben id === Konfigurationsschlüssel.
        Object.keys(config).forEach(key => {
            const value = config[key];
            if (value == null || typeof value === 'object') return; // Arrays/Objekte separat
            const el = document.getElementById(key);
            if (!el) return;
            if (el.type === 'checkbox') {
                el.checked = Boolean(value);
            } else if (el.tagName === 'SELECT' || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.value = value;
            }
        });

        // Computername-Strategie: zuerst die abhängigen Unterfelder rendern lassen,
        // dann fixen Namen bzw. Präfix setzen.
        if (document.getElementById('computerNameStrategy') && config.computerNameStrategy) {
            this.updateComputerNameOptions();
            const prefix = document.getElementById('computerNamePrefix');
            if (prefix && config.computerNamePrefix != null) prefix.value = config.computerNamePrefix;
            const cname = document.getElementById('computerName');
            if (cname && config.computerName != null) cname.value = config.computerName;
        }

        // Windows-Features (der Wizard speichert sie als Objekt {netfx3:true,…}).
        if (config.features && typeof config.features === 'object' && !Array.isArray(config.features)) {
            Object.entries(config.features).forEach(([name, on]) => {
                const cb = document.getElementById(`feature-${name}`);
                if (cb && cb.type === 'checkbox') cb.checked = Boolean(on);
            });
        }
    },

    /**
     * Refresh content with current language
     */
    refreshContent() {
        if (ConfigManager.currentStep && document.getElementById(`step-${ConfigManager.currentStep}`)) {
            const currentStepElement = document.getElementById(`step-${ConfigManager.currentStep}`);
            const renderMethod = `renderStep${ConfigManager.currentStep}`;
            if (this[renderMethod]) {
                currentStepElement.innerHTML = this[renderMethod]();
                this.attachEventListeners();
                if (typeof UIHelpers !== 'undefined' && UIHelpers.applyRowIcons) {
                    UIHelpers.applyRowIcons(currentStepElement);
                }
            }
        }
    },

    /**
     * Render Step 1: Basic Settings
     */
    renderStep1() {
        const lang = LanguageManager;
        
        return `
            <h2>${lang.t('wizard.steps.basic.heading')}</h2>
            
            <div class="info-box">
                <div class="info-box-title">
                    💡 ${lang.t('wizard.steps.basic.massDeploymentTip')}
                </div>
                <div class="info-box-content">
                    ${lang.t('wizard.steps.basic.massDeploymentHint')}
                </div>
            </div>
            
            <div class="grid grid-2">
                <div class="form-group">
                    <label class="form-label" for="windowsVersion">${lang.t('fields.windowsVersion')}</label>
                    <select class="form-control" id="windowsVersion" name="windowsVersion">
                        ${this.getWindowsVersionOptions()}
                    </select>
                </div>
                <div class="form-group">
                <label class="form-label" for="productKey">${lang.t('fields.productKey')}</label>
                <input type="text" class="form-control" id="productKey" name="productKey" autocomplete="off" placeholder="${lang.t('placeholders.productKey')}">
                <div class="form-hint">${lang.t('hints.leaveEmpty')}</div>
                </div>
                <div class="form-group">
                    <label class="form-label" for="computerNameStrategy">${lang.t('fields.computerNameStrategy')}</label>
                    <select class="form-control" id="computerNameStrategy" name="computerNameStrategy">
                        ${this.getComputerNameStrategyOptions()}
                    </select>
                </div>
                <div class="form-group" id="computerNameOptions">
                <label class="form-label" for="computerName">${lang.t('fields.computerName')}</label>
                <input type="text" class="form-control" id="computerName" name="computerName" autocomplete="off" placeholder="${lang.t('placeholders.computerName')}">
                <div class="form-hint">${lang.t('hints.computerNameFixed')}</div>
                </div>
                <div class="form-group">
                <label class="form-label" for="organization">${lang.t('fields.organization')}</label>
                <input type="text" class="form-control" id="organization" name="organization" autocomplete="organization" placeholder="${lang.t('placeholders.organization')}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="timezone">${lang.t('fields.timezone')}</label>
                    <select class="form-control" id="timezone" name="timezone">
                        ${this.getTimezoneOptions()}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label" for="uilanguage">${lang.t('fields.uiLanguage')}</label>
                    <select class="form-control" id="uilanguage" name="uilanguage">
                        ${this.getLanguageOptions()}
                    </select>
                </div>
            </div>

            <div class="collapsible">
                <div class="collapsible-header">
                    <span>⚙️ ${lang.t('wizard.steps.basic.advancedSettings')}</span>
                    <span class="collapsible-icon">▼</span>
                </div>
                <div class="collapsible-content">
                    <div class="grid grid-2">
                        <div class="form-group">
                            <label class="form-label" for="systemLocale">${lang.t('fields.systemLocale')}</label>
                            <select class="form-control" id="systemLocale" name="systemLocale">
                                ${this.getLanguageOptions()}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="inputLocale">${lang.t('fields.inputLocale')}</label>
                            <select class="form-control" id="inputLocale" name="inputLocale">
                                <option value="0407:00000407">Deutsch</option>
                                <option value="0409:00000409">US-English</option>
                                <option value="040c:0000040c">French</option>
                                <option value="0410:00000410">Italian</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="skipEula">
                                <input type="checkbox" id="skipEula" name="skipEula" checked> ${lang.t('fields.skipEula')}
                            </label>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="skipProductKey">
                                <input type="checkbox" id="skipProductKey" name="skipProductKey"> ${lang.t('fields.skipProductKey')}
                            </label>
                        </div>
                    </div>
                    
                    <div class="card" style="margin-top: 20px;">
                        <div class="card-title">🖥️ ${lang.t('wizard.steps.basic.advancedComputerOptions')}</div>
                        <div id="advancedComputerNameOptions" style="display:none;"></div>
                        <div class="form-hint">
                            <strong>${lang.t('wizard.steps.basic.massDeploymentTips')}</strong><br>
                            ${lang.t('hints.chassisMapping')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render Step 2: Partitioning
     */
    renderStep2() {
        const lang = LanguageManager;
        
        return `
            <h2>${lang.t('wizard.steps.partitioning.heading')}</h2>
            <div class="form-group">
                <label class="form-label" for="autoPartition">
                    <input type="checkbox" id="autoPartition" name="autoPartition" checked> ${lang.t('wizard.steps.partitioning.autoPartition')}
                </label>
                <div class="form-hint">${lang.t('wizard.steps.partitioning.autoPartitionHint')}</div>
            </div>
            <div id="manualPartitions" style="display:none;">
                <div class="card">
                    <div class="card-title">${lang.t('wizard.steps.partitioning.manualConfig')}</div>
                    <button class="btn btn-secondary" id="addPartitionBtn">${lang.t('buttons.addPartition')}</button>
                    <div id="partitionList"></div>
                </div>
            </div>
        `;
    },

    /**
     * Render Step 3: User Accounts
     */
    renderStep3() {
        const lang = LanguageManager;
        
        return `
            <h2>${lang.t('wizard.steps.users.heading')}</h2>
            <div class="card">
                <div class="card-title">${lang.t('wizard.steps.users.adminAccount')}</div>
                <div class="grid grid-2">
                    <div class="form-group">
                        <label class="form-label" for="adminPassword">${lang.t('wizard.steps.users.adminPassword')}</label>
                        <input type="password" class="form-control" id="adminPassword" name="adminPassword" autocomplete="new-password" placeholder="${lang.t('placeholders.password')}">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="adminPasswordConfirm">${lang.t('wizard.steps.users.confirmPassword')}</label>
                        <input type="password" class="form-control" id="adminPasswordConfirm" name="adminPasswordConfirm" autocomplete="new-password" placeholder="${lang.t('placeholders.password')}">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label" for="autoLogon">
                    <input type="checkbox" id="autoLogon" name="autoLogon"> ${lang.t('wizard.steps.users.autoLogon')}
                    </label>
                </div>
            </div>
            <div class="card">
                <div class="card-title">${lang.t('wizard.steps.users.additionalUsers')}</div>
                <button class="btn btn-secondary" id="addUserBtn">${lang.t('buttons.addUser')}</button>
                <div id="userList"></div>
            </div>
        `;
    },

    /**
     * Render Step 4: Network Settings
     */
    renderStep4() {
        const lang = LanguageManager;
        
        return `
            <h2>${lang.t('wizard.steps.network.heading')}</h2>
            <div class="grid grid-2">
                <div class="form-group">
                    <label class="form-label" for="networkConfig">${lang.t('wizard.steps.network.networkConfig')}</label>
                    <select class="form-control" id="networkConfig" name="networkConfig">
                        <option value="dhcp">${lang.t('options.networkConfigs.dhcp')}</option>
                        <option value="static">${lang.t('options.networkConfigs.static')}</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label" for="joinType">${lang.t('wizard.steps.network.joinType')}</label>
                    <select class="form-control" id="joinType" name="joinType">
                        <option value="workgroup">${lang.t('options.joinTypes.workgroup')}</option>
                        <option value="domain">${lang.t('options.joinTypes.domain')}</option>
                    </select>
                </div>
            </div>
            <div id="staticIPConfig" style="display:none;">
                <div class="grid grid-2">
                    <div class="form-group">
                        <label class="form-label" for="ipAddress">${lang.t('fields.ipAddress')}</label>
                        <input type="text" class="form-control" id="ipAddress" name="ipAddress" autocomplete="off" placeholder="${lang.t('placeholders.ipAddress')}">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="subnetMask">${lang.t('fields.subnetMask')}</label>
                        <input type="text" class="form-control" id="subnetMask" name="subnetMask" autocomplete="off" placeholder="${lang.t('placeholders.subnetMask')}">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="gateway">${lang.t('fields.gateway')}</label>
                        <input type="text" class="form-control" id="gateway" name="gateway" autocomplete="off" placeholder="${lang.t('placeholders.gateway')}">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="dnsServer">${lang.t('fields.primaryDns')}</label>
                        <input type="text" class="form-control" id="dnsServer" name="dnsServer" autocomplete="off" placeholder="${lang.t('placeholders.dnsServer')}">
                    </div>
                </div>
            </div>
            <div id="domainConfig" style="display:none;">
                <div class="grid grid-2">
                    <div class="form-group">
                        <label class="form-label" for="domainName">${lang.t('fields.domainName')}</label>
                        <input type="text" class="form-control" id="domainName" name="domainName" autocomplete="off" placeholder="${lang.t('placeholders.domainName')}">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="domainUser">${lang.t('fields.domainUser')}</label>
                        <input type="text" class="form-control" id="domainUser" name="domainUser" autocomplete="username" placeholder="${lang.t('placeholders.domainUser')}">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="domainPassword">${lang.t('fields.domainPassword')}</label>
                        <input type="password" class="form-control" id="domainPassword" name="domainPassword" autocomplete="current-password">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="domainOU">${lang.t('fields.ouPath')}</label>
                        <input type="text" class="form-control" id="domainOU" name="domainOU" autocomplete="off" placeholder="${lang.t('placeholders.ouPath')}">
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render Step 5: Software & Updates
     */
    renderStep5() {
        const lang = LanguageManager;
        
        return `
            <h2>${lang.t('wizard.steps.software.heading')}</h2>
            <div class="card">
                <div class="card-title">${lang.t('wizard.steps.software.windowsUpdates')}</div>
                <div class="form-group">
                    <label class="form-label" for="updateSettings">${lang.t('wizard.steps.software.updateSettings')}</label>
                    <select class="form-control" id="updateSettings" name="updateSettings">
                        <option value="auto">${lang.t('options.updateModes.auto')}</option>
                        <option value="download">${lang.t('options.updateModes.download')}</option>
                        <option value="notify">${lang.t('options.updateModes.notify')}</option>
                        <option value="disabled">${lang.t('options.updateModes.disabled')}</option>
                    </select>
                </div>
            </div>
            <div class="card">
                <div class="card-title">${lang.t('wizard.steps.software.softwarePackages')}</div>
                <button class="btn btn-secondary" id="addSoftwareBtn">${lang.t('buttons.addSoftware')}</button>
                <div id="softwareList"></div>
                <div class="form-hint">${lang.t('wizard.steps.software.softwareHint')}</div>
            </div>
            <div class="card">
                <div class="card-title">${lang.t('wizard.steps.software.windowsFeatures')}</div>
                <div class="form-group">
                    <label for="feature-netfx3"><input type="checkbox" id="feature-netfx3" name="feature-netfx3"> .NET Framework 3.5</label><br>
                    <label for="feature-hyperv"><input type="checkbox" id="feature-hyperv" name="feature-hyperv"> Hyper-V</label><br>
                    <label for="feature-wsl"><input type="checkbox" id="feature-wsl" name="feature-wsl"> Windows Subsystem for Linux</label><br>
                    <label for="feature-telnet"><input type="checkbox" id="feature-telnet" name="feature-telnet"> Telnet Client</label><br>
                    <label for="feature-iis"><input type="checkbox" id="feature-iis" name="feature-iis"> Internet Information Services</label>
                </div>
            </div>
        `;
    },

    /**
     * Render Step 6: Summary
     */
    renderStep6() {
        const lang = LanguageManager;
        return `
            <h2>${lang.t('wizard.steps.finish.heading')}</h2>
            <div id="finishValidation"></div>
            <div class="card">
                <div class="card-title">${lang.t('wizard.steps.finish.configOverview')}</div>
                <div id="configSummary"></div>
            </div>
        `;
    },

    /**
     * Get Windows version options
     */
    getWindowsVersionOptions() {
        const lang = LanguageManager;
        const versions = lang.t('options.windowsVersions');
        
        if (typeof versions === 'object') {
            return Object.entries(versions)
                .map(([value, text]) => `<option value="${value}">${text}</option>`)
                .join('');
        }
        
        // Fallback
        return `
            <option value="win11pro">Windows 11 Pro</option>
            <option value="win11enterprise">Windows 11 Enterprise</option>
            <option value="server2022standard">Windows Server 2022 Standard</option>
            <option value="server2022datacenter">Windows Server 2022 Datacenter</option>
        `;
    },

    /**
     * Get computer name strategy options
     */
    getComputerNameStrategyOptions() {
        const lang = LanguageManager;
        const strategies = lang.t('options.computerNameStrategies');
        
        if (typeof strategies === 'object') {
            return Object.entries(strategies)
                .map(([value, text]) => `<option value="${value}">${text}</option>`)
                .join('');
        }
        
        return `
            <option value="fixed">Fixed Name</option>
            <option value="random">Randomly Generated</option>
            <option value="serial">Serial Number Based</option>
            <option value="mac">MAC Address Based</option>
        `;
    },

    /**
     * Get timezone options
     */
    getTimezoneOptions() {
        const lang = LanguageManager;
        
        return `
            <option value="W. Europe Standard Time">Western Europe (Berlin, Vienna)</option>
            <option value="Central European Standard Time">Central Europe</option>
            <option value="GMT Standard Time">GMT (London)</option>
            <option value="Eastern Standard Time">Eastern Time (USA)</option>
            <option value="Pacific Standard Time">Pacific Time (USA)</option>
            <option value="China Standard Time">China Standard</option>
            <option value="Tokyo Standard Time">Tokyo</option>
        `;
    },

    /**
     * Get language options
     */
    getLanguageOptions() {
        const lang = LanguageManager;
        const languages = lang.t('options.languages');
        
        if (typeof languages === 'object') {
            return Object.entries(languages)
                .map(([value, text]) => `<option value="${value}">${text}</option>`)
                .join('');
        }
        
        return `
            <option value="de-DE">Deutsch (Deutschland)</option>
            <option value="en-US">English (US)</option>
            <option value="fr-FR">Français</option>
        `;
    },

    /**
     * Attach event listeners for wizard
     */
    attachEventListeners() {
        // Collapsible sections
        document.querySelectorAll('.collapsible-header').forEach(header => {
            header.addEventListener('click', () => UIHelpers.toggleCollapsible(header));
        });

        // Computer name strategy
        const computerNameStrategy = document.getElementById('computerNameStrategy');
        if (computerNameStrategy) {
            computerNameStrategy.addEventListener('change', () => this.updateComputerNameOptions());
        }

        // Partition mode
        const autoPartition = document.getElementById('autoPartition');
        if (autoPartition) {
            autoPartition.addEventListener('change', (e) => {
                UIHelpers.setElementVisibility('manualPartitions', !e.target.checked);
            });
        }

        // Network config
        const networkConfig = document.getElementById('networkConfig');
        if (networkConfig) {
            networkConfig.addEventListener('change', (e) => {
                UIHelpers.setElementVisibility('staticIPConfig', e.target.value === 'static');
            });
        }

        // Join type
        const joinType = document.getElementById('joinType');
        if (joinType) {
            joinType.addEventListener('change', (e) => {
                UIHelpers.setElementVisibility('domainConfig', e.target.value === 'domain');
            });
        }

        // Dynamic element buttons
        const addPartitionBtn = document.getElementById('addPartitionBtn');
        if (addPartitionBtn) {
            addPartitionBtn.addEventListener('click', () => DynamicElements.addPartition());
        }

        const addUserBtn = document.getElementById('addUserBtn');
        if (addUserBtn) {
            addUserBtn.addEventListener('click', () => DynamicElements.addUser());
        }

        const addSoftwareBtn = document.getElementById('addSoftwareBtn');
        if (addSoftwareBtn) {
            addSoftwareBtn.addEventListener('click', () => DynamicElements.addSoftware());
        }
    },

    /**
     * Update computer name options based on strategy
     */
    updateComputerNameOptions() {
        const lang = LanguageManager;
        const strategy = document.getElementById('computerNameStrategy').value;
        const optionsDiv = document.getElementById('computerNameOptions');
        const advancedDiv = document.getElementById('advancedComputerNameOptions');
        
        ConfigManager.updateConfig('computerNameStrategy', strategy);
        
        const strategies = {
            'fixed': `
                <label class="form-label" for="computerName">${lang.t('fields.computerName')}</label>
                <input type="text" class="form-control" id="computerName" name="computerName" autocomplete="off" placeholder="${lang.t('placeholders.computerName')}">
                <div class="form-hint">${lang.t('hints.computerNameFixed')}</div>
            `,
            'random': `
                <label class="form-label" for="computerNamePrefix">${lang.t('fields.prefix')}</label>
                <input type="text" class="form-control" id="computerNamePrefix" name="computerNamePrefix" autocomplete="off" placeholder="WIN-" value="WIN-">
                <div class="form-hint">${lang.t('hints.computerNameGenerated', { pattern: 'WIN-XXXXXXXXXXXX' })}</div>
            `,
            'prompt': `
                <label class="form-label" for="computerNameDefault">${lang.t('fields.defaultSuggestion')}</label>
                <input type="text" class="form-control" id="computerNameDefault" name="computerNameDefault" autocomplete="off" placeholder="COMPUTER">
            `
        };
        
        optionsDiv.innerHTML = strategies[strategy] || strategies['fixed'];
        
        if (['serial', 'mac', 'prefix-counter', 'hardware'].includes(strategy) && advancedDiv) {
            advancedDiv.style.display = 'block';
        } else if (advancedDiv) {
            advancedDiv.style.display = 'none';
        }
    },

    /**
     * Navigate to specific step
     */
    goToStep(step) {
        // Validate step number
        if (!step || step < 1 || step > ConfigManager.totalSteps) {
            console.warn(`Invalid step number: ${step}`);
            return;
        }
        
        // Save current step data if we have a valid current step
        if (ConfigManager.currentStep && ConfigManager.currentStep > 0) {
            this.saveCurrentStepData();
        }
        
        // Hide current step
        if (ConfigManager.currentStep) {
            UIHelpers.setElementVisibility(`step-${ConfigManager.currentStep}`, false);
        }
        
        // Update step indicators
        const wizardSteps = document.querySelectorAll('.wizard-step');
        if (wizardSteps && wizardSteps.length > 0) {
            wizardSteps.forEach((el, index) => {
                el.classList.remove('active');
                if (index < step - 1) {
                    el.classList.add('completed');
                } else {
                    el.classList.remove('completed');
                }
            });
            
            // Check if the element exists before accessing it
            const targetStep = wizardSteps[step - 1];
            if (targetStep) {
                targetStep.classList.add('active');
            }
        }
        
        // Show new step
        UIHelpers.setElementVisibility(`step-${step}`, true);
        ConfigManager.currentStep = step;
        
        // Update navigation buttons
        UIHelpers.setElementVisibility('prevBtn', step !== 1);
        UIHelpers.setElementVisibility('nextBtn', step !== ConfigManager.totalSteps);
        UIHelpers.setElementVisibility('finishBtn', step === ConfigManager.totalSteps);
        
        // Update summary if on last step
        if (step === ConfigManager.totalSteps) {
            this.updateSummary();
        }
    },

    /**
     * Navigate to next step
     */
    nextStep() {
        // Validate current step before proceeding
        if (!this.validateCurrentStep()) {
            return;
        }
        this.saveCurrentStepData();
        this.goToStep(ConfigManager.currentStep + 1);
    },
    
    /**
     * Validate current step data
     */
    validateCurrentStep() {
        const lang = LanguageManager;
        const step = ConfigManager.currentStep;
        
        if (step === 3) {
            // Validate user passwords match
            const password = document.getElementById('adminPassword')?.value;
            const confirmPassword = document.getElementById('adminPasswordConfirm')?.value;
            
            if (password && confirmPassword && password !== confirmPassword) {
                UIHelpers.showNotification(
                    lang.t('validations.mustMatch', { field: lang.t('fields.password') }),
                    'error'
                );
                return false;
            }
        }
        
        return true;
    },

    /**
     * Navigate to previous step
     */
    previousStep() {
        this.goToStep(ConfigManager.currentStep - 1);
    },

    /**
     * Save current step data
     */
    saveCurrentStepData() {
        const step = ConfigManager.currentStep;
        const config = {};
        
        switch(step) {
            case 1:
                config.windowsVersion = document.getElementById('windowsVersion')?.value;
                config.productKey = document.getElementById('productKey')?.value;
                config.computerNameStrategy = document.getElementById('computerNameStrategy')?.value;
                
                if (config.computerNameStrategy === 'fixed') {
                    config.computerName = document.getElementById('computerName')?.value;
                } else {
                    config.computerNamePrefix = document.getElementById('computerNamePrefix')?.value || '';
                }
                
                config.organization = document.getElementById('organization')?.value;
                config.timezone = document.getElementById('timezone')?.value;
                config.uilanguage = document.getElementById('uilanguage')?.value;
                config.systemLocale = document.getElementById('systemLocale')?.value;
                config.inputLocale = document.getElementById('inputLocale')?.value;
                config.skipEula = document.getElementById('skipEula')?.checked;
                config.skipProductKey = document.getElementById('skipProductKey')?.checked;
                break;
                
            case 2:
                config.autoPartition = document.getElementById('autoPartition')?.checked;
                break;
                
            case 3:
                config.adminPassword = document.getElementById('adminPassword')?.value;
                config.adminPasswordConfirm = document.getElementById('adminPasswordConfirm')?.value;
                config.autoLogon = document.getElementById('autoLogon')?.checked;
                break;
                
            case 4:
                config.networkConfig = document.getElementById('networkConfig')?.value;
                config.joinType = document.getElementById('joinType')?.value;
                
                if (config.networkConfig === 'static') {
                    config.ipAddress = document.getElementById('ipAddress')?.value;
                    config.subnetMask = document.getElementById('subnetMask')?.value;
                    config.gateway = document.getElementById('gateway')?.value;
                    config.dnsServer = document.getElementById('dnsServer')?.value;
                }
                
                if (config.joinType === 'domain') {
                    config.domainName = document.getElementById('domainName')?.value;
                    config.domainUser = document.getElementById('domainUser')?.value;
                    config.domainPassword = document.getElementById('domainPassword')?.value;
                    // Kanonischer Config-Key ist "ouPath" (so liest ihn der
                    // XML-Generator und der Pro-Mode). Das DOM-Feld heißt aus
                    // historischen Gründen weiterhin "domainOU".
                    config.ouPath = document.getElementById('domainOU')?.value;
                }
                break;
                
            case 5:
                config.updateSettings = document.getElementById('updateSettings')?.value;
                config.features = {
                    netfx3: document.getElementById('feature-netfx3')?.checked,
                    hyperv: document.getElementById('feature-hyperv')?.checked,
                    wsl: document.getElementById('feature-wsl')?.checked,
                    telnet: document.getElementById('feature-telnet')?.checked,
                    iis: document.getElementById('feature-iis')?.checked
                };
                break;
                
            case 6:
                config.enableRDP = document.getElementById('enableRDP')?.checked;
                config.disableUAC = document.getElementById('disableUAC')?.checked;
                config.enableFirewall = document.getElementById('enableFirewall')?.checked;
                config.skipOOBE = document.getElementById('skipOOBE')?.checked;
                break;
        }
        
        ConfigManager.updateConfig(config);
    },

    /**
     * Update configuration summary
     */
    updateSummary() {
        const lang = LanguageManager;
        const summary = document.getElementById('configSummary');
        const config = ConfigManager.getConfig();
        
        let computerNameDisplay = config.computerName || lang.t('placeholders.computerName');
        
        // Werte werden hier als Text via innerHTML gerendert; computerName,
        // organization, timezone und uilanguage sind über XML-Import steuerbar
        // und müssen daher escaped werden (DOM-XSS-Schutz).
        summary.innerHTML = `
            <p><strong>${lang.t('fields.windowsVersion')}:</strong> ${UIHelpers.escapeHtml(config.windowsVersion)}</p>
            <p><strong>${lang.t('fields.computerName')}:</strong> ${UIHelpers.escapeHtml(computerNameDisplay)}</p>
            <p><strong>${lang.t('fields.organization')}:</strong> ${UIHelpers.escapeHtml(config.organization || '-')}</p>
            <p><strong>${lang.t('fields.timezone')}:</strong> ${UIHelpers.escapeHtml(config.timezone)}</p>
            <p><strong>${lang.t('fields.uiLanguage')}:</strong> ${UIHelpers.escapeHtml(config.uilanguage)}</p>
            <p><strong>${lang.t('fields.productKey')}:</strong> ${config.productKey ? '***SET***' : '-'}</p>
        `;

        // Validierungs-Anzeige im Step 6 (ersetzt die alte feste „bereit"-Meldung).
        const validationDiv = document.getElementById('finishValidation');
        if (validationDiv) {
            const VM = (typeof ValidationManager !== 'undefined' && ValidationManager)
                || (typeof window !== 'undefined' && window.ValidationManager);
            const result = (VM && VM.validateConfiguration)
                ? VM.validateConfiguration(config)
                : { errors: [], warnings: [] };
            const errors = result.errors || [];
            const warnings = result.warnings || [];
            const fmt = (e) => UIHelpers.escapeHtml(e && (e.message || e.field) ? (e.message || e.field) : String(e));
            let html = '';
            if (errors.length === 0 && warnings.length === 0) {
                html = `<div class="static-notification success">✓ ${lang.t('wizard.steps.finish.readyMessage')}</div>`;
            } else {
                if (errors.length > 0) {
                    html += `<div class="static-notification error"><strong>${errors.length} ${errors.length === 1 ? 'Fehler' : 'Fehler'}:</strong><ul>${errors.map(e => `<li>${fmt(e)}</li>`).join('')}</ul></div>`;
                }
                if (warnings.length > 0) {
                    html += `<div class="static-notification warning"><strong>${warnings.length} ${warnings.length === 1 ? 'Warnung' : 'Warnungen'}:</strong><ul>${warnings.map(w => `<li>${fmt(w)}</li>`).join('')}</ul></div>`;
                }
            }
            validationDiv.innerHTML = html;
        }
    }
};
