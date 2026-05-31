/**
 * @description Componente LWC de menú de usuario para Experience Cloud.
 *              Muestra un desplegable con opciones de perfil, contratación
 *              y cierre de sesión. Al abrir el perfil se muestra un modal
 *              con los datos completos del usuario, su cuenta y cámaras.
 * @author      OptiSecure Solutions
 * @date        2026-03-06
 */
import { LightningElement, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

import getUserProfileData from '@salesforce/apex/UserMenuController.getUserProfileData';
import deleteCamera from '@salesforce/apex/UserMenuController.deleteCamera';
import renameCamera from '@salesforce/apex/UserMenuController.renameCamera';
import createSolicitudCamara from '@salesforce/apex/UserMenuController.createSolicitudCamara';
import saveFloorPlan from '@salesforce/apex/FloorPlanController.saveFloorPlan';

// Tamaño máximo permitido para el plano (4 MB)
const MAX_FLOOR_PLAN_SIZE = 4 * 1024 * 1024;
const ACCEPTED_FLOOR_PLAN_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/bmp'];
// Evento global emitido al guardar para que houseSecurityMap recargue el plano
const FLOOR_PLAN_UPDATED_EVENT = 'optisecurefloorplanupdated';

// URL de logout estándar de Salesforce con redirección al sitio público
const LOGOUT_URL = '/secur/logout.jsp?retUrl=https://www.optisecure-solutions.com';

export default class CustomUserMenu extends NavigationMixin(LightningElement) {

    // ── State ──
    @track profileData = null;
    @track profileError = null;
    @track isProfileModalOpen = false;
    @track isDeleting = false;
    @track editingCameraId = null;
    @track editingCameraName = '';
    @track isRenaming = false;
    @track isLoadingProfile = false;

    // ── Contract modal state ──
    @track isContractModalOpen = false;
    @track contractRows = [
        { id: '1', label: 'Cámara 1', name: '', location: '', showRemove: false }
    ];
    _contractCounter = 1;

    // ── Floor plan modal state ──
    @track isFloorPlanModalOpen = false;
    @track floorPlanPreviewUrl = null;
    @track floorPlanFileName = '';
    @track floorPlanFileSizeLabel = '';
    @track floorPlanError = '';
    @track isFloorPlanDragOver = false;
    @track isSavingFloorPlan = false;
    _floorPlanBase64 = null;
    _floorPlanContentType = null;

    // ═══════════════════════════════════════════
    //  LIFECYCLE
    // ═══════════════════════════════════════════

    _globalStyleEl = null;

    connectedCallback() {
        this.loadProfile();
    }

    disconnectedCallback() {
        this._removeGlobalOverlay();
    }

    _applyGlobalOverlay() {
        if (this._globalStyleEl) return;
        const style = document.createElement('style');
        style.setAttribute('data-profile-overlay', 'true');
        style.textContent = `
            c-custom-user-menu {
                z-index: 999999 !important;
                position: relative !important;
            }
            c-house-security-map,
            c-camara,
            c-web-cam,
            c-voice-assistant,
            c-camera-incident-report,
            c-camera-contract-request {
                z-index: 0 !important;
                position: relative !important;
            }
        `;
        document.head.appendChild(style);
        this._globalStyleEl = style;
    }

    _removeGlobalOverlay() {
        if (this._globalStyleEl) {
            this._globalStyleEl.remove();
            this._globalStyleEl = null;
        }
    }

    /** Carga los datos de perfil de forma imperativa (sin caché). */
    loadProfile() {
        this.isLoadingProfile = true;
        getUserProfileData()
            .then((data) => {
                this.profileData  = data;
                this.profileError = null;
            })
            .catch((error) => {
                this.profileData  = null;
                this.profileError = error;
                console.error('Error al cargar perfil:', JSON.stringify(error));
            })
            .finally(() => {
                this.isLoadingProfile = false;
            });
    }

    // ═══════════════════════════════════════════
    //  GETTERS — Propiedades computadas para el UI
    // ═══════════════════════════════════════════

    get hasAccountData() {
        return this.profileData && this.profileData.accountName;
    }

    get isAdmin() {
        return this.profileData && this.profileData.isAdmin;
    }

    get hasCameras() {
        return this.profileData && this.profileData.cameras && this.profileData.cameras.length > 0;
    }

    get cameraList() {
        if (!this.profileData || !this.profileData.cameras) return [];
        return this.profileData.cameras.map(cam => ({
            ...cam,
            statusClass: cam.active ? 'cam-status-dot cam-dot-active' : 'cam-status-dot cam-dot-inactive',
            statusLabel: cam.active ? 'Activa' : 'Inactiva',
            isEditing: this.editingCameraId === cam.id
        }));
    }

    get slaBadgeClass() {
        if (!this.profileData || !this.profileData.sla) return 'profile-badge badge-default';
        const sla = this.profileData.sla.toLowerCase();
        if (sla === 'platinum') return 'profile-badge badge-platinum';
        if (sla === 'gold')     return 'profile-badge badge-gold';
        if (sla === 'silver')   return 'profile-badge badge-silver';
        if (sla === 'bronze')   return 'profile-badge badge-bronze';
        return 'profile-badge badge-default';
    }

    get activeBadgeClass() {
        if (!this.profileData) return 'profile-badge badge-default';
        return this.profileData.active === 'Yes'
            ? 'profile-badge badge-active'
            : 'profile-badge badge-inactive';
    }

    get activeLabel() {
        if (!this.profileData || !this.profileData.active) return 'Desconocido';
        return this.profileData.active === 'Yes' ? 'Activa' : 'Inactiva';
    }

    get priorityBadgeClass() {
        if (!this.profileData || !this.profileData.customerPriority) return 'profile-badge badge-default';
        const p = this.profileData.customerPriority.toLowerCase();
        if (p === 'high')   return 'profile-badge badge-priority-high';
        if (p === 'medium') return 'profile-badge badge-priority-medium';
        if (p === 'low')    return 'profile-badge badge-priority-low';
        return 'profile-badge badge-default';
    }

    get priorityLabel() {
        if (!this.profileData || !this.profileData.customerPriority) return '—';
        const map = { High: 'Alta', Medium: 'Media', Low: 'Baja' };
        return map[this.profileData.customerPriority] || this.profileData.customerPriority;
    }

    get formattedAddress() {
        if (!this.profileData) return null;
        const parts = [
            this.profileData.billingStreet,
            this.profileData.billingCity,
            this.profileData.billingState,
            this.profileData.billingPostalCode,
            this.profileData.billingCountry
        ].filter(Boolean);
        return parts.length > 0 ? parts.join(', ') : null;
    }

    get cameraPercentage() {
        if (!this.profileData || this.profileData.totalCameras === 0) return 0;
        return Math.round((this.profileData.activeCameras / this.profileData.totalCameras) * 100);
    }

    get cameraBarStyle() {
        return `width: ${this.cameraPercentage}%`;
    }

    // ═══════════════════════════════════════════
    //  HANDLERS
    // ═══════════════════════════════════════════

    /**
     * Gestiona la selección de un item del menú desplegable.
     */
    handleMenuSelect(event) {
        const selected = event.detail.value;

        switch (selected) {
            case 'profile':
                this.isProfileModalOpen = true;
                this._applyGlobalOverlay();
                break;

            case 'contract':
                this._contractCounter = 1;
                this.contractRows = [
                    { id: '1', label: 'Cámara 1', name: '', location: '', showRemove: false }
                ];
                this.isContractModalOpen = true;
                this._applyGlobalOverlay();
                break;

            case 'floorPlan':
                this._resetFloorPlanState();
                this.isFloorPlanModalOpen = true;
                this._applyGlobalOverlay();
                break;

            case 'logout':
                window.location.replace(LOGOUT_URL);
                break;

            default:
                break;
        }
    }

    /** Cierra el modal de perfil */
    handleCloseModal() {
        this.isProfileModalOpen = false;
        this._removeGlobalOverlay();
    }

    // ═══════════════════════════════════════════
    //  CONTRATACIÓN — Lógica del formulario
    // ═══════════════════════════════════════════

    get canAddMoreRows() {
        return this.contractRows.length < 5;
    }

    get isMaxRows() {
        return this.contractRows.length >= 5;
    }

    get isContractSubmitDisabled() {
        return this.contractRows.some(r => !r.name.trim() || !r.location.trim());
    }

    handleCloseContractModal() {
        this.isContractModalOpen = false;
        this._removeGlobalOverlay();
    }

    handleContractFieldChange(event) {
        const rowId = event.target.dataset.rowId;
        const field = event.target.dataset.field;
        const value = event.detail.value;
        this.contractRows = this.contractRows.map(row =>
            row.id === rowId ? { ...row, [field]: value } : row
        );
    }

    handleAddContractRow() {
        if (this.contractRows.length >= 5) return;
        this._contractCounter++;
        const newId = String(this._contractCounter);
        this.contractRows = [
            ...this.contractRows,
            {
                id: newId,
                label: `Cámara ${this.contractRows.length + 1}`,
                name: '',
                location: '',
                showRemove: true
            }
        ];
    }

    handleRemoveContractRow(event) {
        const rowId = event.currentTarget.dataset.rowId;
        this.contractRows = this.contractRows
            .filter(r => r.id !== rowId)
            .map((r, idx) => ({
                ...r,
                label: `Cámara ${idx + 1}`,
                showRemove: idx > 0
            }));
    }

    @track isSubmittingContract = false;

    handleSubmitContract() {
        const hasEmpty = this.contractRows.some(r => !r.name.trim() || !r.location.trim());
        if (hasEmpty) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Campos incompletos',
                    message: 'Rellena el nombre y lugar de todas las cámaras.',
                    variant: 'warning'
                })
            );
            return;
        }

        this.isSubmittingContract = true;
        const camerasPayload = this.contractRows.map(r => ({
            name: r.name.trim(),
            location: r.location.trim()
        }));

        createSolicitudCamara({ camerasJson: JSON.stringify(camerasPayload) })
            .then(() => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Solicitud enviada',
                        message: `Se ha registrado la solicitud de ${camerasPayload.length} cámara(s). Nos pondremos en contacto contigo.`,
                        variant: 'success'
                    })
                );
                this.isContractModalOpen = false;
                this._removeGlobalOverlay();
            })
            .catch(error => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error',
                        message: error.body ? error.body.message : 'Error al enviar la solicitud.',
                        variant: 'error'
                    })
                );
            })
            .finally(() => {
                this.isSubmittingContract = false;
            });
    }

    /** Elimina una cámara (solo admin) */
    handleDeleteCamera(event) {
        event.stopPropagation();
        const btn = event.currentTarget;
        const cameraId = btn.dataset.id;
        const cameraName = btn.dataset.name;
        if (!cameraId || this.isDeleting) return;

        // eslint-disable-next-line no-alert
        if (!confirm(`¿Estás seguro de que quieres eliminar la cámara "${cameraName}"?`)) {
            return;
        }

        this.isDeleting = true;
        deleteCamera({ cameraId })
            .then(() => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Cámara eliminada',
                        message: `"${cameraName}" ha sido eliminada correctamente.`,
                        variant: 'success'
                    })
                );
                this.loadProfile();
            })
            .catch(error => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error',
                        message: error.body ? error.body.message : 'Error al eliminar la cámara.',
                        variant: 'error'
                    })
                );
            })
            .finally(() => {
                this.isDeleting = false;
            });
    }

    handleStartRename(event) {
        event.stopPropagation();
        this.editingCameraId = event.currentTarget.dataset.id;
        this.editingCameraName = event.currentTarget.dataset.name;
    }

    handleRenameInputChange(event) {
        this.editingCameraName = event.detail.value;
    }

    handleCancelRename() {
        this.editingCameraId = null;
        this.editingCameraName = '';
    }

    handleConfirmRename() {
        const newName = this.editingCameraName ? this.editingCameraName.trim() : '';
        if (!newName) return;
        const cameraId = this.editingCameraId;
        this.isRenaming = true;
        renameCamera({ cameraId, newName })
            .then(() => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Nombre actualizado',
                        message: `La cámara se ha renombrado a "${newName}".`,
                        variant: 'success'
                    })
                );
                this.editingCameraId = null;
                this.editingCameraName = '';
                this.loadProfile();
            })
            .catch(error => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error',
                        message: error.body ? error.body.message : 'Error al renombrar la cámara.',
                        variant: 'error'
                    })
                );
            })
            .finally(() => {
                this.isRenaming = false;
            });
    }

    // ═══════════════════════════════════════════
    //  AÑADIR PLANO — Drag & drop / upload
    // ═══════════════════════════════════════════

    get floorPlanDropZoneClass() {
        return 'floor-plan-dropzone' + (this.isFloorPlanDragOver ? ' floor-plan-dropzone--over' : '');
    }

    get isSaveFloorPlanDisabled() {
        return this.isSavingFloorPlan || !this._floorPlanBase64;
    }

    _resetFloorPlanState() {
        this.floorPlanPreviewUrl    = null;
        this.floorPlanFileName      = '';
        this.floorPlanFileSizeLabel = '';
        this.floorPlanError         = '';
        this.isFloorPlanDragOver    = false;
        this.isSavingFloorPlan      = false;
        this._floorPlanBase64       = null;
        this._floorPlanContentType  = null;
    }

    handleCloseFloorPlanModal() {
        if (this.isSavingFloorPlan) return;
        this.isFloorPlanModalOpen = false;
        this._resetFloorPlanState();
        this._removeGlobalOverlay();
    }

    handleFloorPlanZoneClick(event) {
        // Evitar que el clic en el botón "Quitar" o el propio input reabra el selector
        if (event.target && (event.target.tagName === 'INPUT' || event.target.tagName === 'BUTTON')) {
            return;
        }
        const input = this.template.querySelector('.floor-plan-file-input');
        if (input) {
            // Reset value para permitir volver a seleccionar el mismo fichero
            input.value = null;
            input.click();
        }
    }

    handleFloorPlanDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        this.isFloorPlanDragOver = true;
    }

    handleFloorPlanDragLeave(event) {
        event.preventDefault();
        event.stopPropagation();
        this.isFloorPlanDragOver = false;
    }

    handleFloorPlanDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        this.isFloorPlanDragOver = false;

        const files = event.dataTransfer && event.dataTransfer.files;
        if (files && files.length > 0) {
            this._processFloorPlanFile(files[0]);
        }
    }

    handleFloorPlanFileChange(event) {
        const file = event.target.files && event.target.files[0];
        if (file) {
            this._processFloorPlanFile(file);
        }
    }

    handleFloorPlanClear(event) {
        if (event) {
            event.stopPropagation();
        }
        this._resetFloorPlanState();
    }

    _processFloorPlanFile(file) {
        this.floorPlanError = '';
        if (!file) return;

        const type = (file.type || '').toLowerCase();
        if (!ACCEPTED_FLOOR_PLAN_TYPES.includes(type)) {
            this.floorPlanError = 'Formato no válido. Sube una imagen (PNG, JPG, GIF, WEBP).';
            return;
        }

        if (file.size > MAX_FLOOR_PLAN_SIZE) {
            this.floorPlanError = `El archivo supera el tamaño máximo de 4 MB (actual: ${this._formatBytes(file.size)}).`;
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target.result; // data:<mime>;base64,<data>
            this.floorPlanPreviewUrl    = result;
            this.floorPlanFileName      = file.name;
            this.floorPlanFileSizeLabel = this._formatBytes(file.size);
            this._floorPlanContentType  = type;
            const commaIdx = result.indexOf(',');
            this._floorPlanBase64 = commaIdx >= 0 ? result.substring(commaIdx + 1) : result;
        };
        reader.onerror = () => {
            this.floorPlanError = 'No se ha podido leer el archivo.';
        };
        reader.readAsDataURL(file);
    }

    handleSaveFloorPlan() {
        if (!this._floorPlanBase64 || this.isSavingFloorPlan) return;

        this.isSavingFloorPlan = true;
        this.floorPlanError = '';

        saveFloorPlan({
            base64Data:  this._floorPlanBase64,
            contentType: this._floorPlanContentType,
            fileName:    this.floorPlanFileName
        })
            .then(() => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Plano actualizado',
                        message: 'Tu nuevo plano se ha guardado correctamente.',
                        variant: 'success'
                    })
                );
                // Avisar a houseSecurityMap (y a cualquier otro listener)
                // para que recargue la imagen del plano sin refrescar la página.
                try {
                    window.dispatchEvent(new CustomEvent(FLOOR_PLAN_UPDATED_EVENT));
                } catch (e) {
                    // ignore
                }
                this.isFloorPlanModalOpen = false;
                this._resetFloorPlanState();
                this._removeGlobalOverlay();
            })
            .catch((error) => {
                const msg = error && error.body && error.body.message
                    ? error.body.message
                    : 'No se ha podido guardar el plano.';
                this.floorPlanError = msg;
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error',
                        message: msg,
                        variant: 'error'
                    })
                );
            })
            .finally(() => {
                this.isSavingFloorPlan = false;
            });
    }

    _formatBytes(bytes) {
        if (bytes === undefined || bytes === null) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
}
