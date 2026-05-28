/**
 * Pro Mode Functions - FULLY FIXED VERSION
 * Handles all professional mode functionality with advanced configuration options  
 * Fixed: All form elements have proper IDs, names, and label associations
 */

import { ConfigManager } from './config.js';
import { UIHelpers } from './ui-helpers.js';
import { DynamicElements } from './dynamic-elements.js';
import { LanguageManager } from './language-manager.js';

export const ProMode = {
    // Counter for unique IDs
    elementCounter: 0,
    
    /**
     * Generate unique element ID
     */
    generateUniqueId(prefix) {
        this.elementCounter++;
        return `${prefix}-${Date.now()}-${this.elementCounter}`;
    },

    // --- Persistenz & Wiederherstellung statischer Pro-Mode-Felder (Bug 4) ----
    //
    // Der Pro-Mode rendert Tabs per innerHTML neu; ohne Wiederherstellung gingen
    // alle statischen Feldwerte bei Tab-Wechsel/Reload verloren (dynamische
    // Listen übernimmt DynamicElements.loadFromConfig). Diese Helfer spiegeln
    // jede Feldänderung in die Konfiguration und füllen die Felder nach jedem
    // Render wieder aus der Konfiguration.

    // Feld-`name`-Attribute, die vom Schlüssel abweichen, den der XML-Generator
    // liest – hier auf den kanonischen Config-Key normalisiert.
    _fieldAliases: {
        nameStrategy: 'computerNameStrategy',
        systemlocale: 'systemLocale',
        userlocale:   'userLocale',
        inputlocale:  'inputLocale',
        acceptEula:   'skipEula',       // gleiche boolean-Richtung (EULA akzeptiert/übersprungen)
        networkMode:  'networkConfig'   // Generator liest config.networkConfig
    },

    // IDs von Feldern, deren change-Handler abhängige Panels ein-/ausblenden.
    // pro-nameStrategy ist bewusst NICHT enthalten: dessen Handler rendert die
    // Unteroptionen neu und würde wiederhergestellte Werte überschreiben.
    _visibilityTriggers: [
        'pro-diskMode', 'pro-autoLogon', 'pro-networkMode',
        'pro-enableWINS', 'pro-updateMode', 'pro-joinType', 'pro-role-iis'
    ],

    _persistAttached: false,

    /**
     * Statisches Pro-Mode-Feld? (Kein Bestandteil einer dynamischen Liste, die
     * bereits von DynamicElements über [data-field] verwaltet wird.)
     */
    _isStaticField(field) {
        if (!field || !field.name) return false;
        if (field.hasAttribute('data-field')) return false;
        if (field.name.startsWith('partition-')) return false;
        if (field.closest('.partition-item, .user-item, .software-item, .script-item, .driver-item, .task-item, .feature-item')) {
            return false;
        }
        return true;
    },

    /**
     * Spiegelt ein geändertes statisches Feld in die Konfiguration, damit der
     * Auto-Save (und ein anschließender Reload) es behält. Feature-/Rollen-
     * Checkboxen werden gesammelt nach config.features geschrieben.
     */
    persistField(field) {
        if (!field) return;
        // Feld einer dynamischen Liste (data-field) -> alle Item-Typen neu sammeln
        // und persistieren (Lücke 2/3: Pro-Mode-Items überleben damit den Reload).
        if (field.hasAttribute('data-field')) {
            this.persistAllItems();
            return;
        }
        if (!this._isStaticField(field)) return;
        const id = field.id || '';
        if (id.startsWith('pro-feat-') || id.startsWith('pro-role-')) {
            ConfigManager.updateConfig('features', DynamicElements.collectFeatures());
            return;
        }
        const key = this._fieldAliases[field.name] || field.name;
        const value = field.type === 'checkbox' ? field.checked : field.value;
        ConfigManager.updateConfig(key, value);
    },

    /**
     * Hängt EINMALIG einen delegierten input/change-Listener an den dauerhaften
     * #pro-content-Container (überlebt das innerHTML-Neurendern der Tabs).
     */
    ensurePersistListener() {
        if (this._persistAttached) return;
        const content = document.getElementById('pro-content');
        if (!content) return;
        const handler = (e) => this.persistField(e.target);
        content.addEventListener('input', handler);
        content.addEventListener('change', handler);
        // Entfernen eines Items (remove-btn) -> nach dem Entfernen neu sammeln.
        content.addEventListener('click', (e) => {
            if (e.target.closest('.remove-btn')) {
                setTimeout(() => this.persistAllItems(), 0);
            }
        });
        this._persistAttached = true;
    },

    /**
     * Schreibt gespeicherte Konfigurationswerte zurück in die statischen Felder
     * des aktuell gerenderten Tabs. Werte werden ausschließlich über DOM-
     * Properties (.value/.checked) gesetzt – nie via innerHTML –, daher kein
     * XSS-Vektor (vgl. DynamicElements.populateItem).
     */
    restoreTabValues() {
        const config = ConfigManager.getConfig();
        const content = document.getElementById('pro-content');
        if (!content) return;

        // 1) Generisches Feld-Binding (Feature-/Rollen-Checkboxen separat).
        content.querySelectorAll('[name]').forEach(field => {
            if (!this._isStaticField(field)) return;
            const id = field.id || '';
            if (id.startsWith('pro-feat-') || id.startsWith('pro-role-')) return;
            const key = this._fieldAliases[field.name] || field.name;
            if (!(key in config)) return;
            const value = config[key];
            if (value == null) return;
            if (field.type === 'checkbox') {
                field.checked = Boolean(value);
            } else if (field.type === 'radio') {
                field.checked = (String(field.value) === String(value));
            } else {
                field.value = value;
            }
        });

        // 2) Feature-/Rollen-Checkboxen aus config.features (Array ODER Objekt).
        let enabled = null;
        if (Array.isArray(config.features)) {
            enabled = new Set(config.features
                .filter(f => f && typeof f === 'object' && f.checked !== false)
                .map(f => f.name));
        } else if (config.features && typeof config.features === 'object') {
            enabled = new Set(Object.entries(config.features)
                .filter(([, v]) => v).map(([k]) => k));
        }
        if (enabled) {
            content.querySelectorAll('[id^="pro-feat-"], [id^="pro-role-"]').forEach(cb => {
                cb.checked = enabled.has(cb.id.replace(/^pro-(feat|role)-/, ''));
            });
        }

        // 3) Abhängige Panels nach dem Restore sichtbar schalten, indem die
        //    vorhandenen change-Handler einmal ausgelöst werden.
        this._visibilityTriggers.forEach(triggerId => {
            const el = document.getElementById(triggerId);
            if (el) el.dispatchEvent(new Event('change', { bubbles: true }));
        });

        // Default-Werte des Tabs in die Konfiguration übernehmen, damit auch
        // unveränderte (vorausgewählte) Felder im XML wirken (Lücke 1).
        this.persistStaticFields();
    },

    /**
     * Schreibt alle statischen Felder des aktuellen Tabs in die Konfiguration –
     * auch unveränderte Defaults, sodass vorausgewählte Pro-Mode-Optionen (z. B.
     * "Cortana deaktivieren") auch ohne explizite Interaktion wirksam werden.
     */
    persistStaticFields() {
        const content = document.getElementById('pro-content');
        if (!content) return;
        content.querySelectorAll('[name]').forEach(field => {
            if (this._isStaticField(field)) this.persistField(field);
        });
    },

    // tab -> Liste [configKey, containerId, addFn-Name] der dynamischen Listen.
    _itemSections: {
        disk:     [['partitions', 'pro-partitionList', 'addPartition']],
        users:    [['users', 'pro-userList', 'addUser']],
        software: [['softwarePackages', 'pro-softwareList', 'addSoftware']],
        scripts:  [['scripts', 'pro-scriptList', 'addScript'], ['tasks', 'pro-taskList', 'addTask']],
        drivers:  [['drivers', 'pro-driverList', 'addDriver']]
    },

    /**
     * Sammelt ALLE dynamischen Item-Typen aus dem aktuell gerenderten DOM und
     * schreibt sie in die Konfiguration. collectXxx liest global, liefert also im
     * jeweils aktiven Modus genau dessen Items – eine gemeinsame Datenquelle für
     * Wizard und Pro-Mode (Lücke 3).
     */
    persistAllItems() {
        // Nur die im aktuellen Tab tatsächlich vorhandenen Item-Typen persistieren.
        // collectDynamicData() liefert ausschließlich präsente Typen, sodass Items
        // anderer (nicht gerenderter) Tabs nicht aus der Konfiguration gelöscht werden.
        const data = DynamicElements.collectDynamicData();
        Object.keys(data).forEach(key => ConfigManager.updateConfig(key, data[key]));
    },

    /**
     * Stellt die dynamischen Items des gerade gerenderten Tabs aus der
     * Konfiguration wieder her (Lücke 2). Gespeicherte Items ersetzen die
     * statischen Default-Items; ist nichts gespeichert, bleiben die Defaults.
     * Werte werden über DynamicElements.populateItem (DOM-Properties) gesetzt,
     * also kein XSS-Vektor.
     */
    restoreItems(tab) {
        const sections = this._itemSections[tab];
        if (!sections) return;
        const config = ConfigManager.getConfig();
        sections.forEach(([key, containerId, addFn]) => {
            const items = config[key];
            const container = document.getElementById(containerId);
            if (!container || !Array.isArray(items) || items.length === 0) return;
            container.replaceChildren();
            items.forEach(data => {
                this[addFn]();
                DynamicElements.populateItem(container.lastElementChild, data);
            });
        });
    },

    /**
     * Load Pro Mode content based on tab
     */
    loadContent(tab) {
        const content = document.getElementById('pro-content');
        if (!content) return;
        
        const tabs = {
            'basic': () => this.renderBasicTab(),
            'disk': () => this.renderDiskTab(),
            'users': () => this.renderUsersTab(),
            'network': () => this.renderNetworkTab(),
            'software': () => this.renderSoftwareTab(),
            'domain': () => this.renderDomainTab(),
            'features': () => this.renderFeaturesTab(),
            'oobe': () => this.renderOOBETab(),
            'scripts': () => this.renderScriptsTab(),
            'drivers': () => this.renderDriversTab(),
            'preview': () => this.renderPreviewTab()
        };
        
        const renderFunction = tabs[tab];
        if (renderFunction) {
            // Settings-Stil: jeder Tab beginnt mit einer großen Page-Überschrift.
            const titleText = (LanguageManager && LanguageManager.t)
                ? LanguageManager.t(`pro.tabs.${tab}`)
                : tab;
            const safeTitle = (UIHelpers && UIHelpers.escapeHtml)
                ? UIHelpers.escapeHtml(titleText)
                : String(titleText).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
            content.innerHTML = `<h1 class="page-title">${safeTitle}</h1>` + renderFunction();
            this.attachTabEventListeners(tab);
            this.ensurePersistListener();   // einmaliger Persist-Listener
            this.restoreTabValues();        // gespeicherte statische Werte
            this.restoreItems(tab);         // gespeicherte dynamische Items (Lücke 2)
            // Settings-Stil: jede Setting-Zeile bekommt ein passendes Icon links.
            if (UIHelpers && UIHelpers.applyRowIcons) UIHelpers.applyRowIcons(content);
        } else {
            content.innerHTML = `<div class="card"><div class="card-title">${LanguageManager?.t('common.loading') || 'Loading...'}</div></div>`;
        }
    },

    /**
     * Refresh content with current language
     */
    refreshContent() {
        const activeTab = document.querySelector('.pro-tab.active');
        if (activeTab) {
            this.loadContent(activeTab.dataset.tab);
        }
    },

    /**
     * Render Basic Settings Tab - FULLY FIXED
     */
    renderBasicTab() {
        const lang = LanguageManager || { t: (key) => key };
        
        return `
            <h3>${lang.t('pro.sections.windowsInstall')}</h3>
            <div class="grid grid-3">
                <div class="card">
                    <div class="card-title">${lang.t('pro.sections.windowsInstall')}</div>
                    <div class="form-group">
                        <label class="form-label" for="pro-windowsVersion">${lang.t('fields.windowsVersion')}</label>
                        <select class="form-control" id="pro-windowsVersion" name="windowsVersion">
                            ${this.getWindowsVersionOptions()}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="pro-architecture">${lang.t('fields.architecture')}</label>
                        <select class="form-control" id="pro-architecture" name="architecture">
                            <option value="amd64">${lang.t('options.architectures.amd64')}</option>
                            <option value="arm64">${lang.t('options.architectures.arm64')}</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="pro-imageIndex">${lang.t('fields.imageIndex')}</label>
                        <input type="number" class="form-control" id="pro-imageIndex" name="imageIndex" value="1" min="1">
                        <div class="form-hint">${lang.t('hints.imageIndex')}</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="pro-productKey">${lang.t('fields.productKey')}</label>
                        <input type="text" class="form-control" id="pro-productKey" name="productKey" placeholder="${lang.t('placeholders.productKey')}">
                    </div>
                    <div class="form-group">
                        <label for="pro-skipProductKey"><input type="checkbox" id="pro-skipProductKey" name="skipProductKey"> ${lang.t('fields.skipProductKey')}</label>
                    </div>
                    <div class="form-group">
                        <label for="pro-acceptEula"><input type="checkbox" id="pro-acceptEula" name="acceptEula" checked> ${lang.t('fields.acceptEula')}</label>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-title">${lang.t('pro.sections.systemIdentification')}</div>
                    <div class="form-group">
                        <label class="form-label" for="pro-nameStrategy">${lang.t('fields.computerNameStrategy')}</label>
                        <select class="form-control" id="pro-nameStrategy" name="nameStrategy">
                            ${this.getComputerNameStrategyOptions()}
                        </select>
                    </div>
                    <div id="pro-computerNameOptions">
                        <div class="form-group">
                            <label class="form-label" for="pro-computerName">${lang.t('fields.computerName')}</label>
                            <input type="text" class="form-control" id="pro-computerName" name="computerName" placeholder="${lang.t('placeholders.computerName')}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="pro-organization">${lang.t('fields.organization')}</label>
                        <input type="text" class="form-control" id="pro-organization" name="organization" placeholder="${lang.t('placeholders.organization')}" autocomplete="organization">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="pro-owner">${lang.t('fields.owner')}</label>
                        <input type="text" class="form-control" id="pro-owner" name="owner" placeholder="${lang.t('placeholders.owner')}">
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-title">${lang.t('pro.sections.regionalSettings')}</div>
                    <div class="form-group">
                        <label class="form-label" for="pro-timezone">${lang.t('fields.timezone')}</label>
                        <select class="form-control" id="pro-timezone" name="timezone">
                            ${this.getTimezoneOptions()}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="pro-uilanguage">${lang.t('fields.uiLanguage')}</label>
                        <input type="text" class="form-control" id="pro-uilanguage" name="uilanguage" value="de-DE">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="pro-systemlocale">${lang.t('fields.systemLocale')}</label>
                        <input type="text" class="form-control" id="pro-systemlocale" name="systemlocale" value="de-DE">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="pro-userlocale">${lang.t('fields.userLocale')}</label>
                        <input type="text" class="form-control" id="pro-userlocale" name="userlocale" value="de-DE">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="pro-inputlocale">${lang.t('fields.inputLocale')}</label>
                        <input type="text" class="form-control" id="pro-inputlocale" name="inputlocale" value="0407:00000407">
                        <div class="form-hint">${lang.t('hints.formatLocale')}</div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render Disk Tab - FULLY FIXED
     */
    renderDiskTab() {
        const lang = LanguageManager || { t: (key) => key };
        const config = ConfigManager.getConfig();
        const partitionId = this.generateUniqueId('partition');
        
        return `
            <h3>${lang.t('pro.sections.diskConfig')}</h3>
            <div class="grid grid-2">
                <div class="card">
                    <div class="card-title">${lang.t('pro.sections.partitionMode')}</div>
                    <div class="form-group">
                        <label class="form-label" for="pro-diskMode">${lang.t('fields.diskMode')}</label>
                        <select class="form-control" id="pro-diskMode" name="diskMode">
                            <option value="auto">${lang.t('options.diskModes.auto')}</option>
                            <option value="manual">${lang.t('options.diskModes.manual')}</option>
                            <option value="preserve">${lang.t('options.diskModes.preserve')}</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="pro-targetDisk">${lang.t('fields.targetDisk')}</label>
                        <input type="number" class="form-control" id="pro-targetDisk" name="targetDisk" value="0" min="0">
                    </div>
                    <div class="form-group">
                        <label for="pro-cleanDisk">
                            <input type="checkbox" id="pro-cleanDisk" name="cleanDisk" checked> ${lang.t('fields.cleanDisk')}
                        </label>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-title">${lang.t('pro.sections.diskSelection')}</div>
                    <div class="form-group">
                        <label class="form-label" for="pro-bootMode">${lang.t('fields.bootMode')}</label>
                        <select class="form-control" id="pro-bootMode" name="bootMode">
                            <option value="uefi">${lang.t('options.bootModes.uefi')}</option>
                            <option value="bios">${lang.t('options.bootModes.bios')}</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="pro-partitionStyle">${lang.t('fields.partitionStyle')}</label>
                        <select class="form-control" id="pro-partitionStyle" name="partitionStyle">
                            <option value="gpt">${lang.t('options.partitionStyles.gpt')}</option>
                            <option value="mbr">${lang.t('options.partitionStyles.mbr')}</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <div class="card-title">${lang.t('pro.sections.partitions')}</div>
                <button class="btn btn-secondary" id="pro-addPartitionBtn">➕ ${lang.t('buttons.addPartition')}</button>
                <div id="pro-partitionList" style="margin-top: 15px;">
                    <!-- Default UEFI partitions with proper IDs -->
                    <div class="partition-item">
                        <div class="grid grid-3">
                            <div class="form-group">
                                <label class="form-label" for="${partitionId}-type">${lang.t('fields.type')}</label>
                                <select class="form-control" id="${partitionId}-type" name="partition-type" data-field="type">
                                    <option value="efi">${lang.t('options.partitionTypes.efi')}</option>
                                    <option value="msr">${lang.t('options.partitionTypes.msr')}</option>
                                    <option value="primary" selected>${lang.t('options.partitionTypes.primary')}</option>
                                    <option value="recovery">${lang.t('options.partitionTypes.recovery')}</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="${partitionId}-size">${lang.t('fields.size')} (MB)</label>
                                <input type="number" class="form-control" id="${partitionId}-size" name="partition-size" data-field="size" value="500" placeholder="${lang.t('placeholders.sizeHint')}">
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="${partitionId}-filesystem">${lang.t('fields.filesystem')}</label>
                                <select class="form-control" id="${partitionId}-filesystem" name="partition-filesystem" data-field="filesystem">
                                    <option value="fat32">${lang.t('options.filesystems.fat32')}</option>
                                    <option value="ntfs" selected>${lang.t('options.filesystems.ntfs')}</option>
                                    <option value="refs">${lang.t('options.filesystems.refs')}</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="${partitionId}-label">${lang.t('fields.label')}</label>
                                <input type="text" class="form-control" id="${partitionId}-label" name="partition-label" data-field="label" value="EFI" placeholder="${lang.t('placeholders.label')}">
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="${partitionId}-letter">${lang.t('fields.driveLetter')}</label>
                                <input type="text" class="form-control" id="${partitionId}-letter" name="partition-letter" data-field="letter" maxlength="1" placeholder="${lang.t('placeholders.driveLetter')}">
                            </div>
                            <div class="form-group">
                                <button class="remove-btn">❌ ${lang.t('buttons.remove')}</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render Users Tab - FULLY FIXED  
     */
    renderUsersTab() {
        const lang = LanguageManager || { t: (key) => key };
        const userId = this.generateUniqueId('user-default');
        
        return `
            <h3>${lang.t('pro.sections.adminAccount')}</h3>
            <div class="grid grid-2">
                <div class="card">
                    <div class="card-title">${lang.t('pro.sections.adminAccount')}</div>
                    <div class="form-group">
                        <label class="form-label" for="pro-adminUser">${lang.t('fields.username')}</label>
                        <input type="text" class="form-control" id="pro-adminUser" name="adminUser" value="${lang.t('defaults.administratorName')}">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="pro-adminPassword">${lang.t('fields.password')}</label>
                        <input type="password" class="form-control" id="pro-adminPassword" name="adminPassword" placeholder="${lang.t('placeholders.password')}">
                        <div class="form-hint">${lang.t('hints.passwordEmpty')}</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="pro-adminPasswordConfirm">${lang.t('fields.confirmPassword')}</label>
                        <input type="password" class="form-control" id="pro-adminPasswordConfirm" name="adminPasswordConfirm" placeholder="${lang.t('placeholders.password')}">
                    </div>
                    <div class="form-group">
                        <label for="pro-enableAdminAccount">
                            <input type="checkbox" id="pro-enableAdminAccount" name="enableAdminAccount" checked> ${lang.t('fields.enableBuiltinAdmin')}
                        </label>
                    </div>
                    <div class="form-group">
                        <label for="pro-autoLogon">
                            <input type="checkbox" id="pro-autoLogon" name="autoLogon"> ${lang.t('fields.enableAutoLogon')}
                        </label>
                    </div>
                    <div class="form-group" id="pro-autoLogonCount" style="display:none;">
                        <label class="form-label" for="pro-autoLogonCountInput">${lang.t('fields.autoLogonCount')}</label>
                        <input type="number" class="form-control" id="pro-autoLogonCountInput" name="autoLogonCount" value="0" min="0">
                        <div class="form-hint">${lang.t('hints.autoLogonZero')}</div>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-title">${lang.t('pro.sections.passwordPolicies')}</div>
                    <div class="form-group">
                        <label for="pro-passwordComplexity">
                            <input type="checkbox" id="pro-passwordComplexity" name="passwordComplexity" checked> ${lang.t('fields.enforcePasswordComplexity')}
                        </label>
                    </div>
                    <div class="form-group">
                        <label for="pro-passwordExpires">
                            <input type="checkbox" id="pro-passwordExpires" name="passwordExpires"> ${lang.t('fields.passwordExpires')}
                        </label>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="pro-maxPasswordAge">${lang.t('fields.maxPasswordAge')}</label>
                        <input type="number" class="form-control" id="pro-maxPasswordAge" name="maxPasswordAge" value="42" min="0">
                    </div>
                    <div class="form-group">
                        <label for="pro-disablePasswordChange">
                            <input type="checkbox" id="pro-disablePasswordChange" name="disablePasswordChange"> ${lang.t('fields.disablePasswordChange')}
                        </label>
                    </div>
                    <div class="form-group">
                        <label for="pro-passwordNeverExpires">
                            <input type="checkbox" id="pro-passwordNeverExpires" name="passwordNeverExpires" checked> ${lang.t('fields.passwordNeverExpires')}
                        </label>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <div class="card-title">${lang.t('pro.sections.additionalUsers')}</div>
                <button class="btn btn-secondary" id="pro-addUserBtn">➕ ${lang.t('buttons.addUser')}</button>
                <div id="pro-userList" style="margin-top: 15px;">
                    <div class="user-item">
                        <div class="grid grid-3">
                            <div class="form-group">
                                <label class="form-label" for="${userId}-username">${lang.t('fields.username')}</label>
                                <input type="text" class="form-control" id="${userId}-username" name="user-username" data-field="username" placeholder="${lang.t('placeholders.username')}">
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="${userId}-password">${lang.t('fields.password')}</label>
                                <input type="password" class="form-control" id="${userId}-password" name="user-password" data-field="password" placeholder="${lang.t('placeholders.password')}">
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="${userId}-fullname">${lang.t('fields.fullName')}</label>
                                <input type="text" class="form-control" id="${userId}-fullname" name="user-fullname" data-field="fullname" placeholder="${lang.t('placeholders.fullname')}">
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="${userId}-description">${lang.t('fields.description')}</label>
                                <input type="text" class="form-control" id="${userId}-description" name="user-description" data-field="description" placeholder="${lang.t('placeholders.description')}">
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="${userId}-group">${lang.t('fields.group')}</label>
                                <select class="form-control" id="${userId}-group" name="user-group" data-field="group">
                                    <option value="users">${lang.t('options.userGroups.users')}</option>
                                    <option value="administrators">${lang.t('options.userGroups.administrators')}</option>
                                    <option value="powerusers">${lang.t('options.userGroups.powerusers')}</option>
                                    <option value="remotedesktop">${lang.t('options.userGroups.remotedesktop')}</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <button class="remove-btn">❌ ${lang.t('buttons.remove')}</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render Network Tab - FULLY FIXED
     */
    renderNetworkTab() {
        const lang = LanguageManager || { t: (key) => key };
        
        return `
            <h3>${lang.t('pro.sections.ipConfiguration')}</h3>
            <div class="grid grid-2">
                <div class="card">
                    <div class="card-title">${lang.t('pro.sections.ipConfiguration')}</div>
                    <div class="form-group">
                        <label class="form-label" for="pro-networkMode">${lang.t('fields.configMode')}</label>
                        <select class="form-control" id="pro-networkMode" name="networkMode">
                            <option value="dhcp">${lang.t('options.networkConfigs.dhcp')}</option>
                            <option value="static">${lang.t('options.networkConfigs.static')}</option>
                            <option value="alternate">${lang.t('options.networkConfigs.alternate')}</option>
                        </select>
                    </div>
                    <div id="pro-staticConfig" style="display:none;">
                        <div class="form-group">
                            <label class="form-label" for="pro-ipAddress">${lang.t('fields.ipAddress')}</label>
                            <input type="text" class="form-control" id="pro-ipAddress" name="ipAddress" placeholder="${lang.t('placeholders.ipAddress')}">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="pro-subnetMask">${lang.t('fields.subnetMask')}</label>
                            <input type="text" class="form-control" id="pro-subnetMask" name="subnetMask" placeholder="${lang.t('placeholders.subnetMask')}">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="pro-gateway">${lang.t('fields.gateway')}</label>
                            <input type="text" class="form-control" id="pro-gateway" name="gateway" placeholder="${lang.t('placeholders.gateway')}">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="pro-primaryDns">${lang.t('fields.primaryDns')}</label>
                            <input type="text" class="form-control" id="pro-primaryDns" name="primaryDns" placeholder="${lang.t('placeholders.dnsServer')}">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="pro-secondaryDns">${lang.t('fields.secondaryDns')}</label>
                            <input type="text" class="form-control" id="pro-secondaryDns" name="secondaryDns" placeholder="${lang.t('placeholders.secondaryDns')}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="pro-computerDescription">${lang.t('fields.computerDescription')}</label>
                        <input type="text" class="form-control" id="pro-computerDescription" name="computerDescription">
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-title">${lang.t('pro.sections.advancedNetwork')}</div>
                    <div class="form-group">
                        <label for="pro-enableIPv6">
                            <input type="checkbox" id="pro-enableIPv6" name="enableIPv6" checked> ${lang.t('fields.enableIPv6')}
                        </label>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="pro-netbios">${lang.t('fields.enableNetBIOS')}</label>
                        <select class="form-control" id="pro-netbios" name="netbios">
                            <option value="default">${lang.t('options.netbiosOptions.default')}</option>
                            <option value="enable">${lang.t('options.netbiosOptions.enable')}</option>
                            <option value="disable">${lang.t('options.netbiosOptions.disable')}</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="pro-enableWINS">
                            <input type="checkbox" id="pro-enableWINS" name="enableWINS"> ${lang.t('fields.enableWINS')}
                        </label>
                    </div>
                    <div id="pro-winsConfig" style="display:none;">
                        <div class="form-group">
                            <label class="form-label" for="pro-primaryWINS">${lang.t('fields.primaryWINS')}</label>
                            <input type="text" class="form-control" id="pro-primaryWINS" name="primaryWINS">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="pro-secondaryWINS">${lang.t('fields.secondaryWINS')}</label>
                            <input type="text" class="form-control" id="pro-secondaryWINS" name="secondaryWINS">
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <div class="card-title">${lang.t('pro.sections.firewallSecurity')}</div>
                <div class="grid grid-2">
                    <div class="form-group">
                        <label for="pro-enableFirewall">
                            <input type="checkbox" id="pro-enableFirewall" name="enableFirewall" checked> ${lang.t('fields.enableFirewall')}
                        </label>
                    </div>
                    <div class="form-group">
                        <label for="pro-enableRDP">
                            <input type="checkbox" id="pro-enableRDP" name="enableRDP" checked> ${lang.t('fields.enableRDP')}
                        </label>
                    </div>
                    <div class="form-group">
                        <label for="pro-enablePing">
                            <input type="checkbox" id="pro-enablePing" name="enablePing"> ${lang.t('fields.enablePing')}
                        </label>
                    </div>
                    <div class="form-group">
                        <label for="pro-enableFileSharing">
                            <input type="checkbox" id="pro-enableFileSharing" name="enableFileSharing"> ${lang.t('fields.enableFileSharing')}
                        </label>
                    </div>
                    <div class="form-group">
                        <label for="pro-enableWMI">
                            <input type="checkbox" id="pro-enableWMI" name="enableWMI"> ${lang.t('fields.enableWMI')}
                        </label>
                    </div>
                    <div class="form-group">
                        <label for="pro-enablePSRemoting">
                            <input type="checkbox" id="pro-enablePSRemoting" name="enablePSRemoting"> ${lang.t('fields.enablePowerShellRemoting')}
                        </label>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render Software Tab - FULLY FIXED
     */
    renderSoftwareTab() {
        const lang = LanguageManager || { t: (key) => key };
        const softwareId = this.generateUniqueId('software-default');
        
        return `
            <h3>${lang.t('pro.sections.softwareInstallation')}</h3>
            <div class="grid grid-2">
                <div class="card">
                    <div class="card-title">${lang.t('pro.sections.updateBehavior')}</div>
                    <div class="form-group">
                        <label class="form-label" for="pro-updateMode">${lang.t('fields.updateMode')}</label>
                        <select class="form-control" id="pro-updateMode" name="updateMode">
                            <option value="auto">${lang.t('options.updateModes.auto')}</option>
                            <option value="download">${lang.t('options.updateModes.download')}</option>
                            <option value="notify">${lang.t('options.updateModes.notify')}</option>
                            <option value="disabled">${lang.t('options.updateModes.disabled')}</option>
                            <option value="wsus">${lang.t('options.updateModes.wsus')}</option>
                        </select>
                    </div>
                    <div id="pro-wsusConfig" style="display:none;">
                        <div class="form-group">
                            <label class="form-label" for="pro-wsusServer">${lang.t('fields.wsusServer')}</label>
                            <input type="text" class="form-control" id="pro-wsusServer" name="wsusServer" placeholder="${lang.t('placeholders.wsusServer')}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="pro-updateTime">${lang.t('fields.updateTime')}</label>
                        <input type="time" class="form-control" id="pro-updateTime" name="updateTime" value="03:00">
                    </div>
                    <div class="form-group">
                        <label for="pro-includeDrivers">
                            <input type="checkbox" id="pro-includeDrivers" name="includeDrivers" checked> ${lang.t('fields.includeDrivers')}
                        </label>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="pro-deferDays">${lang.t('fields.deferFeatureUpdates')}</label>
                        <input type="number" class="form-control" id="pro-deferDays" name="deferDays" value="0" min="0" max="365">
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-title">${lang.t('pro.sections.packageSources')}</div>
                    <div class="form-group">
                        <label class="form-label" for="pro-packagePath">${lang.t('fields.packageSourcePath')}</label>
                        <input type="text" class="form-control" id="pro-packagePath" name="packagePath" placeholder="${lang.t('placeholders.packagePath')}">
                    </div>
                    <div class="form-group">
                        <label for="pro-mapDrive">
                            <input type="checkbox" id="pro-mapDrive" name="mapDrive"> ${lang.t('fields.mapNetworkDrive')}
                        </label>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="pro-packageDrive">${lang.t('fields.packageDriveLetter')}</label>
                        <select class="form-control" id="pro-packageDrive" name="packageDrive">
                            <option value="S">S:</option>
                            <option value="T">T:</option>
                            <option value="U">U:</option>
                            <option value="V">V:</option>
                            <option value="W">W:</option>
                            <option value="X">X:</option>
                            <option value="Y">Y:</option>
                            <option value="Z">Z:</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <div class="card-title">${lang.t('pro.sections.softwareInstallation')}</div>
                <button class="btn btn-secondary" id="pro-addSoftwareBtn">➕ ${lang.t('buttons.addSoftware')}</button>
                <div class="form-hint" style="margin: 10px 0;">${lang.t('hints.softwareTypes')}</div>
                <div id="pro-softwareList" style="margin-top: 15px;">
                    <div class="software-item">
                        <div class="grid grid-2">
                            <div class="form-group">
                                <label class="form-label" for="${softwareId}-name">${lang.t('fields.softwareName')}</label>
                                <input type="text" class="form-control" id="${softwareId}-name" name="software-name" data-field="name" placeholder="${lang.t('placeholders.softwareName')}">
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="${softwareId}-path">${lang.t('fields.installPath')}</label>
                                <input type="text" class="form-control" id="${softwareId}-path" name="software-path" data-field="path" placeholder="${lang.t('placeholders.softwarePath')}">
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="${softwareId}-args">${lang.t('fields.arguments')}</label>
                                <input type="text" class="form-control" id="${softwareId}-args" name="software-args" data-field="arguments" placeholder="${lang.t('placeholders.arguments')}">
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="${softwareId}-order">${lang.t('fields.order')}</label>
                                <input type="number" class="form-control" id="${softwareId}-order" name="software-order" data-field="order" value="1" min="1">
                            </div>
                            <div class="form-group">
                                <button class="remove-btn">❌ ${lang.t('buttons.remove')}</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render Domain Tab - FULLY FIXED
     */
    renderDomainTab() {
        const lang = LanguageManager || { t: (key) => key };
        
        return `
            <h3>${lang.t('pro.sections.domainMembership')}</h3>
            <div class="grid grid-2">
                <div class="card">
                    <div class="card-title">${lang.t('pro.sections.domainMembership')}</div>
                    <div class="form-group">
                        <label class="form-label" for="pro-joinType">${lang.t('fields.joinType')}</label>
                        <select class="form-control" id="pro-joinType" name="joinType">
                            <option value="workgroup">${lang.t('options.joinTypes.workgroup')}</option>
                            <option value="domain">${lang.t('options.joinTypes.domain')}</option>
                        </select>
                    </div>
                    
                    <div id="pro-workgroupConfig">
                        <div class="form-group">
                            <label class="form-label" for="pro-workgroupName">${lang.t('fields.workgroupName')}</label>
                            <input type="text" class="form-control" id="pro-workgroupName" name="workgroupName" value="${lang.t('defaults.workgroupName')}">
                        </div>
                    </div>
                    
                    <div id="pro-domainConfig" style="display:none;">
                        <div class="form-group">
                            <label class="form-label" for="pro-domainName">${lang.t('fields.domainName')}</label>
                            <input type="text" class="form-control" id="pro-domainName" name="domainName" placeholder="${lang.t('placeholders.domainName')}">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="pro-domainController">${lang.t('fields.domainController')}</label>
                            <input type="text" class="form-control" id="pro-domainController" name="domainController" placeholder="${lang.t('placeholders.domainController')}">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="pro-domainUser">${lang.t('fields.domainUser')}</label>
                            <input type="text" class="form-control" id="pro-domainUser" name="domainUser" placeholder="${lang.t('placeholders.domainUser')}">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="pro-domainPassword">${lang.t('fields.domainPassword')}</label>
                            <input type="password" class="form-control" id="pro-domainPassword" name="domainPassword">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="pro-ouPath">${lang.t('fields.ouPath')}</label>
                            <input type="text" class="form-control" id="pro-ouPath" name="ouPath" placeholder="${lang.t('placeholders.ouPath')}">
                            <div class="form-hint">${lang.t('hints.ldapPath')}</div>
                        </div>
                        <div class="form-group">
                            <label for="pro-createAccount">
                                <input type="checkbox" id="pro-createAccount" name="createAccount" checked> ${lang.t('fields.createComputerAccount')}
                            </label>
                        </div>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-title">${lang.t('pro.sections.groupPolicies')}</div>
                    <div class="form-group">
                        <label for="pro-gpUpdate">
                            <input type="checkbox" id="pro-gpUpdate" name="gpUpdate" checked> ${lang.t('fields.gpUpdate')}
                        </label>
                    </div>
                    <div class="form-group">
                        <label for="pro-waitForNetwork">
                            <input type="checkbox" id="pro-waitForNetwork" name="waitForNetwork" checked> ${lang.t('fields.waitForNetwork')}
                        </label>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="pro-startupDelay">${lang.t('fields.startupDelay')}</label>
                        <input type="number" class="form-control" id="pro-startupDelay" name="startupDelay" value="0" min="0" max="300">
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render Features Tab - FULLY FIXED
     */
    renderFeaturesTab() {
        const lang = LanguageManager || { t: (key) => key };
        
        return `
            <h3>${lang.t('pro.sections.commonFeatures')}</h3>
            <div class="grid grid-2">
                <div class="card">
                    <div class="card-title">${lang.t('pro.sections.commonFeatures')}</div>
                    <div class="form-group">
                        <label for="pro-feat-netfx3"><input type="checkbox" id="pro-feat-netfx3" name="feat-netfx3"> ${lang.t('features.netFramework35')}</label>
                    </div>
                    <div class="form-group">
                        <label for="pro-feat-netfx48"><input type="checkbox" id="pro-feat-netfx48" name="feat-netfx48" checked> ${lang.t('features.netFramework48')}</label>
                    </div>
                    <div class="form-group">
                        <label for="pro-feat-hyperv"><input type="checkbox" id="pro-feat-hyperv" name="feat-hyperv"> ${lang.t('features.hyperV')}</label>
                    </div>
                    <div class="form-group">
                        <label for="pro-feat-wsl"><input type="checkbox" id="pro-feat-wsl" name="feat-wsl"> ${lang.t('features.wsl')}</label>
                    </div>
                    <div class="form-group">
                        <label for="pro-feat-sandbox"><input type="checkbox" id="pro-feat-sandbox" name="feat-sandbox"> ${lang.t('features.windowsSandbox')}</label>
                    </div>
                    <div class="form-group">
                        <label for="pro-feat-containers"><input type="checkbox" id="pro-feat-containers" name="feat-containers"> ${lang.t('features.windowsContainers')}</label>
                    </div>
                    <div class="form-group">
                        <label for="pro-feat-telnet"><input type="checkbox" id="pro-feat-telnet" name="feat-telnet"> ${lang.t('features.telnetClient')}</label>
                    </div>
                    <div class="form-group">
                        <label for="pro-feat-tftp"><input type="checkbox" id="pro-feat-tftp" name="feat-tftp"> ${lang.t('features.tftpClient')}</label>
                    </div>
                    <div class="form-group">
                        <label for="pro-feat-smb1"><input type="checkbox" id="pro-feat-smb1" name="feat-smb1"> ${lang.t('features.smb1')}</label>
                    </div>
                    <div class="form-group">
                        <label for="pro-feat-directplay"><input type="checkbox" id="pro-feat-directplay" name="feat-directplay"> ${lang.t('features.directPlay')}</label>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-title">${lang.t('pro.sections.serverRoles')}</div>
                    <div class="form-group">
                        <label for="pro-role-iis"><input type="checkbox" id="pro-role-iis" name="role-iis"> ${lang.t('features.iis')}</label>
                    </div>
                    <div id="pro-iisOptions" style="display:none; margin-left: 20px;">
                        <div class="form-group">
                            <label for="pro-iis-asp"><input type="checkbox" id="pro-iis-asp" name="iis-asp"> ${lang.t('features.aspNet')}</label>
                        </div>
                        <div class="form-group">
                            <label for="pro-iis-php"><input type="checkbox" id="pro-iis-php" name="iis-php"> ${lang.t('features.phpSupport')}</label>
                        </div>
                        <div class="form-group">
                            <label for="pro-iis-ftp"><input type="checkbox" id="pro-iis-ftp" name="iis-ftp"> ${lang.t('features.ftpServer')}</label>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="pro-role-dns"><input type="checkbox" id="pro-role-dns" name="role-dns"> ${lang.t('features.dnsServer')}</label>
                    </div>
                    <div class="form-group">
                        <label for="pro-role-dhcp"><input type="checkbox" id="pro-role-dhcp" name="role-dhcp"> ${lang.t('features.dhcpServer')}</label>
                    </div>
                    <div class="form-group">
                        <label for="pro-role-fileserver"><input type="checkbox" id="pro-role-fileserver" name="role-fileserver"> ${lang.t('features.fileServer')}</label>
                    </div>
                    <div class="form-group">
                        <label for="pro-role-printserver"><input type="checkbox" id="pro-role-printserver" name="role-printserver"> ${lang.t('features.printServer')}</label>
                    </div>
                    <div class="form-group">
                        <label for="pro-role-rds"><input type="checkbox" id="pro-role-rds" name="role-rds"> ${lang.t('features.remoteDesktopServices')}</label>
                    </div>
                    <div class="form-group">
                        <label for="pro-role-wds"><input type="checkbox" id="pro-role-wds" name="role-wds"> ${lang.t('features.deploymentServices')}</label>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <div class="card-title">${lang.t('pro.sections.optionalFeatures')}</div>
                <div class="form-group">
                    <label class="form-label" for="pro-customFeatures">${lang.t('fields.customFeatures')}</label>
                    <textarea class="form-control" id="pro-customFeatures" name="customFeatures" rows="4" placeholder="${lang.t('placeholders.customFeatures')}"></textarea>
                    <div class="form-hint">${lang.t('hints.oemPackages')}</div>
                </div>
            </div>
        `;
    },

    /**
     * Render OOBE Tab - FULLY FIXED
     */
    renderOOBETab() {
        const lang = LanguageManager || { t: (key) => key };
        
        return `
            <h3>${lang.t('pro.sections.oobeSkips')}</h3>
            <div class="grid grid-2">
                <div class="card">
                    <div class="card-title">${lang.t('pro.sections.oobeSkips')}</div>
                    <div class="form-group">
                        <label for="pro-skipEula"><input type="checkbox" id="pro-skipEula" name="skipEula" checked> ${lang.t('oobe.skipEula')}</label>
                    </div>
                    <div class="form-group">
                        <label for="pro-skipOEM"><input type="checkbox" id="pro-skipOEM" name="skipOEM" checked> ${lang.t('oobe.skipOemRegistration')}</label>
                    </div>
                    <div class="form-group">
                        <label for="pro-skipOnlineAccount"><input type="checkbox" id="pro-skipOnlineAccount" name="skipOnlineAccount" checked> ${lang.t('oobe.skipOnlineAccount')}</label>
                    </div>
                    <div class="form-group">
                        <label for="pro-skipLocalAccount"><input type="checkbox" id="pro-skipLocalAccount" name="skipLocalAccount" checked> ${lang.t('oobe.skipLocalAccount')}</label>
                    </div>
                    <div class="form-group">
                        <label for="pro-skipWireless"><input type="checkbox" id="pro-skipWireless" name="skipWireless" checked> ${lang.t('oobe.skipWirelessSetup')}</label>
                    </div>
                    <div class="form-group">
                        <label for="pro-skipPrivacy"><input type="checkbox" id="pro-skipPrivacy" name="skipPrivacy" checked> ${lang.t('oobe.skipPrivacySettings')}</label>
                    </div>
                    <div class="form-group">
                        <label for="pro-skipCortana"><input type="checkbox" id="pro-skipCortana" name="skipCortana" checked> ${lang.t('oobe.skipCortanaSetup')}</label>
                    </div>
                    <div class="form-group">
                        <label for="pro-skipExpressSettings"><input type="checkbox" id="pro-skipExpressSettings" name="skipExpressSettings"> ${lang.t('oobe.useExpressSettings')}</label>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-title">${lang.t('pro.sections.privacySettings')}</div>
                    <div class="form-group">
                        <label class="form-label" for="pro-telemetryLevel">${lang.t('fields.telemetryLevel')}</label>
                        <select class="form-control" id="pro-telemetryLevel" name="telemetryLevel">
                            <option value="0">${lang.t('options.telemetryLevels.0')}</option>
                            <option value="1">${lang.t('options.telemetryLevels.1')}</option>
                            <option value="2">${lang.t('options.telemetryLevels.2')}</option>
                            <option value="3">${lang.t('options.telemetryLevels.3')}</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="pro-disableLocation">
                            <input type="checkbox" id="pro-disableLocation" name="disableLocation" checked> ${lang.t('fields.disableLocation')}
                        </label>
                    </div>
                    <div class="form-group">
                        <label for="pro-disableAdvertising">
                            <input type="checkbox" id="pro-disableAdvertising" name="disableAdvertising" checked> ${lang.t('fields.disableAdvertising')}
                        </label>
                    </div>
                    <div class="form-group">
                        <label for="pro-disableCortana">
                            <input type="checkbox" id="pro-disableCortana" name="disableCortana" checked> ${lang.t('oobe.disableCortana')}
                        </label>
                    </div>
                    <div class="form-group">
                        <label for="pro-disableOneDrive">
                            <input type="checkbox" id="pro-disableOneDrive" name="disableOneDrive"> ${lang.t('oobe.disableOneDrive')}</label>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <div class="card-title">${lang.t('pro.sections.firstLogon')}</div>
                <div class="grid grid-2">
                    <div class="form-group">
                        <label class="form-label" for="pro-displayMode">${lang.t('fields.displayMode')}</label>
                        <select class="form-control" id="pro-displayMode" name="displayMode">
                            <option value="default">${lang.t('options.displayModes.default')}</option>
                            <option value="retail">${lang.t('options.displayModes.retail')}</option>
                            <option value="kiosk">${lang.t('options.displayModes.kiosk')}</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="pro-wallpaper">${lang.t('fields.wallpaper')}</label>
                        <input type="text" class="form-control" id="pro-wallpaper" name="wallpaper" placeholder="${lang.t('placeholders.wallpaperPath')}">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="pro-lockscreen">${lang.t('fields.lockscreen')}</label>
                        <input type="text" class="form-control" id="pro-lockscreen" name="lockscreen" placeholder="${lang.t('placeholders.lockscreenPath')}">
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render Scripts Tab - FULLY FIXED
     */
    renderScriptsTab() {
        const lang = LanguageManager || { t: (key) => key };
        const scriptId = this.generateUniqueId('script-default');
        
        return `
            <h3>${lang.t('pro.sections.scriptPhases')}</h3>
            
            <div class="info-box">
                <div class="info-box-title">📝 ${lang.t('scripts.executionPhases')}</div>
                <div class="info-box-content">${lang.t('hints.scriptPhases')}</div>
            </div>
            
            <div class="card">
                <div class="card-title">${lang.t('pro.sections.setupScripts')}</div>
                <button class="btn btn-secondary" id="pro-addScriptBtn">➕ ${lang.t('buttons.addScript')}</button>
                <div id="pro-scriptList" style="margin-top: 15px;">
                    <div class="script-item">
                        <div class="grid grid-2">
                            <div class="form-group">
                                <label class="form-label" for="${scriptId}-phase">${lang.t('fields.phase')}</label>
                                <select class="form-control" id="${scriptId}-phase" name="script-phase" data-field="phase">
                                    <option value="windowsPE">${lang.t('options.scriptPhases.windowsPE')}</option>
                                    <option value="specialize">${lang.t('options.scriptPhases.specialize')}</option>
                                    <option value="firstLogon" selected>${lang.t('options.scriptPhases.firstLogon')}</option>
                                    <option value="oobeSystem">${lang.t('options.scriptPhases.oobeSystem')}</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="${scriptId}-type">${lang.t('fields.scriptType')}</label>
                                <select class="form-control" id="${scriptId}-type" name="script-type" data-field="type">
                                    <option value="cmd">${lang.t('options.scriptTypes.cmd')}</option>
                                    <option value="powershell" selected>${lang.t('options.scriptTypes.powershell')}</option>
                                    <option value="vbs">${lang.t('options.scriptTypes.vbs')}</option>
                                    <option value="exe">${lang.t('options.scriptTypes.exe')}</option>
                                </select>
                            </div>
                            <div class="form-group" style="grid-column: span 2;">
                                <label class="form-label" for="${scriptId}-command">${lang.t('fields.commandPath')}</label>
                                <input type="text" class="form-control" id="${scriptId}-command" name="script-command" data-field="command" placeholder="${lang.t('placeholders.scriptCommand')}">
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="${scriptId}-order">${lang.t('fields.order')}</label>
                                <input type="number" class="form-control" id="${scriptId}-order" name="script-order" data-field="order" value="1" min="1">
                            </div>
                            <div class="form-group">
                                <label for="${scriptId}-async">
                                    <input type="checkbox" id="${scriptId}-async" name="script-async" data-field="async"> ${lang.t('fields.runAsync')}
                                </label>
                            </div>
                            <div class="form-group">
                                <button class="remove-btn">❌ ${lang.t('buttons.remove')}</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="grid grid-2">
                <div class="card">
                    <div class="card-title">${lang.t('pro.sections.powerShellConfig')}</div>
                    <div class="form-group">
                        <label class="form-label" for="pro-psExecutionPolicy">${lang.t('fields.executionPolicy')}</label>
                        <select class="form-control" id="pro-psExecutionPolicy" name="psExecutionPolicy">
                            <option value="restricted">${lang.t('options.executionPolicies.restricted')}</option>
                            <option value="allsigned">${lang.t('options.executionPolicies.allsigned')}</option>
                            <option value="remotesigned" selected>${lang.t('options.executionPolicies.remotesigned')}</option>
                            <option value="unrestricted">${lang.t('options.executionPolicies.unrestricted')}</option>
                            <option value="bypass">${lang.t('options.executionPolicies.bypass')}</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="pro-psRemoting">
                            <input type="checkbox" id="pro-psRemoting" name="psRemoting"> ${lang.t('fields.enableRemoting')}
                        </label>
                    </div>
                    <div class="form-group">
                        <label for="pro-psScriptLogging">
                            <input type="checkbox" id="pro-psScriptLogging" name="psScriptLogging"> ${lang.t('fields.enableScriptLogging')}
                        </label>
                    </div>
                    <div class="form-group">
                        <label for="pro-psUpdateHelp">
                            <input type="checkbox" id="pro-psUpdateHelp" name="psUpdateHelp"> ${lang.t('fields.updateHelp')}
                        </label>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-title">${lang.t('pro.sections.scheduledTasks')}</div>
                    <button class="btn btn-secondary" id="pro-addTaskBtn">➕ ${lang.t('buttons.addTask')}</button>
                    <div id="pro-taskList" style="margin-top: 15px;">
                        <!-- Tasks will be added here -->
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render Drivers Tab - FULLY FIXED
     */
    renderDriversTab() {
        const lang = LanguageManager || { t: (key) => key };
        
        return `
            <h3>${lang.t('pro.sections.driverSources')}</h3>
            
            <div class="info-box">
                <div class="info-box-title">🚗 ${lang.t('drivers.management')}</div>
                <div class="info-box-content">${lang.t('hints.modelDetection')}</div>
            </div>
            
            <div class="grid grid-2">
                <div class="card">
                    <div class="card-title">${lang.t('pro.sections.driverSources')}</div>
                    <div class="form-group">
                        <label class="form-label" for="pro-driverPath">${lang.t('fields.driverPath')}</label>
                        <input type="text" class="form-control" id="pro-driverPath" name="driverPath" placeholder="${lang.t('placeholders.driverPath')}">
                        <div class="form-hint">${lang.t('hints.dynamicPaths')}</div>
                    </div>
                    <div class="form-group">
                        <label for="pro-driverSubdirs">
                            <input type="checkbox" id="pro-driverSubdirs" name="driverSubdirs" checked> ${lang.t('fields.includeSubdirs')}
                        </label>
                    </div>
                    <div class="form-group">
                        <label for="pro-allowUnsigned">
                            <input type="checkbox" id="pro-allowUnsigned" name="allowUnsigned"> ${lang.t('fields.allowUnsigned')}
                        </label>
                    </div>
                    <div class="form-group">
                        <label for="pro-forceUnsigned">
                            <input type="checkbox" id="pro-forceUnsigned" name="forceUnsigned"> ${lang.t('fields.forceUnsigned')}
                        </label>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-title">${lang.t('pro.sections.pnpDrivers')}</div>
                    <div class="form-group">
                        <label for="pro-updatePnP">
                            <input type="checkbox" id="pro-updatePnP" name="updatePnP" checked> ${lang.t('fields.updatePnP')}
                        </label>
                    </div>
                    <div class="form-group">
                        <label for="pro-searchWindowsUpdate">
                            <input type="checkbox" id="pro-searchWindowsUpdate" name="searchWindowsUpdate"> ${lang.t('fields.searchWindowsUpdate')}
                        </label>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="pro-excludeDevices">${lang.t('fields.excludedDeviceIds')}</label>
                        <textarea class="form-control" id="pro-excludeDevices" name="excludeDevices" rows="3" placeholder="${lang.t('placeholders.excludeDevice')}"></textarea>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <div class="card-title">${lang.t('pro.sections.criticalDrivers')}</div>
                <button class="btn btn-secondary" id="pro-addDriverBtn">➕ ${lang.t('buttons.addDriver')}</button>
                <div id="pro-driverList" style="margin-top: 15px;">
                    <!-- Critical drivers will be listed here -->
                </div>
            </div>
            
            <div class="card">
                <div class="card-title">${lang.t('pro.sections.deviceSpecific')}</div>
                <div class="form-group">
                    <label for="pro-autoModelDetection">
                        <input type="checkbox" id="pro-autoModelDetection" name="autoModelDetection" checked> ${lang.t('fields.autoModelDetection')}
                        </label>
                </div>
                <div class="form-group">
                    <label class="form-label" for="pro-modelMapping">${lang.t('fields.modelMapping')}</label>
                    <textarea class="form-control" id="pro-modelMapping" name="modelMapping" rows="6">${lang.t('defaults.modelMapping')}</textarea>
                </div>
            </div>
        `;
    },

    /**
     * Render Preview Tab
     */
    renderPreviewTab() {
        const lang = LanguageManager || { t: (key) => key };
        return `
            <h3>${lang.t('pro.sections.xmlPreview')}</h3>
            <div class="card">
                <div class="card-title">${lang.t('modals.xmlPreview.title')}</div>
                <div class="xml-preview" id="pro-xmlPreview" style="height: 500px; overflow-y: auto;">
                    <div style="color: #999; text-align: center; padding: 50px;">
                        ${lang.t('preview.clickValidate')}
                    </div>
                </div>
                <div class="btn-group" style="margin-top: 15px;">
                    <button class="btn btn-secondary" id="validateProBtn">${lang.t('buttons.validate')}</button>
                    <button class="btn btn-secondary" id="copyProXMLBtn">${lang.t('buttons.copy')}</button>
                    <button class="btn btn-primary" id="downloadProXMLBtn">${lang.t('buttons.download')}</button>
                </div>
            </div>
        `;
    },

    // Helper methods remain the same
    getWindowsVersionOptions() {
        const lang = LanguageManager || { t: (key) => key };
        const versions = lang.t('options.windowsVersions');
        
        if (typeof versions === 'object') {
            return Object.entries(versions)
                .map(([value, text]) => `<option value="${value}">${text}</option>`)
                .join('');
        }
        
        return `
            <option value="win11pro">Windows 11 Pro</option>
            <option value="win11enterprise">Windows 11 Enterprise</option>
        `;
    },

    getComputerNameStrategyOptions() {
        const lang = LanguageManager || { t: (key) => key };
        const strategies = lang.t('options.computerNameStrategies');
        
        if (typeof strategies === 'object') {
            return Object.entries(strategies)
                .map(([value, text]) => `<option value="${value}">${text}</option>`)
                .join('');
        }
        
        return `<option value="fixed">Fixed Name</option>`;
    },

    getTimezoneOptions() {
        const lang = LanguageManager || { t: (key) => key };
        const timezones = lang.t('options.timezones');
        
        if (typeof timezones === 'object') {
            return Object.entries(timezones)
                .map(([value, text]) => `<option value="${value}">${text}</option>`)
                .join('');
        }
        
        return `
            <option value="W. Europe Standard Time">Western Europe (Berlin)</option>
            <option value="Central European Standard Time">Central Europe</option>
            <option value="GMT Standard Time">GMT (London)</option>
            <option value="Eastern Standard Time">Eastern Time (USA)</option>
        `;
    },

    /**
     * Attach event listeners for specific tab
     */
    attachTabEventListeners(tab) {
        const lang = LanguageManager || { t: (key) => key };
        
        switch(tab) {
            case 'basic':
                const nameStrategy = document.getElementById('pro-nameStrategy');
                if (nameStrategy) {
                    nameStrategy.addEventListener('change', () => this.updateProComputerName());
                }
                break;
            
            case 'disk':
                const diskMode = document.getElementById('pro-diskMode');
                if (diskMode) {
                    diskMode.addEventListener('change', (e) => {
                        const partitionList = document.getElementById('pro-partitionList');
                        if (partitionList) {
                            partitionList.style.display = e.target.value === 'manual' ? 'block' : 'none';
                        }
                    });
                }
                
                const addPartitionBtn = document.getElementById('pro-addPartitionBtn');
                if (addPartitionBtn) {
                    addPartitionBtn.addEventListener('click', () => this.addPartition());
                }
                break;
                
            case 'users':
                const autoLogon = document.getElementById('pro-autoLogon');
                if (autoLogon) {
                    autoLogon.addEventListener('change', (e) => {
                        const logonCount = document.getElementById('pro-autoLogonCount');
                        if (logonCount) {
                            logonCount.style.display = e.target.checked ? 'block' : 'none';
                        }
                    });
                }
                
                const addUserBtn = document.getElementById('pro-addUserBtn');
                if (addUserBtn) {
                    addUserBtn.addEventListener('click', () => this.addUser());
                }
                break;
                
            case 'network':
                const networkMode = document.getElementById('pro-networkMode');
                if (networkMode) {
                    networkMode.addEventListener('change', (e) => {
                        const staticConfig = document.getElementById('pro-staticConfig');
                        if (staticConfig) {
                            staticConfig.style.display = e.target.value === 'static' ? 'block' : 'none';
                        }
                    });
                }
                
                const enableWINS = document.getElementById('pro-enableWINS');
                if (enableWINS) {
                    enableWINS.addEventListener('change', (e) => {
                        const winsConfig = document.getElementById('pro-winsConfig');
                        if (winsConfig) {
                            winsConfig.style.display = e.target.checked ? 'block' : 'none';
                        }
                    });
                }
                break;
                
            case 'software':
                const updateMode = document.getElementById('pro-updateMode');
                if (updateMode) {
                    updateMode.addEventListener('change', (e) => {
                        const wsusConfig = document.getElementById('pro-wsusConfig');
                        if (wsusConfig) {
                            wsusConfig.style.display = e.target.value === 'wsus' ? 'block' : 'none';
                        }
                    });
                }
                
                const addSoftwareBtn = document.getElementById('pro-addSoftwareBtn');
                if (addSoftwareBtn) {
                    addSoftwareBtn.addEventListener('click', () => this.addSoftware());
                }
                break;
                
            case 'domain':
                const joinType = document.getElementById('pro-joinType');
                if (joinType) {
                    joinType.addEventListener('change', (e) => {
                        const workgroupConfig = document.getElementById('pro-workgroupConfig');
                        const domainConfig = document.getElementById('pro-domainConfig');

                        if (workgroupConfig) workgroupConfig.style.display = e.target.value === 'workgroup' ? 'block' : 'none';
                        if (domainConfig) domainConfig.style.display = e.target.value === 'domain' ? 'block' : 'none';
                    });
                }
                break;
                
            case 'features':
                const iisCheckbox = document.getElementById('pro-role-iis');
                if (iisCheckbox) {
                    iisCheckbox.addEventListener('change', (e) => {
                        const iisOptions = document.getElementById('pro-iisOptions');
                        if (iisOptions) {
                            iisOptions.style.display = e.target.checked ? 'block' : 'none';
                        }
                    });
                }
                break;
                
            case 'scripts':
                const addScriptBtn = document.getElementById('pro-addScriptBtn');
                if (addScriptBtn) {
                    addScriptBtn.addEventListener('click', () => this.addScript());
                }
                
                const addTaskBtn = document.getElementById('pro-addTaskBtn');
                if (addTaskBtn) {
                    addTaskBtn.addEventListener('click', () => this.addTask());
                }
                break;
                
            case 'drivers':
                const addDriverBtn = document.getElementById('pro-addDriverBtn');
                if (addDriverBtn) {
                    addDriverBtn.addEventListener('click', () => this.addDriver());
                }
                break;
            
            case 'preview':
                const validateBtn = document.getElementById('validateProBtn');
                if (validateBtn) {
                    validateBtn.addEventListener('click', () => {
                        if (window.XMLGenerator) {
                            window.XMLGenerator.validateConfig();
                        }
                    });
                }
                
                const copyBtn = document.getElementById('copyProXMLBtn');
                if (copyBtn) {
                    copyBtn.addEventListener('click', () => {
                        if (window.XMLGenerator) {
                            window.XMLGenerator.copyXML();
                        }
                    });
                }
                
                const downloadBtn = document.getElementById('downloadProXMLBtn');
                if (downloadBtn) {
                    downloadBtn.addEventListener('click', () => {
                        if (window.XMLGenerator) {
                            window.XMLGenerator.exportXML();
                        }
                    });
                }
                break;
        }
        
        // Attach remove button listeners
        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.partition-item, .user-item, .software-item, .script-item, .driver-item, .task-item')?.remove();
            });
        });
    },

    /**
     * Update computer name options in Pro mode
     */
    updateProComputerName() {
        const lang = LanguageManager || { t: (key) => key };
        const strategy = document.getElementById('pro-nameStrategy').value;
        const optionsDiv = document.getElementById('pro-computerNameOptions');
        
        if (strategy === 'wmi-custom') {
            optionsDiv.innerHTML = `
                <div class="form-group">
                    <label class="form-label" for="pro-wmiQuery">${lang.t('fields.wmiQuery')}</label>
                    <textarea class="form-control" id="pro-wmiQuery" name="wmiQuery" rows="3">${lang.t('defaults.wmiQuery')}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label" for="pro-computerNamePrefix">${lang.t('fields.prefix')}</label>
                    <input type="text" class="form-control" id="pro-computerNamePrefix" name="computerNamePrefix" placeholder="${lang.t('placeholders.wmiPrefix')}">
                </div>
            `;
        } else if (strategy === 'random' || strategy === 'serial' || strategy === 'mac') {
            optionsDiv.innerHTML = `
                <div class="form-group">
                    <label class="form-label" for="pro-computerNamePrefix">${lang.t('fields.prefix')}</label>
                    <input type="text" class="form-control" id="pro-computerNamePrefix" name="computerNamePrefix" placeholder="${lang.t('placeholders.prefix')}">
                </div>
            `;
        } else {
            optionsDiv.innerHTML = `
                <div class="form-group">
                    <label class="form-label" for="pro-computerName">${lang.t('fields.computerName')}</label>
                    <input type="text" class="form-control" id="pro-computerName" name="computerName" placeholder="${lang.t('placeholders.computerName')}">
                </div>
            `;
        }
        
        ConfigManager.updateConfig('computerNameStrategy', strategy);
    },
    
    /**
     * Add partition to list - FULLY FIXED
     */
    addPartition() {
        const lang = LanguageManager || { t: (key) => key };
        const partitionList = document.getElementById('pro-partitionList');
        const partitionDiv = document.createElement('div');
        partitionDiv.className = 'partition-item';
        const uniqueId = this.generateUniqueId('partition');
        
        partitionDiv.innerHTML = `
            <div class="grid grid-3">
                <div class="form-group">
                    <label class="form-label" for="${uniqueId}-type">${lang.t('fields.type')}</label>
                    <select class="form-control" id="${uniqueId}-type" name="partition-type" data-field="type">
                        <option value="primary">${lang.t('options.partitionTypes.primary')}</option>
                        <option value="efi">${lang.t('options.partitionTypes.efi')}</option>
                        <option value="msr">${lang.t('options.partitionTypes.msr')}</option>
                        <option value="recovery">${lang.t('options.partitionTypes.recovery')}</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label" for="${uniqueId}-size">${lang.t('fields.size')} (MB)</label>
                    <input type="number" class="form-control" id="${uniqueId}-size" name="partition-size" data-field="size" placeholder="${lang.t('placeholders.sizeHint')}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="${uniqueId}-filesystem">${lang.t('fields.filesystem')}</label>
                    <select class="form-control" id="${uniqueId}-filesystem" name="partition-filesystem" data-field="filesystem">
                        <option value="ntfs">${lang.t('options.filesystems.ntfs')}</option>
                        <option value="fat32">${lang.t('options.filesystems.fat32')}</option>
                        <option value="refs">${lang.t('options.filesystems.refs')}</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label" for="${uniqueId}-label">${lang.t('fields.label')}</label>
                    <input type="text" class="form-control" id="${uniqueId}-label" name="partition-label" data-field="label" placeholder="${lang.t('placeholders.label')}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="${uniqueId}-letter">${lang.t('fields.driveLetter')}</label>
                    <input type="text" class="form-control" id="${uniqueId}-letter" name="partition-letter" data-field="letter" maxlength="1" placeholder="${lang.t('placeholders.driveLetter')}">
                </div>
                <div class="form-group">
                    <button class="remove-btn">❌ ${lang.t('buttons.remove')}</button>
                </div>
            </div>
        `;
        partitionList.appendChild(partitionDiv);
        
        // Attach remove listener
        partitionDiv.querySelector('.remove-btn').addEventListener('click', () => partitionDiv.remove());
    },
    
    /**
     * Add user to list - FULLY FIXED  
     */
    addUser() {
        const lang = LanguageManager || { t: (key) => key };
        const userList = document.getElementById('pro-userList');
        const userDiv = document.createElement('div');
        userDiv.className = 'user-item';
        const uniqueId = this.generateUniqueId('user');
        
        userDiv.innerHTML = `
            <div class="grid grid-3">
                <div class="form-group">
                    <label class="form-label" for="${uniqueId}-username">${lang.t('fields.username')}</label>
                    <input type="text" class="form-control" id="${uniqueId}-username" name="user-username" data-field="username" placeholder="${lang.t('placeholders.username')}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="${uniqueId}-password">${lang.t('fields.password')}</label>
                    <input type="password" class="form-control" id="${uniqueId}-password" name="user-password" data-field="password" placeholder="${lang.t('placeholders.password')}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="${uniqueId}-fullname">${lang.t('fields.fullName')}</label>
                    <input type="text" class="form-control" id="${uniqueId}-fullname" name="user-fullname" data-field="fullname" placeholder="${lang.t('placeholders.fullname')}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="${uniqueId}-description">${lang.t('fields.description')}</label>
                    <input type="text" class="form-control" id="${uniqueId}-description" name="user-description" data-field="description" placeholder="${lang.t('placeholders.description')}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="${uniqueId}-group">${lang.t('fields.group')}</label>
                    <select class="form-control" id="${uniqueId}-group" name="user-group" data-field="group">
                        <option value="users">${lang.t('options.userGroups.users')}</option>
                        <option value="administrators">${lang.t('options.userGroups.administrators')}</option>
                        <option value="powerusers">${lang.t('options.userGroups.powerusers')}</option>
                        <option value="remotedesktop">${lang.t('options.userGroups.remotedesktop')}</option>
                    </select>
                </div>
                <div class="form-group">
                    <button class="remove-btn">❌ ${lang.t('buttons.remove')}</button>
                </div>
            </div>
        `;
        userList.appendChild(userDiv);
        
        // Attach remove listener
        userDiv.querySelector('.remove-btn').addEventListener('click', () => userDiv.remove());
    },
    
    /**
     * Add software to list - FULLY FIXED
     */
    addSoftware() {
        const lang = LanguageManager || { t: (key) => key };
        const softwareList = document.getElementById('pro-softwareList');
        const softwareDiv = document.createElement('div');
        softwareDiv.className = 'software-item';
        const uniqueId = this.generateUniqueId('software');
        
        softwareDiv.innerHTML = `
            <div class="grid grid-2">
                <div class="form-group">
                    <label class="form-label" for="${uniqueId}-name">${lang.t('fields.softwareName')}</label>
                    <input type="text" class="form-control" id="${uniqueId}-name" name="software-name" data-field="name" placeholder="${lang.t('placeholders.softwareName')}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="${uniqueId}-path">${lang.t('fields.installPath')}</label>
                    <input type="text" class="form-control" id="${uniqueId}-path" name="software-path" data-field="path" placeholder="${lang.t('placeholders.softwarePath')}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="${uniqueId}-args">${lang.t('fields.arguments')}</label>
                    <input type="text" class="form-control" id="${uniqueId}-args" name="software-args" data-field="arguments" placeholder="${lang.t('placeholders.arguments')}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="${uniqueId}-order">${lang.t('fields.order')}</label>
                    <input type="number" class="form-control" id="${uniqueId}-order" name="software-order" data-field="order" value="1" min="1">
                </div>
                <div class="form-group">
                    <button class="remove-btn">❌ ${lang.t('buttons.remove')}</button>
                </div>
            </div>
        `;
        softwareList.appendChild(softwareDiv);
        
        // Attach remove listener
        softwareDiv.querySelector('.remove-btn').addEventListener('click', () => softwareDiv.remove());
    },
    
    /**
     * Add script to list - FULLY FIXED
     */
    addScript() {
        const lang = LanguageManager || { t: (key) => key };
        const scriptList = document.getElementById('pro-scriptList');
        const scriptDiv = document.createElement('div');
        scriptDiv.className = 'script-item';
        const uniqueId = this.generateUniqueId('script');
        
        scriptDiv.innerHTML = `
            <div class="grid grid-2">
                <div class="form-group">
                    <label class="form-label" for="${uniqueId}-phase">${lang.t('fields.phase')}</label>
                    <select class="form-control" id="${uniqueId}-phase" name="script-phase" data-field="phase">
                        <option value="windowsPE">${lang.t('options.scriptPhases.windowsPE')}</option>
                        <option value="specialize">${lang.t('options.scriptPhases.specialize')}</option>
                        <option value="firstLogon" selected>${lang.t('options.scriptPhases.firstLogon')}</option>
                        <option value="oobeSystem">${lang.t('options.scriptPhases.oobeSystem')}</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label" for="${uniqueId}-type">${lang.t('fields.scriptType')}</label>
                    <select class="form-control" id="${uniqueId}-type" name="script-type" data-field="type">
                        <option value="cmd">${lang.t('options.scriptTypes.cmd')}</option>
                        <option value="powershell" selected>${lang.t('options.scriptTypes.powershell')}</option>
                        <option value="vbs">${lang.t('options.scriptTypes.vbs')}</option>
                        <option value="exe">${lang.t('options.scriptTypes.exe')}</option>
                    </select>
                </div>
                <div class="form-group" style="grid-column: span 2;">
                    <label class="form-label" for="${uniqueId}-command">${lang.t('fields.commandPath')}</label>
                    <input type="text" class="form-control" id="${uniqueId}-command" name="script-command" data-field="command" placeholder="${lang.t('placeholders.scriptCommand')}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="${uniqueId}-order">${lang.t('fields.order')}</label>
                    <input type="number" class="form-control" id="${uniqueId}-order" name="script-order" data-field="order" value="1" min="1">
                </div>
                <div class="form-group">
                    <label for="${uniqueId}-async">
                        <input type="checkbox" id="${uniqueId}-async" name="script-async" data-field="async"> ${lang.t('fields.runAsync')}
                    </label>
                </div>
                <div class="form-group">
                    <button class="remove-btn">❌ ${lang.t('buttons.remove')}</button>
                </div>
            </div>
        `;
        scriptList.appendChild(scriptDiv);
        
        // Attach remove listener
        scriptDiv.querySelector('.remove-btn').addEventListener('click', () => scriptDiv.remove());
    },
    
    /**
     * Add scheduled task - FULLY FIXED
     */
    addTask() {
        const lang = LanguageManager || { t: (key) => key };
        const taskList = document.getElementById('pro-taskList');
        const taskDiv = document.createElement('div');
        taskDiv.className = 'task-item';
        const uniqueId = this.generateUniqueId('task');
        
        taskDiv.innerHTML = `
            <div class="form-group">
                <label class="form-label" for="${uniqueId}-name">${lang.t('fields.taskName')}</label>
                <input type="text" class="form-control" id="${uniqueId}-name" name="task-name" data-field="name" placeholder="${lang.t('placeholders.taskName')}">
            </div>
            <div class="form-group">
                <label class="form-label" for="${uniqueId}-trigger">${lang.t('fields.trigger')}</label>
                <select class="form-control" id="${uniqueId}-trigger" name="task-trigger" data-field="trigger">
                    <option value="startup">${lang.t('options.triggers.startup')}</option>
                    <option value="logon">${lang.t('options.triggers.logon')}</option>
                    <option value="daily">${lang.t('options.triggers.daily')}</option>
                    <option value="weekly">${lang.t('options.triggers.weekly')}</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label" for="${uniqueId}-action">${lang.t('fields.action')}</label>
                <input type="text" class="form-control" id="${uniqueId}-action" name="task-action" data-field="action" placeholder="${lang.t('placeholders.taskAction')}">
            </div>
            <div class="form-group">
                <button class="remove-btn">❌ ${lang.t('buttons.remove')}</button>
            </div>
        `;
        taskList.appendChild(taskDiv);
        
        // Attach remove listener
        taskDiv.querySelector('.remove-btn').addEventListener('click', () => taskDiv.remove());
    },
    
    /**
     * Add driver to list - FULLY FIXED
     */
    addDriver() {
        const lang = LanguageManager || { t: (key) => key };
        const driverList = document.getElementById('pro-driverList');
        const driverDiv = document.createElement('div');
        driverDiv.className = 'driver-item';
        const uniqueId = this.generateUniqueId('driver');
        
        driverDiv.innerHTML = `
            <div class="grid grid-2">
                <div class="form-group">
                    <label class="form-label" for="${uniqueId}-name">${lang.t('fields.driverName')}</label>
                    <input type="text" class="form-control" id="${uniqueId}-name" name="driver-name" data-field="name" placeholder="${lang.t('placeholders.driverName')}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="${uniqueId}-path">${lang.t('fields.infPath')}</label>
                    <input type="text" class="form-control" id="${uniqueId}-path" name="driver-path" data-field="infPath" placeholder="${lang.t('placeholders.infPath')}">
                </div>
                <div class="form-group">
                    <label for="${uniqueId}-critical">
                        <input type="checkbox" id="${uniqueId}-critical" name="driver-critical" data-field="critical"> ${lang.t('fields.criticalDriver')}
                    </label>
                </div>
                <div class="form-group">
                    <button class="remove-btn">❌ ${lang.t('buttons.remove')}</button>
                </div>
            </div>
        `;
        driverList.appendChild(driverDiv);
        
        // Attach remove listener
        driverDiv.querySelector('.remove-btn').addEventListener('click', () => driverDiv.remove());
    }
};