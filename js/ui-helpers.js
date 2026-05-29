/**
 * UI Helper Functions - COMPLETE IMPROVED VERSION
 * Provides common UI utilities and interactions
 * 
 * Improvements:
 * - Better timer management for notifications
 * - Proper cleanup methods
 * - Memory leak prevention
 * - ALL required functions included
 */

import { LanguageManager } from './language-manager.js';

export const UIHelpers = {
    // Store all active timers and references
    notificationTimers: new Map(),
    modalStack: [],
    fileInputs: new WeakMap(),
    activeTooltips: new Set(),

    /**
     * Escape a value for safe interpolation into HTML markup / attribute values.
     * Prevents DOM-based XSS when user- or import-supplied strings are placed
     * into innerHTML template literals (e.g. value="${escapeHtml(x)}").
     * Does not use `this`, so it can be used as a free-standing reference.
     * @param {*} value
     * @returns {string}
     */
    escapeHtml(value) {
        if (value === null || value === undefined) return '';
        return String(value)
            .replace(/&/g, '&amp;')   // muss zuerst kommen
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    /**
     * Render XML as syntax-highlighted, XSS-safe HTML for preview panes.
     *
     * The XML is FIRST fully HTML-escaped, so any configuration value embedded
     * in it (computer name, organization, paths, …) can never break out into
     * executable markup when assigned via innerHTML. Highlighting is then added
     * purely on top of the escaped sequences using fixed <span> wrappers, so no
     * user-supplied content can influence the injected HTML.
     * @param {string} xml
     * @returns {string} highlighted, safe HTML
     */
    highlightXML(xml) {
        const escaped = this.escapeHtml(xml);
        return escaped
            // comments first so their contents are not re-highlighted
            .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="xml-comment">$1</span>')
            // attribute="value" pairs (operates on escaped &quot; sequences)
            .replace(/([\w.:-]+)=(&quot;.*?&quot;)/g,
                '<span class="xml-attr">$1</span>=<span class="xml-value">$2</span>')
            // opening/closing tag names
            .replace(/(&lt;\/?)([\w.:-]+)/g, '$1<span class="xml-tag">$2</span>');
    },

    /**
     * Show notification with proper cleanup
     */
    showNotification(message, type = 'info', duration = 3000) {
        // Clean up any existing notification
        this.cleanupExistingNotification();
        
        // Create notification element
        const notification = document.createElement('div');
        const notificationId = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        notification.dataset.notificationId = notificationId;
        notification.className = `notification ${type}`;
        // message kann benutzer-/importgesteuerte Daten enthalten (z. B.
        // Importdateiname, Validierungsfehler mit Benutzernamen/Pfaden) und wird
        // hier per innerHTML eingefügt -> vor DOM-XSS schützen. Notifications
        // sind reiner Text, daher ist vollständiges Escapen unbedenklich.
        notification.innerHTML = `
            <span>${this.escapeHtml(message)}</span>
            <button class="notification-close" aria-label="Close">&times;</button>
        `;
        
        // Add to DOM
        document.body.appendChild(notification);
        
        // Setup close button
        const closeBtn = notification.querySelector('.notification-close');
        const closeHandler = () => this.dismissNotification(notificationId);
        closeBtn.addEventListener('click', closeHandler);
        
        // Trigger animation
        requestAnimationFrame(() => {
            notification.classList.add('show');
        });
        
        // Setup auto-dismiss timer
        const timers = {
            autoDismiss: null,
            fadeOut: null,
            remove: null,
            closeHandler: closeHandler
        };
        
        timers.autoDismiss = setTimeout(() => {
            this.dismissNotification(notificationId);
        }, duration);
        
        // Store timer reference
        this.notificationTimers.set(notificationId, timers);
        
        return notificationId;
    },
    
    /**
     * Dismiss notification with cleanup
     */
    dismissNotification(notificationId) {
        const notification = document.querySelector(`[data-notification-id="${notificationId}"]`);
        if (!notification) return;
        
        // Get and clear timers
        const timers = this.notificationTimers.get(notificationId);
        if (timers) {
            Object.values(timers).forEach(timer => {
                if (timer && typeof timer !== 'function') {
                    clearTimeout(timer);
                }
            });
        }
        
        // Start fade out animation
        notification.classList.add('fade-out');
        
        // Remove after animation
        const removeTimer = setTimeout(() => {
            notification.remove();
            this.notificationTimers.delete(notificationId);
        }, 300);
        
        // Update timer reference for cleanup
        if (timers) {
            timers.remove = removeTimer;
        }
    },
    
    /**
     * Clean up existing notification and its timers
     */
    cleanupExistingNotification() {
        const existing = document.querySelector('.notification:not(.static-notification)');
        if (existing) {
            const notificationId = existing.dataset.notificationId;
            if (notificationId) {
                this.dismissNotification(notificationId);
            } else {
                existing.remove();
            }
        }
    },
    
    /**
     * Show modal with stack management
     */
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) {
            console.error(`Modal with id '${modalId}' not found`);
            return;
        }
        
        // Add to stack
        this.modalStack.push(modalId);
        
        // Ensure modal is properly positioned before showing
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.zIndex = '9999';
        
        // Show modal with active class
        modal.classList.add('active');
        
        // Prevent body scrolling
        document.body.style.overflow = 'hidden';
        
        // Force reflow to ensure animation plays
        modal.offsetHeight;
        
        // Focus management
        this.trapFocus(modal);
        
        // Focus first focusable element after animation
        setTimeout(() => {
            // Try to focus close button first, then any input
            const closeBtn = modal.querySelector('.modal-close');
            const firstInput = modal.querySelector('input, select, textarea, button');
            if (closeBtn) {
                closeBtn.focus();
            } else if (firstInput) {
                firstInput.focus();
            }
        }, 100);
    },
    
    /**
     * Close modal with cleanup
     */
    closeModal(modalId) {
        const modal = modalId ? 
            document.getElementById(modalId) : 
            document.querySelector('.modal.active');
            
        if (modal) {
            modal.classList.remove('active');
            
            // Remove from stack
            const id = modal.id;
            this.modalStack = this.modalStack.filter(m => m !== id);
            
            // Restore body scroll if no more modals
            if (this.modalStack.length === 0) {
                document.body.style.overflow = '';
            }
            
            // Release focus trap
            this.releaseFocusTrap(modal);
        }
    },
    
    /**
     * Close all modals
     */
    closeAllModals() {
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
        });
        this.modalStack = [];
        document.body.style.overflow = '';
    },
    
    /**
     * Trap focus within element
     */
    trapFocus(element) {
        const focusableElements = element.querySelectorAll(
            'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select'
        );
        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];
        
        const trapHandler = (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    if (document.activeElement === firstFocusable) {
                        lastFocusable.focus();
                        e.preventDefault();
                    }
                } else {
                    if (document.activeElement === lastFocusable) {
                        firstFocusable.focus();
                        e.preventDefault();
                    }
                }
            }
        };
        
        element.addEventListener('keydown', trapHandler);
        element.dataset.focusTrapHandler = 'true';
        
        // Store handler for cleanup
        if (!element._focusTrapHandler) {
            element._focusTrapHandler = trapHandler;
        }
    },
    
    /**
     * Release focus trap
     */
    releaseFocusTrap(element) {
        if (element._focusTrapHandler) {
            element.removeEventListener('keydown', element._focusTrapHandler);
            delete element._focusTrapHandler;
            delete element.dataset.focusTrapHandler;
        }
    },
    
    /**
     * Create file input for file selection with cleanup
     */
    createFileInput(accept, callback) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        
        const changeHandler = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                
                reader.onload = (e) => {
                    callback(e.target.result, file);
                    // Cleanup
                    input.remove();
                    this.fileInputs.delete(input);
                };
                
                reader.onerror = (error) => {
                    console.error('File read error:', error);
                    this.showNotification('Failed to read file', 'error');
                    input.remove();
                    this.fileInputs.delete(input);
                };
                
                reader.readAsText(file);
            }
        };
        
        input.addEventListener('change', changeHandler);
        this.fileInputs.set(input, changeHandler);
        input.click();
    },
    
    /**
     * Download file
     */
    downloadFile(content, filename, mimeType = 'text/plain') {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        
        // Cleanup URL after download
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 100);
    },
    
    /**
     * Copy text to clipboard
     */
    async copyToClipboard(text) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                this.showNotification(LanguageManager.t('notifications.copied'), 'success');
                return true;
            } else {
                // Fallback for non-secure contexts
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'absolute';
                textarea.style.left = '-9999px';
                document.body.appendChild(textarea);
                textarea.select();
                
                try {
                    document.execCommand('copy');
                    this.showNotification(LanguageManager.t('notifications.copied'), 'success');
                    return true;
                } finally {
                    textarea.remove();
                }
            }
        } catch (error) {
            console.error('Failed to copy:', error);
            this.showNotification(LanguageManager.t('notifications.copyFailed'), 'error');
            return false;
        }
    },
    
    /**
     * Confirm dialog
     */
    confirm(message, title = 'Confirm') {
        // For now, use native confirm
        // Could be replaced with custom modal
        return window.confirm(message);
    },
    
    /**
     * Prompt dialog
     */
    prompt(message, defaultValue = '') {
        // For now, use native prompt
        // Could be replaced with custom modal
        return window.prompt(message, defaultValue);
    },
    
    /**
     * Alert dialog
     */
    alert(message, title = 'Alert') {
        window.alert(message);
    },
    
    /**
     * Toggle collapsible element
     */
    toggleCollapsible(header) {
        const content = header.nextElementSibling;
        if (content && content.classList.contains('collapsible-content')) {
            header.classList.toggle('active');
            content.classList.toggle('active');
            
            // Rotate icon if exists
            const icon = header.querySelector('.collapsible-icon');
            if (icon) {
                if (header.classList.contains('active')) {
                    icon.style.transform = 'rotate(180deg)';
                } else {
                    icon.style.transform = 'rotate(0)';
                }
            }
        }
    },
    
    /**
     * Set element visibility
     * CRITICAL: This function is required by wizard.js
     */
    setElementVisibility(elementId, visible) {
        const element = document.getElementById(elementId);
        if (element) {
            element.style.display = visible ? '' : 'none';
        }
    },
    
    /**
     * Set element value
     */
    setElementValue(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            if (element.type === 'checkbox') {
                element.checked = value;
            } else if (element.tagName === 'SELECT' && element.multiple) {
                const values = Array.isArray(value) ? value : [value];
                for (let option of element.options) {
                    option.selected = values.includes(option.value);
                }
            } else {
                element.value = value;
            }
        }
    },
    
    /**
     * Create loading spinner
     */
    createLoadingSpinner(containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = '<div class="spinner"></div>';
        }
    },
    
    /**
     * Remove loading spinner  
     */
    removeLoadingSpinner(containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            const spinner = container.querySelector('.spinner');
            if (spinner) {
                spinner.remove();
            }
        }
    },
    
    /**
     * Scroll to element
     */
    scrollToElement(elementId, behavior = 'smooth') {
        const element = document.getElementById(elementId);
        if (element) {
            element.scrollIntoView({ behavior: behavior, block: 'start' });
        }
    },
    
    /**
     * Get query parameters
     */
    getQueryParams() {
        const params = {};
        const queryString = window.location.search.substring(1);
        const pairs = queryString.split('&');
        
        for (const pair of pairs) {
            const [key, value] = pair.split('=');
            if (key) {
                params[decodeURIComponent(key)] = decodeURIComponent(value || '');
            }
        }
        
        return params;
    },
    
    /**
     * Generate UUID
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },
    
    /**
     * Deep clone object
     */
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (obj instanceof Object) {
            const clonedObj = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    clonedObj[key] = this.deepClone(obj[key]);
                }
            }
            return clonedObj;
        }
    },
    
    /**
     * Check if mobile device
     */
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },
    
    /**
     * Check if dark mode
     */
    isDarkMode() {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    },
    
    /**
     * Toggle dark mode
     */
    toggleDarkMode() {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('darkMode', isDark);
        return isDark;
    },
    
    /**
     * Initialize tooltips
     */
    initTooltips() {
        document.querySelectorAll('[data-tooltip]').forEach(element => {
            this.createTooltip(element, element.dataset.tooltip, element.dataset.tooltipPosition || 'top');
        });
    },
    
    /**
     * Create tooltip
     */
    createTooltip(element, text, position = 'top') {
        // Remove existing tooltip if any
        this.removeTooltip(element);
        
        const tooltip = document.createElement('div');
        tooltip.className = `tooltip tooltip-${position}`;
        tooltip.textContent = text;
        
        const showTooltip = () => {
            document.body.appendChild(tooltip);
            this.activeTooltips.add(tooltip);
            
            const rect = element.getBoundingClientRect();
            const tooltipRect = tooltip.getBoundingClientRect();
            
            let top = 0;
            let left = rect.left + (rect.width - tooltipRect.width) / 2;
            
            switch (position) {
                case 'top':
                    top = rect.top - tooltipRect.height - 8;
                    break;
                case 'bottom':
                    top = rect.bottom + 8;
                    break;
                case 'left':
                    top = rect.top + (rect.height - tooltipRect.height) / 2;
                    left = rect.left - tooltipRect.width - 8;
                    break;
                case 'right':
                    top = rect.top + (rect.height - tooltipRect.height) / 2;
                    left = rect.right + 8;
                    break;
            }
            
            tooltip.style.top = `${top}px`;
            tooltip.style.left = `${left}px`;
            tooltip.classList.add('visible');
        };
        
        const hideTooltip = () => {
            tooltip.classList.remove('visible');
            setTimeout(() => {
                if (tooltip.parentNode) {
                    tooltip.remove();
                    this.activeTooltips.delete(tooltip);
                }
            }, 200);
        };
        
        element.addEventListener('mouseenter', showTooltip);
        element.addEventListener('mouseleave', hideTooltip);
        
        // Store handlers for cleanup
        element._tooltipHandlers = { show: showTooltip, hide: hideTooltip };
    },
    
    /**
     * Remove tooltip
     */
    removeTooltip(element) {
        if (element._tooltipHandlers) {
            element.removeEventListener('mouseenter', element._tooltipHandlers.show);
            element.removeEventListener('mouseleave', element._tooltipHandlers.hide);
            delete element._tooltipHandlers;
        }
    },
    
    /**
     * Format file size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    },
    
    /**
     * Debounce function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    /**
     * Throttle function
     */
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    /**
     * Show spinner (alias for createLoadingSpinner)
     */
    showSpinner(containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            const spinner = document.createElement('div');
            spinner.className = 'spinner';
            spinner.innerHTML = '<div class="spinner-border"></div>';
            container.appendChild(spinner);
            return spinner;
        }
    },
    
    /**
     * Hide spinner
     */
    hideSpinner(spinner) {
        if (spinner && spinner.parentNode) {
            spinner.remove();
        }
    },
    
    /**
     * Validate form
     */
    validateForm(formElement) {
        const inputs = formElement.querySelectorAll('[required]');
        let isValid = true;
        
        inputs.forEach(input => {
            if (!input.value.trim()) {
                input.classList.add('error');
                isValid = false;
                
                // Show error message
                let errorMsg = input.nextElementSibling;
                if (!errorMsg || !errorMsg.classList.contains('error-message')) {
                    errorMsg = document.createElement('span');
                    errorMsg.className = 'error-message';
                    errorMsg.textContent = 'This field is required';
                    input.parentNode.insertBefore(errorMsg, input.nextSibling);
                }
            } else {
                input.classList.remove('error');
                const errorMsg = input.nextElementSibling;
                if (errorMsg && errorMsg.classList.contains('error-message')) {
                    errorMsg.remove();
                }
            }
        });
        
        return isValid;
    },
    
    /**
     * COMPREHENSIVE CLEANUP METHOD
     * Cleans up all UI helpers resources
     */
    cleanup() {
        // 1. Clear all notification timers
        this.notificationTimers.forEach((timers, notificationId) => {
            Object.values(timers).forEach(timer => {
                if (timer && typeof timer !== 'function') {
                    clearTimeout(timer);
                }
            });
            // Remove notification element
            const notification = document.querySelector(`[data-notification-id="${notificationId}"]`);
            if (notification) {
                notification.remove();
            }
        });
        this.notificationTimers.clear();
        
        // 2. Close all modals
        this.closeAllModals();
        
        // 3. Release all focus traps
        document.querySelectorAll('[data-focus-trap-handler]').forEach(element => {
            this.releaseFocusTrap(element);
        });
        
        // 4. Remove all tooltips
        this.activeTooltips.forEach(tooltip => {
            if (tooltip.parentNode) {
                tooltip.remove();
            }
        });
        this.activeTooltips.clear();
        
        // 5. Remove tooltip handlers
        document.querySelectorAll('[data-tooltip]').forEach(element => {
            this.removeTooltip(element);
        });
        
        // 6. Clear modal stack
        this.modalStack = [];
    },

    /**
     * Icon-Map fuer Setting-Zeilen (Settings-Stil).
     * SVGs sind statisch und Inline – kein User-Input → kein XSS-Risiko.
     */
    _rowIcons: {
        gear:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
        doc:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
        key:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg>',
        monitor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
        user:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
        building:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01"/></svg>',
        clock:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
        globe:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/></svg>',
        shield:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
        mic:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>',
        cloud:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19a4.5 4.5 0 1 0 0-9h-1.3A8 8 0 1 0 4 16.25"/></svg>',
        pin:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
        eye:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
        wifi:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>',
        code:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
        cpu:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="2" x2="9" y2="4"/><line x1="15" y1="2" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="22"/><line x1="15" y1="20" x2="15" y2="22"/><line x1="20" y1="9" x2="22" y2="9"/><line x1="20" y1="14" x2="22" y2="14"/><line x1="2" y1="9" x2="4" y2="9"/><line x1="2" y1="14" x2="4" y2="14"/></svg>',
        image:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
        idcard:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M14 8h4M14 12h3M14 16h-9"/></svg>',
        zap:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
        server:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>',
        window:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="12" y1="3" x2="12" y2="21"/></svg>',
        puzzle:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19.4 7.9c0 .3.1.6.3.8l1.6 1.6c.5.5.7 1.1.7 1.7s-.2 1.2-.7 1.7l-1.6 1.6c-.2.2-.5.3-.8.3-.5-.1-.8-.5-1-.9a2.5 2.5 0 1 0-3.2 3.2c.4.2.8.5.9 1 0 .3-.1.6-.3.8L13.7 21c-.5.5-1.1.7-1.7.7s-1.2-.2-1.7-.7L8.7 19.4c-.2-.2-.5-.3-.9-.3-.5.1-.8.5-1 .9a2.5 2.5 0 1 1-3.2-3.2c.4-.2.9-.5 1-1 0-.3-.1-.6-.3-.8L2.7 13.7C2.2 13.2 2 12.6 2 12s.2-1.2.7-1.7l1.5-1.5c.2-.2.6-.4.9-.3.5.1.9.5 1.1 1a2.5 2.5 0 1 0 3.3-3.2c-.5-.2-.9-.6-1-1 0-.3.1-.6.3-.9l1.5-1.5c.5-.5 1.1-.7 1.7-.7s1.2.2 1.7.7l1.6 1.6c.2.2.6.3.9.3.5-.1.8-.5 1-1a2.5 2.5 0 1 1 3.2 3.3c-.5.2-.9.5-1 1z"/></svg>'
    },

    /**
     * Bestimmt das Icon-Key fuer einen Label-Text per Schluesselwort-Map.
     */
    _iconKeyFor(text) {
        const t = (text || '').toLowerCase();
        const rules = [
            [/telemetr|datenschutz|privacy|sicherheit/, 'shield'],
            [/cortana/, 'mic'],
            [/onedrive|online.{0,2}konto|online.{0,2}account/, 'cloud'],
            [/standort|location/, 'pin'],
            [/werbe|advertis|ad[- ]id/, 'eye'],
            [/wlan|wifi/, 'wifi'],
            [/eula|lizenz|license/, 'doc'],
            [/wins|\bdns\b|name.?server/, 'server'],
            [/ipv6|netzwerk|network|adapter/, 'globe'],
            [/lokales.{0,2}konto|local.{0,2}account|benutzer|user|besitzer|owner|konto/, 'user'],
            [/schl[uü]ssel|product.?key|\bkey\b/, 'key'],
            [/computername|hostname/, 'monitor'],
            [/architekt|amd64|arm64|architecture/, 'cpu'],
            [/treiber|driver/, 'cpu'],
            [/install.?image|image.?index|\bimage\b/, 'image'],
            [/lockscreen|bildschirm|branding|wallpaper|hintergrund/, 'image'],
            [/sprache|language|locale|tastatur|keyboard/, 'globe'],
            [/zeit|time|zone|stunde|task|aufgabe|geplant|schedule/, 'clock'],
            [/organisation|firm|company|hersteller/, 'building'],
            [/dom[aä]ne|domain|workgroup/, 'building'],
            [/express|schnell|fast/, 'zap'],
            [/skript|script|powershell|batch|\bcmd\b/, 'code'],
            [/gpupdate|richtlinie|policy/, 'shield'],
            [/feature|funktion|optional/, 'puzzle'],
            [/oem|registr/, 'idcard'],
            [/version|windows|edition/, 'window']
        ];
        for (const [re, key] of rules) if (re.test(t)) return key;
        return 'gear';
    },

    /**
     * Fuegt jeder .form-group im Container ein passendes 28x28-Icon links ein
     * (vor dem Label/Control). Idempotent: ruft sich nicht doppelt auf.
     */
    applyRowIcons(container) {
        if (!container) return;
        const sel = '.card .form-group, .wizard-page > .form-group, .wizard-page .grid > .form-group';
        const groups = container.querySelectorAll(sel);
        for (const g of groups) {
            if (g.querySelector(':scope > .row-icon')) continue;
            const label = g.querySelector('.form-label, label');
            if (!label) continue;
            const key = this._iconKeyFor(label.textContent || '');
            const span = document.createElement('span');
            span.className = 'row-icon';
            span.setAttribute('aria-hidden', 'true');
            // statisches SVG aus interner Map – kein User-Input
            span.innerHTML = this._rowIcons[key] || this._rowIcons.gear;
            g.insertBefore(span, g.firstChild);
        }
    }
};

// Make available globally for compatibility
window.UIHelpers = UIHelpers;