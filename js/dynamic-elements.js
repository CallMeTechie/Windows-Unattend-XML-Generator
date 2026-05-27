/**
 * Dynamic Elements Handler
 * Manages dynamic form elements (partitions, users, software, etc.)
 * Multi-language version - COMPLETE IMPLEMENTATION
 */

import { ConfigManager } from './config.js';
import { UIHelpers } from './ui-helpers.js';
import { LanguageManager } from './language-manager.js';

export const DynamicElements = {
    // Monoton steigender Zähler für eindeutige Element-IDs. Date.now() allein
    // kollidiert, wenn mehrere Items in derselben Millisekunde erzeugt werden
    // (z. B. beim Laden gespeicherter Konfigurationen über loadFromConfig).
    _uidCounter: 0,

    /**
     * Liefert eine im Dokument eindeutige ID-Basis für ein neues Item.
     */
    uniqueId() {
        return `${Date.now()}-${++this._uidCounter}`;
    },

    /**
     * Initialize dynamic elements
     */
    init() {
        this.attachGlobalListeners();
    },

    /**
     * Attach global listeners for dynamic elements
     */
    attachGlobalListeners() {
        // Delegate click events for dynamically added remove buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-btn') || e.target.parentElement?.classList.contains('remove-btn')) {
                const item = e.target.closest('.partition-item, .user-item, .software-item, .script-item, .driver-item, .feature-item');
                if (item) {
                    this.removeItem(item);
                }
            }
        });
    },

    /**
     * Add partition element
     */
    addPartition(containerId = 'partitionList') {
        const lang = window.LanguageManager || { t: (key) => key };
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn(`Container ${containerId} not found`);
            return;
        }

        const partitionId = this.uniqueId();
        const partitionHTML = `
            <div class="partition-item" data-id="${partitionId}">
                <h4>Partition ${this.getItemCount(container, '.partition-item') + 1}</h4>
                <div class="grid grid-3">
                    <div class="form-group">
                        <label class="form-label" for="type-${partitionId}">${lang.t('fields.type')}</label>
                        <select class="form-control" id="type-${partitionId}" name="type-${partitionId}" data-field="type">
                            <option value="primary">Primary</option>
                            <option value="efi">EFI System</option>
                            <option value="msr">MSR</option>
                            <option value="recovery">Recovery</option>
                            <option value="extended">Extended</option>
                            <option value="logical">Logical</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="size-${partitionId}">${lang.t('fields.size')} (MB)</label>
                        <input type="number" class="form-control" id="size-${partitionId}" name="size-${partitionId}" data-field="size" placeholder="${lang.t('hints.sizeHint')}">
                        <div class="form-hint">0 = Use remaining space</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="filesystem-${partitionId}">${lang.t('fields.filesystem')}</label>
                        <select class="form-control" id="filesystem-${partitionId}" name="filesystem-${partitionId}" data-field="filesystem">
                            <option value="ntfs">NTFS</option>
                            <option value="fat32">FAT32</option>
                            <option value="exfat">exFAT</option>
                            <option value="refs">ReFS</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="label-${partitionId}">${lang.t('fields.label')}</label>
                        <input type="text" class="form-control" id="label-${partitionId}" name="label-${partitionId}" data-field="label" placeholder="${lang.t('placeholders.label')}">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="letter-${partitionId}">${lang.t('fields.driveLetter')}</label>
                        <select class="form-control" id="letter-${partitionId}" name="letter-${partitionId}" data-field="letter">
                            <option value="">Auto</option>
                            ${this.getDriveLetterOptions()}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="active-${partitionId}">
                            <input type="checkbox" id="active-${partitionId}" name="active-${partitionId}" data-field="active" checked> Active Partition
                        </label>
                    </div>
                </div>
                <button class="btn btn-secondary remove-btn" data-type="partition">
                    ❌ ${lang.t('buttons.remove')}
                </button>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', partitionHTML);
        this.savePartitions();
        
        UIHelpers.showNotification(lang.t('notifications.partitionAdded'), 'success');
    },

    /**
     * Add user element
     */
    addUser(containerId = 'userList') {
        const lang = window.LanguageManager || { t: (key) => key };
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn(`Container ${containerId} not found`);
            return;
        }

        const userId = this.uniqueId();
        const userHTML = `
            <div class="user-item" data-id="${userId}">
                <h4>User ${this.getItemCount(container, '.user-item') + 1}</h4>
                <div class="grid grid-2">
                    <div class="form-group">
                        <label class="form-label" for="username-${userId}">${lang.t('fields.username')}</label>
                        <input type="text" class="form-control" id="username-${userId}" name="username-${userId}" data-field="username" 
                               autocomplete="username" placeholder="${lang.t('placeholders.username')}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="password-${userId}">${lang.t('fields.password')}</label>
                        <input type="password" class="form-control" id="password-${userId}" name="password-${userId}" data-field="password" 
                               autocomplete="new-password" placeholder="${lang.t('placeholders.password')}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="fullname-${userId}">${lang.t('fields.fullName')}</label>
                        <input type="text" class="form-control" id="fullname-${userId}" name="fullname-${userId}" data-field="fullname" 
                               autocomplete="name" placeholder="${lang.t('placeholders.fullname')}">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="description-${userId}">${lang.t('fields.description')}</label>
                        <input type="text" class="form-control" id="description-${userId}" name="description-${userId}" data-field="description" 
                               autocomplete="off" placeholder="${lang.t('placeholders.description')}">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="group-${userId}">${lang.t('fields.group')}</label>
                        <select class="form-control" id="group-${userId}" name="group-${userId}" data-field="group">
                            <option value="users">${lang.t('options.userGroups.users')}</option>
                            <option value="administrators">${lang.t('options.userGroups.administrators')}</option>
                            <option value="powerusers">${lang.t('options.userGroups.powerusers')}</option>
                            <option value="remotedesktop">${lang.t('options.userGroups.remotedesktop')}</option>
                            <option value="guests">Guests</option>
                            <option value="backup">Backup Operators</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="autologon-${userId}">
                            <input type="checkbox" id="autologon-${userId}" name="autologon-${userId}" data-field="autologon"> Enable Auto-logon for this user
                        </label>
                    </div>
                    <div class="form-group">
                        <label for="passwordNeverExpires-${userId}">
                            <input type="checkbox" id="passwordNeverExpires-${userId}" name="passwordNeverExpires-${userId}" data-field="passwordNeverExpires" checked> 
                            Password Never Expires
                        </label>
                    </div>
                    <div class="form-group">
                        <label for="disableAccount-${userId}">
                            <input type="checkbox" id="disableAccount-${userId}" name="disableAccount-${userId}" data-field="disableAccount"> 
                            Account Disabled Initially
                        </label>
                    </div>
                </div>
                <button class="btn btn-secondary remove-btn" data-type="user">
                    ❌ ${lang.t('buttons.remove')}
                </button>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', userHTML);
        this.saveUsers();
        
        UIHelpers.showNotification(lang.t('notifications.userAdded'), 'success');
    },

    /**
     * Add software element
     */
    addSoftware(containerId = 'softwareList') {
        const lang = window.LanguageManager || { t: (key) => key };
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn(`Container ${containerId} not found`);
            return;
        }

        const softwareId = this.uniqueId();
        const softwareHTML = `
            <div class="software-item" data-id="${softwareId}">
                <h4>Software Package ${this.getItemCount(container, '.software-item') + 1}</h4>
                <div class="grid grid-2">
                    <div class="form-group">
                        <label class="form-label" for="name-${softwareId}">${lang.t('fields.softwareName')}</label>
                        <input type="text" class="form-control" id="name-${softwareId}" name="name-${softwareId}" data-field="name" 
                               placeholder="${lang.t('placeholders.softwareName')}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="type-${softwareId}">Package Type</label>
                        <select class="form-control" id="type-${softwareId}" name="type-${softwareId}" data-field="type">
                            <option value="msi">MSI Package</option>
                            <option value="exe">EXE Installer</option>
                            <option value="appx">AppX/MSIX Package</option>
                            <option value="script">Script/Batch</option>
                            <option value="zip">ZIP Archive</option>
                        </select>
                    </div>
                    <div class="form-group" style="grid-column: span 2;">
                        <label class="form-label" for="path-${softwareId}">${lang.t('fields.installPath')}</label>
                        <input type="text" class="form-control" id="path-${softwareId}" name="path-${softwareId}" data-field="path" 
                               placeholder="${lang.t('placeholders.softwarePath')}" required>
                    </div>
                    <div class="form-group" style="grid-column: span 2;">
                        <label class="form-label" for="arguments-${softwareId}">${lang.t('fields.arguments')}</label>
                        <input type="text" class="form-control" id="arguments-${softwareId}" name="arguments-${softwareId}" data-field="arguments" 
                               placeholder="${lang.t('placeholders.arguments')}">
                        <div class="form-hint">Silent install switches: /quiet /norestart (MSI) or /S (EXE)</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="order-${softwareId}">${lang.t('fields.order')}</label>
                        <input type="number" class="form-control" id="order-${softwareId}" name="order-${softwareId}" data-field="order" value="1" min="1">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="phase-${softwareId}">Install Phase</label>
                        <select class="form-control" id="phase-${softwareId}" name="phase-${softwareId}" data-field="phase">
                            <option value="firstlogon">First Logon</option>
                            <option value="specialize">Specialize</option>
                            <option value="audit">Audit Mode</option>
                            <option value="oobe">OOBE</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="rebootAfter-${softwareId}">
                            <input type="checkbox" id="rebootAfter-${softwareId}" name="rebootAfter-${softwareId}" data-field="rebootAfter"> 
                            Reboot After Installation
                        </label>
                    </div>
                    <div class="form-group">
                        <label for="continueOnError-${softwareId}">
                            <input type="checkbox" id="continueOnError-${softwareId}" name="continueOnError-${softwareId}" data-field="continueOnError" checked> 
                            Continue On Error
                        </label>
                    </div>
                </div>
                <button class="btn btn-secondary remove-btn" data-type="software">
                    ❌ ${lang.t('buttons.remove')}
                </button>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', softwareHTML);
        this.saveSoftware();
        
        UIHelpers.showNotification(lang.t('notifications.softwareAdded'), 'success');
    },

    /**
     * Add script element
     */
    addScript(containerId = 'scriptList') {
        const lang = window.LanguageManager || { t: (key) => key };
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn(`Container ${containerId} not found`);
            return;
        }

        const scriptId = this.uniqueId();
        const scriptHTML = `
            <div class="script-item" data-id="${scriptId}">
                <h4>Script ${this.getItemCount(container, '.script-item') + 1}</h4>
                <div class="grid grid-2">
                    <div class="form-group">
                        <label class="form-label" for="script-name-${scriptId}">Script Name</label>
                        <input type="text" class="form-control" id="script-name-${scriptId}" name="script-name-${scriptId}" data-field="name" 
                               placeholder="Configure System Settings" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="script-phase-${scriptId}">Execution Phase</label>
                        <select class="form-control" id="script-phase-${scriptId}" name="script-phase-${scriptId}" data-field="phase">
                            <option value="windowsPE">WindowsPE</option>
                            <option value="offlineServicing">Offline Servicing</option>
                            <option value="specialize">Specialize</option>
                            <option value="auditSystem">Audit System</option>
                            <option value="auditUser">Audit User</option>
                            <option value="oobeSystem">OOBE System</option>
                            <option value="firstLogon">First Logon</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="script-type-${scriptId}">${lang.t('fields.scriptType')}</label>
                        <select class="form-control" id="script-type-${scriptId}" name="script-type-${scriptId}" data-field="type">
                            <option value="cmd">CMD/Batch</option>
                            <option value="powershell">PowerShell</option>
                            <option value="vbs">VBScript</option>
                            <option value="js">JavaScript/WSH</option>
                            <option value="exe">Executable</option>
                            <option value="reg">Registry File</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="script-context-${scriptId}">Execution Context</label>
                        <select class="form-control" id="script-context-${scriptId}" name="script-context-${scriptId}" data-field="context">
                            <option value="system">System</option>
                            <option value="user">User</option>
                            <option value="elevated">Elevated</option>
                        </select>
                    </div>
                    <div class="form-group" style="grid-column: span 2;">
                        <label class="form-label" for="script-command-${scriptId}">${lang.t('fields.commandPath')}</label>
                        <input type="text" class="form-control" id="script-command-${scriptId}" name="script-command-${scriptId}" data-field="command" 
                               placeholder="${lang.t('placeholders.scriptCommand')}" required>
                    </div>
                    <div class="form-group" style="grid-column: span 2;">
                        <label class="form-label" for="script-content-${scriptId}">Script Content (Optional - Inline Script)</label>
                        <textarea class="form-control" id="script-content-${scriptId}" name="script-content-${scriptId}" data-field="content" rows="4" 
                                  placeholder="# PowerShell script content here..."></textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="script-order-${scriptId}">${lang.t('fields.order')}</label>
                        <input type="number" class="form-control" id="script-order-${scriptId}" name="script-order-${scriptId}" data-field="order" value="1" min="1">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="script-timeout-${scriptId}">Timeout (seconds)</label>
                        <input type="number" class="form-control" id="script-timeout-${scriptId}" name="script-timeout-${scriptId}" data-field="timeout" value="300" min="0">
                        <div class="form-hint">0 = No timeout</div>
                    </div>
                    <div class="form-group">
                        <label for="async-${scriptId}">
                            <input type="checkbox" id="async-${scriptId}" name="async-${scriptId}" data-field="async"> Run Asynchronously
                        </label>
                    </div>
                    <div class="form-group">
                        <label for="hidden-${scriptId}">
                            <input type="checkbox" id="hidden-${scriptId}" name="hidden-${scriptId}" data-field="hidden" checked> Run Hidden
                        </label>
                    </div>
                </div>
                <button class="btn btn-secondary remove-btn" data-type="script">
                    ❌ ${lang.t('buttons.remove')}
                </button>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', scriptHTML);
        this.saveScripts();
        
        UIHelpers.showNotification(lang.t('notifications.scriptAdded'), 'success');
    },

    /**
     * Add driver element
     */
    addDriver(containerId = 'driverList') {
        const lang = window.LanguageManager || { t: (key) => key };
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn(`Container ${containerId} not found`);
            return;
        }

        const driverId = this.uniqueId();
        const driverHTML = `
            <div class="driver-item" data-id="${driverId}">
                <h4>Driver ${this.getItemCount(container, '.driver-item') + 1}</h4>
                <div class="grid grid-2">
                    <div class="form-group">
                        <label class="form-label" for="driver-name-${driverId}">Driver Name</label>
                        <input type="text" class="form-control" id="driver-name-${driverId}" name="driver-name-${driverId}" data-field="name" 
                               placeholder="Intel Network Adapter" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="driver-type-${driverId}">Driver Type</label>
                        <select class="form-control" id="driver-type-${driverId}" name="driver-type-${driverId}" data-field="type">
                            <option value="network">Network</option>
                            <option value="storage">Storage Controller</option>
                            <option value="chipset">Chipset</option>
                            <option value="graphics">Graphics</option>
                            <option value="audio">Audio</option>
                            <option value="usb">USB Controller</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    <div class="form-group" style="grid-column: span 2;">
                        <label class="form-label" for="driver-infPath-${driverId}">INF File Path</label>
                        <input type="text" class="form-control" id="driver-infPath-${driverId}" name="driver-infPath-${driverId}" data-field="infPath" 
                               placeholder="\\\\server\\drivers\\network\\e1000.inf" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="driver-hardwareId-${driverId}">Hardware ID (Optional)</label>
                        <input type="text" class="form-control" id="driver-hardwareId-${driverId}" name="driver-hardwareId-${driverId}" data-field="hardwareId" 
                               placeholder="PCI\\VEN_8086&DEV_100E">
                        <div class="form-hint">Leave empty to install for all matching devices</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="driver-phase-${driverId}">Installation Phase</label>
                        <select class="form-control" id="driver-phase-${driverId}" name="driver-phase-${driverId}" data-field="phase">
                            <option value="windowsPE">WindowsPE (Critical)</option>
                            <option value="offlineServicing">Offline Servicing</option>
                            <option value="specialize">Specialize</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="critical-${driverId}">
                            <input type="checkbox" id="critical-${driverId}" name="critical-${driverId}" data-field="critical"> 
                            Critical Driver (Required for boot)
                        </label>
                    </div>
                    <div class="form-group">
                        <label for="forceInstall-${driverId}">
                            <input type="checkbox" id="forceInstall-${driverId}" name="forceInstall-${driverId}" data-field="forceInstall"> 
                            Force Install (Even if newer exists)
                        </label>
                    </div>
                </div>
                <button class="btn btn-secondary remove-btn" data-type="driver">
                    ❌ ${lang.t('buttons.remove')}
                </button>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', driverHTML);
        this.saveDrivers();
        
        UIHelpers.showNotification(lang.t('notifications.driverAdded'), 'success');
    },

    /**
     * Add scheduled task element
     */
    addTask(containerId = 'taskList') {
        const lang = window.LanguageManager || { t: (key) => key };
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn(`Container ${containerId} not found`);
            return;
        }

        const taskId = this.uniqueId();
        const taskHTML = `
            <div class="task-item" data-id="${taskId}">
                <h4>Scheduled Task ${this.getItemCount(container, '.task-item') + 1}</h4>
                <div class="grid grid-2">
                    <div class="form-group">
                        <label class="form-label" for="task-name-${taskId}">${lang.t('fields.taskName')}</label>
                        <input type="text" class="form-control" id="task-name-${taskId}" name="task-name-${taskId}" data-field="name" 
                               placeholder="${lang.t('placeholders.taskName')}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="task-trigger-${taskId}">${lang.t('fields.trigger')}</label>
                        <select class="form-control" id="task-trigger-${taskId}" name="task-trigger-${taskId}" data-field="trigger">
                            <option value="startup">At System Startup</option>
                            <option value="logon">At User Logon</option>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="once">Once</option>
                            <option value="idle">On Idle</option>
                        </select>
                    </div>
                    <div class="form-group" style="grid-column: span 2;">
                        <label class="form-label" for="task-action-${taskId}">${lang.t('fields.action')}</label>
                        <input type="text" class="form-control" id="task-action-${taskId}" name="task-action-${taskId}" data-field="action" 
                               placeholder="${lang.t('placeholders.taskAction')}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="task-runAs-${taskId}">Run As User</label>
                        <input type="text" class="form-control" id="task-runAs-${taskId}" name="task-runAs-${taskId}" data-field="runAs" 
                               placeholder="SYSTEM" value="SYSTEM">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="task-startTime-${taskId}">Start Time</label>
                        <input type="time" class="form-control" id="task-startTime-${taskId}" name="task-startTime-${taskId}" data-field="startTime" value="00:00">
                    </div>
                    <div class="form-group">
                        <label for="runWithHighest-${taskId}">
                            <input type="checkbox" id="runWithHighest-${taskId}" name="runWithHighest-${taskId}" data-field="runWithHighest" checked> 
                            Run with highest privileges
                        </label>
                    </div>
                    <div class="form-group">
                        <label for="enabled-${taskId}">
                            <input type="checkbox" id="enabled-${taskId}" name="enabled-${taskId}" data-field="enabled" checked> 
                            Task Enabled
                        </label>
                    </div>
                </div>
                <button class="btn btn-secondary remove-btn" data-type="task">
                    ❌ ${lang.t('buttons.remove')}
                </button>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', taskHTML);
        this.saveTasks();
        
        UIHelpers.showNotification(lang.t('notifications.taskAdded'), 'success');
    },

    /**
     * Add feature element
     */
    addFeature(containerId = 'featureList') {
        const lang = window.LanguageManager || { t: (key) => key };
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn(`Container ${containerId} not found`);
            return;
        }

        const featureId = this.uniqueId();
        const featureHTML = `
            <div class="feature-item" data-id="${featureId}">
                <div class="grid grid-2">
                    <div class="form-group">
                        <label class="form-label" for="feature-name-${featureId}">Feature Name</label>
                        <input type="text" class="form-control" id="feature-name-${featureId}" name="feature-name-${featureId}" data-field="name" 
                               placeholder="Microsoft-Windows-Subsystem-Linux" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="feature-action-${featureId}">Action</label>
                        <select class="form-control" id="feature-action-${featureId}" name="feature-action-${featureId}" data-field="action">
                            <option value="enable">Enable</option>
                            <option value="disable">Disable</option>
                        </select>
                    </div>
                    <button class="btn btn-secondary remove-btn" data-type="feature">
                        ❌ ${lang.t('buttons.remove')}
                    </button>
                </div>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', featureHTML);
        this.saveFeatures();
        
        UIHelpers.showNotification(lang.t('notifications.featureAdded'), 'success');
    },

    /**
     * Remove item with confirmation
     */
    removeItem(item) {
        const lang = window.LanguageManager || { t: (key) => key };
        
        if (UIHelpers.confirm(lang.t('modals.confirm.deleteItem') || 'Remove this item?')) {
            const type = item.className.split('-')[0]; // partition, user, software, etc.
            item.remove();
            
            // Save the updated list
            switch(type) {
                case 'partition':
                    this.savePartitions();
                    break;
                case 'user':
                    this.saveUsers();
                    break;
                case 'software':
                    this.saveSoftware();
                    break;
                case 'script':
                    this.saveScripts();
                    break;
                case 'driver':
                    this.saveDrivers();
                    break;
                case 'task':
                    this.saveTasks();
                    break;
                case 'feature':
                    this.saveFeatures();
                    break;
            }
            
            UIHelpers.showNotification(lang.t('notifications.elementRemoved'), 'success');
        }
    },

    /**
     * Collect all dynamic data
     */
    collectDynamicData() {
        // Nur Item-Typen einbeziehen, deren Container im aktuell gerenderten
        // Tab/Schritt vorhanden ist. Wizard- und Pro-Modus rendern jeweils nur
        // EINEN Tab; Typen anderer (nicht gerenderter) Tabs dürfen NICHT mit []
        // überschrieben werden, sonst gehen sie verloren (Cross-Tab-Datenverlust).
        const present = (...ids) => ids.some(id => document.getElementById(id));
        const data = {};
        if (present('partitionList', 'pro-partitionList')) data.partitions = this.collectPartitions();
        if (present('userList', 'pro-userList')) data.users = this.collectUsers();
        if (present('softwareList', 'pro-softwareList')) data.softwarePackages = this.collectSoftware();
        if (present('scriptList', 'pro-scriptList')) data.scripts = this.collectScripts();
        if (present('driverList', 'pro-driverList')) data.drivers = this.collectDrivers();
        if (present('taskList', 'pro-taskList')) data.tasks = this.collectTasks();
        if (present('featureList')
            || document.querySelector('[id^="pro-feat-"], [id^="pro-role-"], [id^="feature-"]')) {
            data.features = this.collectFeatures();
        }
        return data;
    },

    /**
     * Collect partition data
     */
    collectPartitions() {
        const partitions = [];
        document.querySelectorAll('.partition-item').forEach(item => {
            const partition = {};
            item.querySelectorAll('[data-field]').forEach(field => {
                const key = field.dataset.field;
                if (field.type === 'checkbox') {
                    partition[key] = field.checked;
                } else {
                    partition[key] = field.value;
                }
            });
            if (partition.type) {
                partitions.push(partition);
            }
        });
        return partitions;
    },

    /**
     * Collect user data
     */
    collectUsers() {
        const users = [];
        document.querySelectorAll('.user-item').forEach(item => {
            const user = {};
            item.querySelectorAll('[data-field]').forEach(field => {
                const key = field.dataset.field;
                if (field.type === 'checkbox') {
                    user[key] = field.checked;
                } else {
                    user[key] = field.value;
                }
            });
            if (user.username && user.password) {
                users.push(user);
            }
        });
        return users;
    },

    /**
     * Collect software data
     */
    collectSoftware() {
        const software = [];
        document.querySelectorAll('.software-item').forEach(item => {
            const pkg = {};
            item.querySelectorAll('[data-field]').forEach(field => {
                const key = field.dataset.field;
                if (field.type === 'checkbox') {
                    pkg[key] = field.checked;
                } else {
                    pkg[key] = field.value;
                }
            });
            if (pkg.name && pkg.path) {
                software.push(pkg);
            }
        });
        return software;
    },

    /**
     * Collect script data
     */
    collectScripts() {
        const scripts = [];
        document.querySelectorAll('.script-item').forEach(item => {
            const script = {};
            item.querySelectorAll('[data-field]').forEach(field => {
                const key = field.dataset.field;
                if (field.type === 'checkbox') {
                    script[key] = field.checked;
                } else {
                    script[key] = field.value;
                }
            });
            if (script.command || script.content) {
                scripts.push(script);
            }
        });
        return scripts;
    },

    /**
     * Collect driver data
     */
    collectDrivers() {
        const drivers = [];
        document.querySelectorAll('.driver-item').forEach(item => {
            const driver = {};
            item.querySelectorAll('[data-field]').forEach(field => {
                const key = field.dataset.field;
                if (field.type === 'checkbox') {
                    driver[key] = field.checked;
                } else {
                    driver[key] = field.value;
                }
            });
            if (driver.name && driver.infPath) {
                drivers.push(driver);
            }
        });
        return drivers;
    },

    /**
     * Collect task data
     */
    collectTasks() {
        const tasks = [];
        document.querySelectorAll('.task-item').forEach(item => {
            const task = {};
            item.querySelectorAll('[data-field]').forEach(field => {
                const key = field.dataset.field;
                if (field.type === 'checkbox') {
                    task[key] = field.checked;
                } else {
                    task[key] = field.value;
                }
            });
            if (task.name && task.action) {
                tasks.push(task);
            }
        });
        return tasks;
    },

    /**
     * Collect feature data
     */
    collectFeatures() {
        const features = [];
        document.querySelectorAll('.feature-item').forEach(item => {
            const feature = {};
            item.querySelectorAll('[data-field]').forEach(field => {
                const key = field.dataset.field;
                if (field.type === 'checkbox') {
                    feature[key] = field.checked;
                } else {
                    feature[key] = field.value;
                }
            });
            if (feature.name) {
                features.push(feature);
            }
        });
        
        // Also collect checkbox features
        document.querySelectorAll('[id^="pro-feat-"], [id^="pro-role-"], [id^="feature-"]').forEach(checkbox => {
            if (checkbox.checked) {
                const featureName = checkbox.id.replace(/^(pro-feat-|pro-role-|feature-)/, '');
                features.push({
                    name: featureName,
                    action: 'enable',
                    checked: true
                });
            }
        });
        
        return features;
    },

    /**
     * Save partitions to config
     */
    savePartitions() {
        ConfigManager.updateConfig('partitions', this.collectPartitions());
    },

    /**
     * Save users to config
     */
    saveUsers() {
        ConfigManager.updateConfig('users', this.collectUsers());
    },

    /**
     * Save software to config
     */
    saveSoftware() {
        ConfigManager.updateConfig('softwarePackages', this.collectSoftware());
    },

    /**
     * Save scripts to config
     */
    saveScripts() {
        ConfigManager.updateConfig('scripts', this.collectScripts());
    },

    /**
     * Save drivers to config
     */
    saveDrivers() {
        ConfigManager.updateConfig('drivers', this.collectDrivers());
    },

    /**
     * Save tasks to config.
     *
     * Schlüssel "tasks" (nicht "scheduledTasks"): collectDynamicData(),
     * loadFromConfig() und der XML-Generator (generateFirstLogonCommands)
     * lesen alle config.tasks. Ein abweichender Schreib-Key ließ gespeicherte
     * Aufgaben beim Reload/Restore verschwinden.
     */
    saveTasks() {
        ConfigManager.updateConfig('tasks', this.collectTasks());
    },

    /**
     * Save features to config
     */
    saveFeatures() {
        ConfigManager.updateConfig('features', this.collectFeatures());
    },

    /**
     * Get count of items in container
     */
    getItemCount(container, selector) {
        return container.querySelectorAll(selector).length;
    },

    /**
     * Get available drive letters
     */
    getDriveLetterOptions() {
        const letters = 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
        return letters.map(letter => `<option value="${letter}">${letter}:</option>`).join('');
    },

    /**
     * Load dynamic elements from config
     */
    /**
     * Pre-fill the [data-field] elements of a freshly inserted item container
     * with values from `data`. This is the inverse of the collect* methods.
     *
     * Values are written via DOM properties (.value / .checked) only, NEVER via
     * innerHTML, so stored or imported values cannot inject markup (no XSS).
     *
     * @param {Element} item  the item container element
     * @param {Object}  data  field values keyed by data-field name
     */
    populateItem(item, data) {
        if (!item || !data || typeof data !== 'object') return;
        item.querySelectorAll('[data-field]').forEach(field => {
            const key = field.dataset.field;
            if (!(key in data)) return;
            if (field.type === 'checkbox') {
                field.checked = Boolean(data[key]);
            } else {
                field.value = data[key] != null ? data[key] : '';
            }
        });
    },

    /**
     * Load all saved dynamic items from the configuration back into their form
     * containers and pre-fill the fields. Containers that are not present in the
     * current mode (Wizard vs. Pro) are skipped, so this is safe to call after
     * any (re)render.
     */
    loadFromConfig() {
        const config = ConfigManager.getConfig();

        // [configKey, containerId, addFunction] for every dynamic item type.
        const sections = [
            ['partitions',       'partitionList', this.addPartition],
            ['users',            'userList',      this.addUser],
            ['softwarePackages', 'softwareList',  this.addSoftware],
            ['scripts',          'scriptList',    this.addScript],
            ['drivers',          'driverList',    this.addDriver],
            ['tasks',            'taskList',      this.addTask]
        ];

        sections.forEach(([key, containerId, addFn]) => {
            const items = config[key];
            const container = document.getElementById(containerId);
            if (!container || !Array.isArray(items) || items.length === 0) return;

            container.replaceChildren(); // leeren ohne innerHTML
            items.forEach(data => {
                addFn.call(this, containerId);
                // Fill the item that was just appended with its stored values.
                this.populateItem(container.lastElementChild, data);
            });
        });
    },

    /**
     * Validate dynamic elements
     */
    validateDynamicElements() {
        const errors = [];
        
        // Validate users
        document.querySelectorAll('.user-item').forEach((item, index) => {
            const username = item.querySelector('[data-field="username"]')?.value;
            const password = item.querySelector('[data-field="password"]')?.value;
            
            if (!username) {
                errors.push(`User ${index + 1}: Username is required`);
            }
            if (!password) {
                errors.push(`User ${index + 1}: Password is required`);
            }
            if (username && username.length > 20) {
                errors.push(`User ${index + 1}: Username must be 20 characters or less`);
            }
        });
        
        // Validate partitions
        document.querySelectorAll('.partition-item').forEach((item, index) => {
            const size = item.querySelector('[data-field="size"]')?.value;
            if (size && parseInt(size) < 0) {
                errors.push(`Partition ${index + 1}: Size cannot be negative`);
            }
        });
        
        return errors;
    }
};

// Auto-initialize when module loads
// Init is safe as it only sets up event listeners
DynamicElements.init();