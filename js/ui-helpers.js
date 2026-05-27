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
        
        console.log(`Modal '${modalId}' opened`);
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
        console.log('Cleaning up UI helpers...');
        
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
        
        console.log('UI helpers cleanup completed');
    }
};

// Make available globally for compatibility
window.UIHelpers = UIHelpers;