/**
 * Main Application Entry Point - IMPROVED VERSION
 * Windows Autounattend.xml Generator - Multi-language Edition
 * 
 * Improvements:
 * - Fixed memory leaks
 * - Enhanced auto-save functionality
 * - Added comprehensive cleanup methods
 * - Better event handler management
 */

import { LanguageManager } from './language-manager.js';
import { ConfigManager } from './config.js';
import { UIHelpers } from './ui-helpers.js';
import { WizardMode } from './wizard.js';
import { ProMode } from './pro-mode.js';
import { DynamicElements } from './dynamic-elements.js';
import { XMLGenerator } from './xml-generator.js';

// Application Controller with improved memory management
const App = {
    // Store references to event handlers for cleanup
    eventHandlers: {
        keydown: null,
        change: null,
        resize: null,
        languageChange: null,
        beforeunload: null,
        visibilitychange: null
    },

    // Store references to timeouts for cleanup
    timers: {
        autoSave: null,
        resize: null,
        notification: null
    },

    // Store references to intervals
    intervals: {
        autoSaveInterval: null
    },

    // Event listener abort controller for modern cleanup
    abortController: null,

    // Track initialization state
    isInitialized: false,
    isRefreshing: false,

    // Auto-save configuration
    autoSaveConfig: {
        enabled: true,
        interval: 30000, // 30 seconds
        debounceDelay: 1000, // 1 second
        lastSaveTime: null,
        isDirty: false
    },

    /**
     * Initialize the application with proper cleanup
     */
    async init() {
        // Prevent multiple initializations
        if (this.isInitialized) {
            console.warn('App already initialized. Cleaning up and reinitializing...');
            await this.cleanup();
        }

        try {
            // Create new abort controller for this session
            this.abortController = new AbortController();

            // Initialize language system first
            await LanguageManager.init();
            
            // Setup event handlers with references
            this.setupEventHandlers();
            
            // Initialize mode and config
            this.initializeMode();
            this.loadSavedConfig();

            // Gespeicherte dynamische Items (Partitionen/Benutzer/Software/…)
            // zurück in die jetzt gerenderten Formulare laden.
            DynamicElements.loadFromConfig();

            // Start auto-save interval
            this.startAutoSaveInterval();
            
            // Mark as initialized
            this.isInitialized = true;

            console.log('Application initialized successfully');
        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.handleInitError(error);
        }
    },

    /**
     * Setup all event handlers with proper references
     */
    setupEventHandlers() {
        const signal = this.abortController.signal;

        // Keyboard shortcuts handler
        this.eventHandlers.keydown = (e) => this.handleKeyboardShortcuts(e);
        document.addEventListener('keydown', this.eventHandlers.keydown, { signal });

        // Auto-save on change handler
        this.eventHandlers.change = (e) => this.handleDocumentChange(e);
        document.addEventListener('change', this.eventHandlers.change, { signal });

        // Window resize handler with debouncing
        this.eventHandlers.resize = () => this.handleWindowResize();
        window.addEventListener('resize', this.eventHandlers.resize, { signal });

        // Language change handler
        this.eventHandlers.languageChange = (e) => this.handleLanguageChange(e);
        document.addEventListener('languageChanged', this.eventHandlers.languageChange, { signal });

        // Before unload handler for unsaved changes
        this.eventHandlers.beforeunload = (e) => this.handleBeforeUnload(e);
        window.addEventListener('beforeunload', this.eventHandlers.beforeunload, { signal });

        // Visibility change for auto-save
        this.eventHandlers.visibilitychange = () => this.handleVisibilityChange();
        document.addEventListener('visibilitychange', this.eventHandlers.visibilitychange, { signal });

        // Mode switching
        this.attachModeListeners();

        // Wizard navigation
        this.attachWizardListeners();

        // Pro mode tabs
        this.attachProModeListeners();
        
        // Action buttons (Help, Generate XML, etc.)
        this.attachActionButtonListeners();
        
        // Modal close buttons
        this.attachModalListeners();
    },

    /**
     * Attach mode switching listeners
     */
    attachModeListeners() {
        const signal = this.abortController.signal;
        
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.currentTarget.dataset.mode;
                this.switchMode(mode);
            }, { signal });
        });
    },

    /**
     * Attach wizard navigation listeners
     */
    attachWizardListeners() {
        const signal = this.abortController.signal;

        const prevBtn = document.getElementById('prevBtn');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => WizardMode.previousStep(), { signal });
        }

        const nextBtn = document.getElementById('nextBtn');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => WizardMode.nextStep(), { signal });
        }

        const finishBtn = document.getElementById('finishBtn');
        if (finishBtn) {
            finishBtn.addEventListener('click', () => this.generateXML(), { signal });
        }

        // Wizard step clicks
        document.querySelectorAll('.wizard-step').forEach((step, index) => {
            step.addEventListener('click', () => WizardMode.goToStep(index + 1), { signal });
        });
    },

    /**
     * Attach pro mode tab listeners
     */
    attachProModeListeners() {
        const signal = this.abortController.signal;

        document.querySelectorAll('.pro-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.currentTarget.dataset.tab;
                this.switchProTab(tabName);
            }, { signal });
        });
    },

    /**
     * Attach action button listeners
     */
    attachActionButtonListeners() {
        const signal = this.abortController.signal;
        
        // Handle all buttons with data-action attribute
        document.querySelectorAll('[data-action]').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const action = button.dataset.action;
                
                switch(action) {
                    case 'toggle-info-menu':
                        this.toggleInfoMenu(button);
                        break;
                    case 'show-about':
                        this.closeInfoMenu();
                        this.showAbout();
                        break;
                    case 'check-updates':
                        this.closeInfoMenu();
                        this.checkUpdates();
                        break;
                    case 'help':
                        this.showAbout();
                        break;
                    case 'import':
                        this.importXML();
                        break;
                    case 'save-template':
                        this.saveAsTemplate();
                        break;
                    case 'validate':
                        this.validateConfiguration();
                        break;
                    case 'generate':
                        this.generateXML();
                        break;
                    case 'copy-xml':
                        this.copyXMLToClipboard();
                        break;
                    case 'download-xml':
                        this.downloadXML();
                        break;
                    default:
                        console.warn('Unknown action:', action);
                }
            }, { signal });
        });
    },
    
    /**
     * Attach modal listeners
     */
    attachModalListeners() {
        const signal = this.abortController.signal;
        
        // Close buttons for all modals
        document.querySelectorAll('.modal-close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    UIHelpers.closeModal(modal.id);
                }
            }, { signal });
        });
        
        // Click outside modal to close
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    UIHelpers.closeModal(modal.id);
                }
            }, { signal });
        });
    },

    /**
     * Handle keyboard shortcuts
     */
    handleKeyboardShortcuts(e) {
        // Ctrl+S: Save configuration
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            this.saveConfiguration();
        }
        
        // Ctrl+G: Generate XML
        if (e.ctrlKey && e.key === 'g') {
            e.preventDefault();
            this.generateXML();
        }
        
        // Ctrl+I: Import XML
        if (e.ctrlKey && e.key === 'i') {
            e.preventDefault();
            this.importXML();
        }
        
        // F1: Show help
        if (e.key === 'F1') {
            e.preventDefault();
            this.showHelp();
        }
        
        // Escape: Close modal
        if (e.key === 'Escape') {
            UIHelpers.closeModal();
        }
    },

    /**
     * Handle document change for auto-save
     */
    handleDocumentChange(e) {
        // Ignore certain elements
        if (e.target.classList.contains('no-autosave')) {
            return;
        }

        // Mark as dirty
        this.autoSaveConfig.isDirty = true;

        // Debounced auto-save
        this.debouncedAutoSave();
    },

    /**
     * Handle window resize with debouncing
     */
    handleWindowResize() {
        clearTimeout(this.timers.resize);
        this.timers.resize = setTimeout(() => {
            this.adjustUIForViewport();
        }, 250);
    },

    /**
     * Handle visibility change
     */
    handleVisibilityChange() {
        if (!document.hidden && this.autoSaveConfig.isDirty) {
            // Save when tab becomes visible again
            this.autoSave();
        }
    },

    /**
     * Handle before unload
     */
    handleBeforeUnload(e) {
        if (this.autoSaveConfig.isDirty) {
            const message = 'You have unsaved changes. Are you sure you want to leave?';
            e.returnValue = message;
            return message;
        }
    },

    /**
     * Handle language change event
     */
    handleLanguageChange(e) {
        if (!this.isRefreshing) {
            this.isRefreshing = true;
            this.refreshUI();
            setTimeout(() => {
                this.isRefreshing = false;
            }, 100);
        }
    },

    /**
     * Debounced auto-save
     */
    debouncedAutoSave() {
        clearTimeout(this.timers.autoSave);
        this.timers.autoSave = setTimeout(() => {
            this.autoSave();
        }, this.autoSaveConfig.debounceDelay);
    },

    /**
     * Start auto-save interval
     */
    startAutoSaveInterval() {
        // Clear existing interval if any
        this.stopAutoSaveInterval();

        if (this.autoSaveConfig.enabled) {
            this.intervals.autoSaveInterval = setInterval(() => {
                if (this.autoSaveConfig.isDirty) {
                    this.autoSave();
                }
            }, this.autoSaveConfig.interval);
        }
    },

    /**
     * Stop auto-save interval
     */
    stopAutoSaveInterval() {
        if (this.intervals.autoSaveInterval) {
            clearInterval(this.intervals.autoSaveInterval);
            this.intervals.autoSaveInterval = null;
        }
    },

    /**
     * Enhanced auto-save with error handling
     */
    async autoSave() {
        if (!this.autoSaveConfig.isDirty) {
            return;
        }

        try {
            // Save current step data if in wizard mode
            if (ConfigManager.currentMode === 'wizard') {
                WizardMode.saveCurrentStepData();
            }

            // Attempt to save
            const saved = await ConfigManager.saveToStorage();
            
            if (saved) {
                this.autoSaveConfig.isDirty = false;
                this.autoSaveConfig.lastSaveTime = new Date();
                
                // Show subtle save indicator
                this.showSaveIndicator();
            } else {
                throw new Error('Failed to save to storage');
            }
        } catch (error) {
            console.error('Auto-save failed:', error);
            this.handleAutoSaveError(error);
        }
    },

    /**
     * Show save indicator
     */
    showSaveIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'save-indicator';
        indicator.innerHTML = '✓ Saved';
        document.body.appendChild(indicator);

        setTimeout(() => {
            indicator.classList.add('fade-out');
            setTimeout(() => indicator.remove(), 300);
        }, 2000);
    },

    /**
     * Handle auto-save error
     */
    handleAutoSaveError(error) {
        // Don't show error notification for every failed auto-save
        // Just log and try again on next interval
        console.warn('Auto-save failed, will retry:', error.message);
    },

    /**
     * Manual save configuration
     */
    async saveConfiguration() {
        try {
            if (ConfigManager.currentMode === 'wizard') {
                WizardMode.saveCurrentStepData();
            }

            const saved = await ConfigManager.saveToStorage();
            
            if (saved) {
                this.autoSaveConfig.isDirty = false;
                this.autoSaveConfig.lastSaveTime = new Date();
                UIHelpers.showNotification(LanguageManager.t('notifications.configSaved'), 'success');
            } else {
                throw new Error('Failed to save configuration');
            }
        } catch (error) {
            console.error('Save failed:', error);
            UIHelpers.showNotification(LanguageManager.t('notifications.saveFailed'), 'error');
        }
    },

    /**
     * Initialize the default mode
     */
    initializeMode() {
        const currentMode = ConfigManager.currentMode;
        
        if (currentMode === 'wizard') {
            this.activateWizardMode();
        } else {
            this.activateProMode();
        }
    },

    /**
     * Load saved configuration
     */
    loadSavedConfig() {
        try {
            if (ConfigManager.loadFromStorage()) {
                console.log('Loaded saved configuration');
            }
        } catch (error) {
            console.error('Failed to load saved config:', error);
        }
    },

    /**
     * Refresh UI elements
     */
    refreshUI() {
        // Save current state
        const currentMode = ConfigManager.currentMode;
        const currentStep = ConfigManager.currentStep || 1; // Fixed: Use ConfigManager.currentStep instead of WizardMode.currentStep

        // Reinitialize mode
        this.initializeMode();

        // Neu gerenderte Formulare wieder mit den gespeicherten dynamischen
        // Items befüllen (sonst gingen sie z. B. beim Sprachwechsel verloren).
        DynamicElements.loadFromConfig();

        // Restore state
        if (currentMode === 'wizard' && currentStep) {
            WizardMode.goToStep(currentStep);
        }

        // Update all text elements
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.dataset.i18n;
            element.textContent = LanguageManager.t(key);
        });
    },

    /**
     * Adjust UI for viewport
     */
    adjustUIForViewport() {
        const width = window.innerWidth;
        const isMobile = width <= 768;
        const isTablet = width <= 1024;

        document.body.classList.toggle('mobile', isMobile);
        document.body.classList.toggle('tablet', isTablet);
        document.body.classList.toggle('desktop', !isTablet);
    },

    /**
     * Switch between wizard and pro mode
     */
    switchMode(mode) {
        // Save current data before switching
        if (ConfigManager.currentMode === 'wizard') {
            WizardMode.saveCurrentStepData();
        }

        if (mode === 'wizard') {
            this.activateWizardMode();
        } else if (mode === 'pro') {
            this.activateProMode();
        }
    },

    /**
     * Activate wizard mode
     */
    activateWizardMode() {
        ConfigManager.currentMode = 'wizard';
        
        // Ensure we have a valid current step
        if (!ConfigManager.currentStep || ConfigManager.currentStep < 1) {
            ConfigManager.currentStep = 1;
        }
        
        // Update UI
        const wizardContainer = document.querySelector('.wizard-container');
        const proContainer = document.querySelector('.pro-container');
        
        if (wizardContainer) {
            wizardContainer.classList.add('active');
        }
        if (proContainer) {
            proContainer.classList.remove('active');
        }
        
        // Update mode buttons
        document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector('.mode-btn[data-mode="wizard"]')?.classList.add('active');
        
        // Initialize wizard
        WizardMode.initializeSteps();
    },

    /**
     * Activate pro mode
     */
    activateProMode() {
        ConfigManager.currentMode = 'pro';
        
        // Update UI
        document.querySelector('.wizard-container').classList.remove('active');
        document.querySelector('.pro-container').classList.add('active');
        
        // Update mode buttons
        document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector('.mode-btn[data-mode="pro"]')?.classList.add('active');
        
        // Load first tab
        ProMode.loadContent('basic');
    },

    /**
     * Switch pro mode tab
     */
    switchProTab(tab) {
        // Update active tab
        document.querySelectorAll('.pro-tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.pro-tab[data-tab="${tab}"]`)?.classList.add('active');
        
        // Load tab content
        ProMode.loadContent(tab);
    },

    /**
     * Generate XML
     */
    generateXML() {
        // Save current data
        if (ConfigManager.currentMode === 'wizard') {
            WizardMode.saveCurrentStepData();
        }
        
        // Mark as saved after generation
        this.autoSaveConfig.isDirty = false;
        
        // Generate and show XML
        XMLGenerator.generateXML();
    },

    /**
     * Import XML file
     */
    importXML() {
        UIHelpers.createFileInput('.xml', (content, file) => {
            if (XMLGenerator.importXML(content)) {
                UIHelpers.showNotification(
                    LanguageManager.t('notifications.xmlImported', { filename: file.name }), 
                    'success'
                );
                this.refreshUI();
                this.autoSaveConfig.isDirty = true;
            }
        });
    },

    /**
     * Öffnet/schließt das Über-&-Hilfe-Dropdown in der Titelleiste.
     * Registriert beim ersten Öffnen einen einmaligen Document-Click-Listener,
     * der das Menü schließt, sobald außerhalb geklickt wird (oder Escape gedrückt).
     */
    toggleInfoMenu(triggerBtn) {
        const menu = document.querySelector('.title-menu-dropdown');
        if (!menu) return;
        const isOpen = !menu.hasAttribute('hidden');
        if (isOpen) {
            this.closeInfoMenu();
        } else {
            menu.removeAttribute('hidden');
            if (triggerBtn) triggerBtn.setAttribute('aria-expanded', 'true');
            const closer = (e) => {
                if (!e.target.closest('.title-menu')) {
                    this.closeInfoMenu();
                    document.removeEventListener('click', closer, true);
                    document.removeEventListener('keydown', escCloser, true);
                }
            };
            const escCloser = (e) => {
                if (e.key === 'Escape') {
                    this.closeInfoMenu();
                    document.removeEventListener('click', closer, true);
                    document.removeEventListener('keydown', escCloser, true);
                }
            };
            // setTimeout, damit der aktuelle Klick das Menü nicht sofort wieder schließt.
            setTimeout(() => {
                document.addEventListener('click', closer, true);
                document.addEventListener('keydown', escCloser, true);
            }, 0);
        }
    },

    /** Schließt das Info-Dropdown sicher. */
    closeInfoMenu() {
        const menu = document.querySelector('.title-menu-dropdown');
        if (menu) menu.setAttribute('hidden', '');
        const btn = document.querySelector('[data-action="toggle-info-menu"]');
        if (btn) btn.setAttribute('aria-expanded', 'false');
    },

    /**
     * Liest die App-Version aus dem statischen About-Modal-Markup.
     * Sauberer als eine vierte Konstanten-Stelle: die Version steht ohnehin im DOM.
     */
    getAppVersion() {
        const el = document.querySelector('#helpModal .about-section code');
        return el ? el.textContent.trim() : '0.0.0';
    },

    /**
     * Prüft per GitHub-Releases-API, ob eine neuere Version verfügbar ist.
     * Vergleich erfolgt nach SemVer (numerisch); kein eval, kein Markup-Inject.
     */
    async checkUpdates() {
        const current = this.getAppVersion();
        if (typeof UIHelpers !== 'undefined' && UIHelpers.showNotification) {
            UIHelpers.showNotification('Prüfe auf Updates …', 'info');
        }
        try {
            const res = await fetch(
                'https://api.github.com/repos/CallMeTechie/Windows-Unattend-XML-Generator/releases/latest',
                { headers: { 'Accept': 'application/vnd.github+json' } }
            );
            // GitHub-API für anonyme Aufrufe ist auf 60 Anfragen/Stunde
            // beschränkt – statt eines nichtssagenden "HTTP 403" lieber eine
            // konkrete Meldung anzeigen.
            if (res.status === 403 || res.status === 429) {
                UIHelpers.showNotification(
                    'GitHub-API-Limit erreicht (60 Anfragen/Stunde für anonyme Aufrufe). Bitte später erneut versuchen.',
                    'warning'
                );
                return;
            }
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            const latest = String(data.tag_name || '').replace(/^v/, '').trim();
            if (!latest) throw new Error('Keine Version gefunden');
            const cmp = this._compareSemver(latest, current);
            if (cmp > 0) {
                if (confirm(`Eine neue Version ist verfügbar:\n\nAktuell: v${current}\nNeu:     v${latest}\n\nMöchtest du die Release-Seite öffnen?`)) {
                    window.open(data.html_url || 'https://github.com/CallMeTechie/Windows-Unattend-XML-Generator/releases/latest', '_blank', 'noopener');
                }
            } else if (cmp === 0) {
                UIHelpers.showNotification(`Du nutzt die aktuelle Version (v${current}).`, 'success');
            } else {
                UIHelpers.showNotification(`Du nutzt eine Vorschau-Version (v${current}, veröffentlicht: v${latest}).`, 'info');
            }
        } catch (e) {
            UIHelpers.showNotification('Update-Prüfung fehlgeschlagen: ' + e.message, 'error');
        }
    },

    /** SemVer-Vergleich (Patch-genau, ohne Pre-Release-Behandlung). */
    _compareSemver(a, b) {
        const pa = a.split('.').map(n => parseInt(n, 10) || 0);
        const pb = b.split('.').map(n => parseInt(n, 10) || 0);
        for (let i = 0; i < 3; i++) {
            if ((pa[i] || 0) > (pb[i] || 0)) return 1;
            if ((pa[i] || 0) < (pb[i] || 0)) return -1;
        }
        return 0;
    },

    /**
     * Alias auf showAbout() – das Über-Modal liegt jetzt statisch in index.html.
     */
    showAbout() {
        if (typeof UIHelpers !== 'undefined' && UIHelpers.showModal) {
            UIHelpers.showModal('helpModal');
        }
    },

    /**
     * (Deprecated) Behält die alte Help-Modal-API; öffnet das About-Modal.
     */
    showHelp() {
        const helpModal = document.getElementById('helpModal');
        if (helpModal) {
            // Populate help content if needed
            const modalBody = helpModal.querySelector('.modal-body');
            if (modalBody && !modalBody.innerHTML.trim()) {
                modalBody.innerHTML = `
                    <h3>${LanguageManager.t('help.gettingStarted', 'Getting Started')}</h3>
                    <p>${LanguageManager.t('help.intro', 'This tool helps you create unattended Windows installation configurations.')}</p>
                    
                    <h4>${LanguageManager.t('help.wizardMode', 'Wizard Mode')}</h4>
                    <p>${LanguageManager.t('help.wizardModeDesc', 'Step-by-step guided configuration for beginners.')}</p>
                    
                    <h4>${LanguageManager.t('help.proMode', 'Pro Mode')}</h4>
                    <p>${LanguageManager.t('help.proModeDesc', 'Advanced configuration with all available options.')}</p>
                    
                    <h4>${LanguageManager.t('help.shortcuts', 'Keyboard Shortcuts')}</h4>
                    <ul>
                        <li><strong>Ctrl+S</strong> - ${LanguageManager.t('help.saveConfig', 'Save configuration')}</li>
                        <li><strong>Ctrl+G</strong> - ${LanguageManager.t('help.generateXml', 'Generate XML')}</li>
                        <li><strong>Ctrl+I</strong> - ${LanguageManager.t('help.importXml', 'Import XML')}</li>
                        <li><strong>F1</strong> - ${LanguageManager.t('help.showHelp', 'Show this help')}</li>
                        <li><strong>Esc</strong> - ${LanguageManager.t('help.closeModal', 'Close modal')}</li>
                    </ul>
                `;
            }
            UIHelpers.showModal('helpModal');
        }
    },
    
    /**
     * Save configuration as template
     */
    saveAsTemplate() {
        const templateName = UIHelpers.prompt(LanguageManager.t('prompts.templateName', 'Enter template name:'));
        if (templateName) {
            // Save current configuration as template (ohne Klartext-Passwörter)
            const config = ConfigManager.getStorableConfig();
            const templates = JSON.parse(localStorage.getItem('autounattend_templates') || '{}');
            templates[templateName] = config;
            localStorage.setItem('autounattend_templates', JSON.stringify(templates));
            UIHelpers.showNotification(
                LanguageManager.t('notifications.templateSaved', 'Template saved successfully'), 
                'success'
            );
        }
    },
    
    /**
     * Validate current configuration
     */
    validateConfiguration() {
        // Basic validation
        const config = ConfigManager.getConfig();
        const errors = [];
        
        // Check required fields
        if (!config.productKey) {
            errors.push(LanguageManager.t('validation.productKeyRequired', 'Product key is required'));
        }
        
        if (!config.userName) {
            errors.push(LanguageManager.t('validation.userNameRequired', 'User name is required'));
        }
        
        if (errors.length > 0) {
            UIHelpers.showNotification(
                LanguageManager.t('validation.errors', 'Validation errors: ') + errors.join(', '), 
                'error'
            );
        } else {
            UIHelpers.showNotification(
                LanguageManager.t('validation.success', 'Configuration is valid'), 
                'success'
            );
        }
    },
    
    /**
     * Copy generated XML to clipboard
     */
    copyXMLToClipboard() {
        const xmlContent = document.getElementById('xmlPreview')?.textContent;
        if (xmlContent) {
            UIHelpers.copyToClipboard(xmlContent);
        }
    },
    
    /**
     * Download generated XML
     */
    downloadXML() {
        const xmlContent = document.getElementById('xmlPreview')?.textContent;
        if (xmlContent) {
            UIHelpers.downloadFile(xmlContent, 'autounattend.xml', 'text/xml');
        }
    },

    /**
     * Handle initialization error
     */
    handleInitError(error) {
        console.error('Initialization failed:', error);
        
        // Show error to user
        const errorContainer = document.getElementById('app-error');
        if (errorContainer) {
            // error.message escapen (DOM-XSS-Schutz) und Reload ohne inline-Handler
            // binden, damit eine strikte CSP (script-src 'self') greifen kann.
            errorContainer.innerHTML = `
                <div class="error-message">
                    <h3>Initialization Error</h3>
                    <p>${UIHelpers.escapeHtml(error.message)}</p>
                    <button type="button" class="btn-reload">Reload Page</button>
                </div>
            `;
            errorContainer.querySelector('.btn-reload')?.addEventListener('click', () => location.reload());
            errorContainer.style.display = 'block';
        }
    },

    /**
     * COMPREHENSIVE CLEANUP METHOD
     * Removes all event listeners, clears timers, and frees resources
     */
    async cleanup() {
        console.log('Starting application cleanup...');

        try {
            // 1. Clear all timers
            Object.keys(this.timers).forEach(timer => {
                if (this.timers[timer]) {
                    clearTimeout(this.timers[timer]);
                    this.timers[timer] = null;
                }
            });

            // 2. Clear all intervals
            Object.keys(this.intervals).forEach(interval => {
                if (this.intervals[interval]) {
                    clearInterval(this.intervals[interval]);
                    this.intervals[interval] = null;
                }
            });

            // 3. Stop auto-save
            this.stopAutoSaveInterval();

            // 4. Save any pending changes
            if (this.autoSaveConfig.isDirty) {
                await this.autoSave();
            }

            // 5. Abort all event listeners using AbortController
            if (this.abortController) {
                this.abortController.abort();
                this.abortController = null;
            }

            // 6. Clean up UI helpers
            if (UIHelpers.cleanup) {
                UIHelpers.cleanup();
            }

            // 7. Clean up wizard mode
            if (WizardMode.cleanup) {
                WizardMode.cleanup();
            }

            // 8. Clean up pro mode
            if (ProMode.cleanup) {
                ProMode.cleanup();
            }

            // 9. Clean up dynamic elements
            if (DynamicElements.cleanup) {
                DynamicElements.cleanup();
            }

            // 10. Reset initialization flag
            this.isInitialized = false;
            this.isRefreshing = false;

            console.log('Application cleanup completed');
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    },

    /**
     * Destroy the application completely
     */
    async destroy() {
        await this.cleanup();
        
        // Remove global references
        if (window.App === this) {
            delete window.App;
        }
        
        // Clear all module references from window
        const modules = [
            'LanguageManager', 'ConfigManager', 'UIHelpers', 
            'WizardMode', 'ProMode', 'DynamicElements', 'XMLGenerator'
        ];
        
        modules.forEach(module => {
            if (window[module]) {
                delete window[module];
            }
        });

        console.log('Application destroyed');
    },

    /**
     * Export configuration
     */
    exportConfiguration() {
        const config = ConfigManager.exportConfig();
        UIHelpers.downloadFile(config, 'autounattend-config.json', 'application/json');
    },

    /**
     * Import configuration
     */
    importConfiguration() {
        UIHelpers.createFileInput('.json', (content) => {
            if (ConfigManager.importConfig(content)) {
                UIHelpers.showNotification(LanguageManager.t('notifications.configLoaded'), 'success');
                this.refreshUI();
                this.autoSaveConfig.isDirty = true;
            }
        });
    },

    /**
     * Reset configuration
     */
    resetConfiguration() {
        if (UIHelpers.confirm(LanguageManager.t('modals.confirm.resetConfig'))) {
            ConfigManager.resetConfig();
            this.refreshUI();
            this.autoSaveConfig.isDirty = false;
            UIHelpers.showNotification(LanguageManager.t('notifications.configReset'), 'success');
        }
    }
};

// Export for use in other modules
export { 
    App, 
    LanguageManager,
    ConfigManager, 
    UIHelpers, 
    WizardMode, 
    ProMode, 
    DynamicElements, 
    XMLGenerator 
};

// Make modules available globally for backward compatibility
window.LanguageManager = LanguageManager;
window.ConfigManager = ConfigManager;
window.UIHelpers = UIHelpers;
window.WizardMode = WizardMode;
window.ProMode = ProMode;
window.DynamicElements = DynamicElements;
window.XMLGenerator = XMLGenerator;
window.App = App;

// Initialize application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
} else {
    App.init();
}

// Cleanup on page unload - Using pagehide instead of deprecated unload
window.addEventListener('pagehide', () => {
    App.cleanup();
});

// Additional cleanup for beforeunload if needed
window.addEventListener('beforeunload', () => {
    // Only perform minimal cleanup here
    if (App.autoSaveConfig && App.autoSaveConfig.isDirty) {
        // Synchroner Save über ConfigManager, damit auch hier keine
        // Klartext-Passwörter nach localStorage gelangen (siehe getStorableConfig).
        try {
            ConfigManager.saveToStorage();
        } catch (e) {
            console.warn('Could not save on unload:', e);
        }
    }
});