/**
 * Language Manager
 * Handles multi-language support and translations
 */

export const LanguageManager = {
    // Current language
    currentLang: 'de',
    
    // Available languages
    availableLanguages: {
        'de': 'Deutsch',
        'en': 'English',
        'fr': 'Français',
        'es': 'Español',
        'it': 'Italiano',
        'pl': 'Polski',
        'ru': 'Русский',
        'zh': '中文'
    },
    
    // Loaded translations
    translations: {},
    
    /**
     * Initialize language system
     */
    async init() {
        // Get language from localStorage or browser
        this.currentLang = localStorage.getItem('app_language') || 
                          navigator.language.substring(0, 2) || 
                          'de';
        
        // Ensure language is available
        if (!this.availableLanguages[this.currentLang]) {
            this.currentLang = 'de';
        }
        
        // Load language file
        await this.loadLanguage(this.currentLang);
        
        // Create language selector
        this.createLanguageSelector();
        
        // Apply translations
        this.updateUI();
    },
    
    /**
     * Load language file
     */
    async loadLanguage(lang) {
        // Standalone-/Offline-Betrieb (file://): Übersetzungen sind im
        // Standalone-Build eingebettet (window.__embeddedTranslations), sodass
        // kein fetch nötig ist (fetch ist bei file:// CORS-blockiert). Im
        // Server-Betrieb ist das Objekt nicht vorhanden -> normaler fetch-Pfad.
        const embedded = (typeof window !== 'undefined' && window.__embeddedTranslations) || null;
        if (embedded && embedded[lang]) {
            this.translations = embedded[lang];
            this.currentLang = lang;
            try { localStorage.setItem('app_language', lang); } catch (e) { /* ignore */ }
            return true;
        }

        try {
            const response = await fetch(`./lang/${lang}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load language: ${lang}`);
            }
            this.translations = await response.json();
            this.currentLang = lang;
            localStorage.setItem('app_language', lang);
            return true;
        } catch (error) {
            console.error('Error loading language:', error);
            // Fallback to default language
            if (lang !== 'de') {
                return this.loadLanguage('de');
            }
            // Load embedded fallback
            this.loadFallbackTranslations();
            return false;
        }
    },
    
    /**
     * Get translation by key
     */
    t(key, params = {}) {
        // Navigate through nested keys
        const keys = key.split('.');
        let value = this.translations;
        
        for (const k of keys) {
            if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, k)) {
                value = value[k];
            } else {
                console.warn(`Translation key not found: ${key}`);
                return key;
            }
        }
        
        // Replace parameters if any
        if (typeof value === 'string') {
            return this.replacePlaceholders(value, params);
        }
        
        return value || key;
    },
    
    /**
     * Replace placeholders in translation string
     */
    replacePlaceholders(str, params) {
        let result = str;
        for (const [key, value] of Object.entries(params)) {
            result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
        }
        return result;
    },
    
    /**
     * Update UI with current language
     */
    updateUI() {
        // Update elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.t(key);
            
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                if (element.hasAttribute('placeholder')) {
                    element.placeholder = translation;
                } else {
                    element.value = translation;
                }
            } else if (element.tagName === 'SELECT') {
                // Handle select options
                const optionKey = element.getAttribute('data-i18n-options');
                if (optionKey) {
                    const options = this.t(optionKey);
                    if (typeof options === 'object') {
                        element.innerHTML = '';
                        for (const [value, text] of Object.entries(options)) {
                            const option = document.createElement('option');
                            option.value = value;
                            option.textContent = text;
                            element.appendChild(option);
                        }
                    }
                }
            } else {
                element.textContent = translation;
            }
        });
        
        // Update elements with data-i18n-html (for HTML content)
        document.querySelectorAll('[data-i18n-html]').forEach(element => {
            const key = element.getAttribute('data-i18n-html');
            element.innerHTML = this.t(key);
        });
        
        // Update title attributes
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            element.title = this.t(key);
        });
        
        // Update aria-label attributes
        document.querySelectorAll('[data-i18n-aria]').forEach(element => {
            const key = element.getAttribute('data-i18n-aria');
            element.setAttribute('aria-label', this.t(key));
        });
        
        // Update document title
        if (this.translations.meta && this.translations.meta.title) {
            document.title = this.translations.meta.title;
        }
        
        // Trigger custom event
        document.dispatchEvent(new CustomEvent('languageChanged', {
            detail: { language: this.currentLang }
        }));
    },
    
    /**
     * Create language selector
     */
    createLanguageSelector() {
        // Check if selector already exists
        let selector = document.getElementById('language-selector');
        if (!selector) {
            // Create selector container
            const container = document.createElement('div');
            container.className = 'language-selector-container';
            container.innerHTML = `
                <select id="language-selector" class="language-selector" aria-label="Language selection">
                    ${Object.entries(this.availableLanguages)
                        .map(([code, name]) => 
                            `<option value="${code}" ${code === this.currentLang ? 'selected' : ''}>${this.getFlagEmoji(code)} ${name}</option>`
                        ).join('')}
                </select>
            `;
            
            // Add to header or create fixed position
            const header = document.querySelector('.header');
            if (header) {
                header.appendChild(container);
            } else {
                container.style.position = 'fixed';
                container.style.top = '10px';
                container.style.right = '10px';
                container.style.zIndex = '10000';
                document.body.appendChild(container);
            }
            
            selector = container.querySelector('#language-selector');
        }
        
        // Add change listener
        selector.addEventListener('change', async (e) => {
            const newLang = e.target.value;
            await this.changeLanguage(newLang);
        });
    },
    
    /**
     * Change language
     */
    async changeLanguage(lang) {
        if (lang === this.currentLang) return;
        
        // Show loading indicator
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'language-loading';
        loadingDiv.innerHTML = '<div class="spinner"></div>';
        document.body.appendChild(loadingDiv);
        
        // Load new language
        const success = await this.loadLanguage(lang);
        
        if (success) {
            // Update UI
            this.updateUI();
            
            // Update dynamic content
            if (window.WizardMode && window.WizardMode.refreshContent) {
                window.WizardMode.refreshContent();
            }
            if (window.ProMode && window.ProMode.refreshContent) {
                window.ProMode.refreshContent();
            }
            
            // Show success notification
            if (window.UIHelpers) {
                window.UIHelpers.showNotification(this.t('notifications.languageChanged'), 'success');
            }
        }
        
        // Remove loading indicator
        loadingDiv.remove();
    },
    
    /**
     * Get flag emoji for language code
     */
    getFlagEmoji(langCode) {
        const flags = {
            'de': '🇩🇪',
            'en': '🇬🇧',
            'fr': '🇫🇷',
            'es': '🇪🇸',
            'it': '🇮🇹',
            'pl': '🇵🇱',
            'ru': '🇷🇺',
            'zh': '🇨🇳'
        };
        return flags[langCode] || '🌐';
    },
    
    /**
     * Format date according to current locale
     */
    formatDate(date, format = 'short') {
        const locale = this.getLocaleCode();
        const options = {
            short: { year: 'numeric', month: '2-digit', day: '2-digit' },
            long: { year: 'numeric', month: 'long', day: 'numeric' },
            full: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
        };
        
        return new Intl.DateTimeFormat(locale, options[format] || options.short).format(date);
    },
    
    /**
     * Format number according to current locale
     */
    formatNumber(number, decimals = 0) {
        const locale = this.getLocaleCode();
        return new Intl.NumberFormat(locale, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(number);
    },
    
    /**
     * Get locale code for current language
     */
    getLocaleCode() {
        const locales = {
            'de': 'de-DE',
            'en': 'en-US',
            'fr': 'fr-FR',
            'es': 'es-ES',
            'it': 'it-IT',
            'pl': 'pl-PL',
            'ru': 'ru-RU',
            'zh': 'zh-CN'
        };
        return locales[this.currentLang] || 'en-US';
    },
    
    /**
     * Load fallback translations (embedded)
     */
    loadFallbackTranslations() {
        this.translations = {
            meta: {
                title: "Windows Autounattend.xml Generator",
                description: "Professional Windows unattended installation configuration generator"
            },
            common: {
                next: "Next",
                previous: "Previous",
                finish: "Finish",
                generate: "Generate",
                download: "Download",
                copy: "Copy",
                save: "Save",
                load: "Load",
                import: "Import",
                export: "Export",
                validate: "Validate",
                cancel: "Cancel",
                close: "Close",
                add: "Add",
                remove: "Remove",
                edit: "Edit",
                delete: "Delete",
                yes: "Yes",
                no: "No"
            }
        };
    },
    
    /**
     * Get all translations for a specific section
     */
    getSection(section) {
        return this.translations[section] || {};
    }
};

// Auto-initialize will be handled by app.js to ensure correct order
// Do not auto-initialize here to prevent race conditions
