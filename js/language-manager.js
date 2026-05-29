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
        // Erlaubt einen Fallback-String als zweites Argument:
        //   lang.t('software.package', 'Software Package')
        // Damit fallen unübersetzte Keys nicht auf den Schlüssel-String,
        // sondern auf eine sinnvolle englische Standardanzeige zurück.
        let fallback = null;
        if (typeof params === 'string') {
            fallback = params;
            params = {};
        }
        // Navigate through nested keys
        const keys = key.split('.');
        let value = this.translations;

        // Defense-in-Depth: explizit pollution-relevante Key-Segmente ablehnen,
        // zusätzlich zum hasOwnProperty-Check.
        const UNSAFE_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

        for (const k of keys) {
            if (UNSAFE_SEGMENTS.has(k)) {
                console.warn(`Translation key rejected (unsafe segment): ${key}`);
                return fallback !== null ? fallback : key;
            }
            // Reflection statt Bracket-Access: getOwnPropertyDescriptor liefert
            // nur eigene Properties und kann keine Setter/Getter unbeabsichtigt
            // triggern — Funktion bleibt damit nachweisbar read-only.
            const desc = (value && typeof value === 'object')
                ? Object.getOwnPropertyDescriptor(value, k)
                : undefined;
            if (!desc) {
                console.warn(`Translation key not found: ${key}`);
                return fallback !== null ? fallback : key;
            }
            value = desc.value;
        }

        // Replace parameters if any
        if (typeof value === 'string') {
            return this.replacePlaceholders(value, params);
        }

        return value || fallback || key;
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
        // Schon vorhanden? abbrechen
        if (document.querySelector('.lang-dropdown')) return;

        const container = document.createElement('div');
        container.className = 'language-selector-container';
        const optionsHtml = Object.entries(this.availableLanguages).map(([code, name]) => `
            <button type="button" class="lang-option ${code === this.currentLang ? 'selected' : ''}" role="option" data-lang="${code}" aria-selected="${code === this.currentLang}">
                ${this.getFlagSvg(code)}
                <span>${name}</span>
            </button>
        `).join('');
        const hasOwn = Object.prototype.hasOwnProperty;
        const currentName = hasOwn.call(this.availableLanguages, this.currentLang)
            ? this.availableLanguages[this.currentLang]
            : this.currentLang;
        container.innerHTML = `
            <div class="lang-dropdown">
                <button type="button" class="lang-current" aria-haspopup="listbox" aria-expanded="false" aria-label="Language selection">
                    ${this.getFlagSvg(this.currentLang)}
                    <span class="lang-current-name">${currentName}</span>
                    <span class="caret" aria-hidden="true">▾</span>
                </button>
                <div class="lang-options" role="listbox" hidden>
                    ${optionsHtml}
                </div>
            </div>
        `;

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

        const trigger = container.querySelector('.lang-current');
        const menu = container.querySelector('.lang-options');

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const open = !menu.hasAttribute('hidden');
            if (open) {
                menu.setAttribute('hidden', '');
                trigger.setAttribute('aria-expanded', 'false');
            } else {
                menu.removeAttribute('hidden');
                trigger.setAttribute('aria-expanded', 'true');
                const closer = (ev) => {
                    if (!ev.target.closest('.lang-dropdown')) {
                        menu.setAttribute('hidden', '');
                        trigger.setAttribute('aria-expanded', 'false');
                        document.removeEventListener('click', closer, true);
                    }
                };
                setTimeout(() => document.addEventListener('click', closer, true), 0);
            }
        });

        menu.querySelectorAll('.lang-option').forEach(opt => {
            opt.addEventListener('click', async () => {
                const lang = opt.dataset.lang;
                menu.setAttribute('hidden', '');
                trigger.setAttribute('aria-expanded', 'false');
                await this.changeLanguage(lang);
            });
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
     * Inline-SVG-Flagge für eine Sprachcode-2-Buchstaben.
     * Anders als Unicode-Flag-Emojis (🇩🇪) werden SVGs auf jedem System
     * konsistent gerendert. Windows-Default-Emoji-Fonts zeigen Flag-Emojis
     * als Buchstaben-Codes („DE", „GB" …), was wir damit umgehen.
     * Alle SVGs sind statisch und stammen aus interner Map – kein User-Input.
     */
    getFlagSvg(langCode) {
        const flags = {
            de: '<svg class="flag" viewBox="0 0 24 16" preserveAspectRatio="none"><rect width="24" height="16" fill="#000"/><rect y="5.33" width="24" height="5.34" fill="#dd0000"/><rect y="10.67" width="24" height="5.33" fill="#ffce00"/></svg>',
            en: '<svg class="flag" viewBox="0 0 24 16" preserveAspectRatio="none"><rect width="24" height="16" fill="#012169"/><path d="M0 0L24 16M24 0L0 16" stroke="#fff" stroke-width="2"/><path d="M0 0L24 16M24 0L0 16" stroke="#c8102e" stroke-width="1"/><path d="M12 0V16M0 8H24" stroke="#fff" stroke-width="3.5"/><path d="M12 0V16M0 8H24" stroke="#c8102e" stroke-width="2"/></svg>',
            es: '<svg class="flag" viewBox="0 0 24 16" preserveAspectRatio="none"><rect width="24" height="16" fill="#aa151b"/><rect y="4" width="24" height="8" fill="#f1bf00"/></svg>',
            fr: '<svg class="flag" viewBox="0 0 24 16" preserveAspectRatio="none"><rect width="8" height="16" fill="#0055a4"/><rect x="8" width="8" height="16" fill="#fff"/><rect x="16" width="8" height="16" fill="#ef4135"/></svg>',
            it: '<svg class="flag" viewBox="0 0 24 16" preserveAspectRatio="none"><rect width="8" height="16" fill="#009246"/><rect x="8" width="8" height="16" fill="#fff"/><rect x="16" width="8" height="16" fill="#ce2b37"/></svg>',
            pl: '<svg class="flag" viewBox="0 0 24 16" preserveAspectRatio="none"><rect width="24" height="8" fill="#fff"/><rect y="8" width="24" height="8" fill="#dc143c"/><rect width="24" height="16" fill="none" stroke="rgba(0,0,0,.15)" stroke-width=".5"/></svg>',
            ru: '<svg class="flag" viewBox="0 0 24 16" preserveAspectRatio="none"><rect width="24" height="16" fill="#fff"/><rect y="5.33" width="24" height="5.34" fill="#0039a6"/><rect y="10.67" width="24" height="5.33" fill="#d52b1e"/><rect width="24" height="16" fill="none" stroke="rgba(0,0,0,.15)" stroke-width=".5"/></svg>',
            zh: '<svg class="flag" viewBox="0 0 24 16" preserveAspectRatio="none"><rect width="24" height="16" fill="#de2910"/><polygon points="4,3 4.5,4.5 6,4.5 4.8,5.4 5.3,7 4,6.1 2.7,7 3.2,5.4 2,4.5 3.5,4.5" fill="#ffde00"/></svg>'
        };
        return flags[langCode] || flags.en;
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
