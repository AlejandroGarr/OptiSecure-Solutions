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

    // ═══════════════════════════════════════════
    //  LIFECYCLE
    // ═══════════════════════════════════════════

    connectedCallback() {
        this.loadProfile();
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
                break;

            case 'contract':
                this._contractCounter = 1;
                this.contractRows = [
                    { id: '1', label: 'Cámara 1', name: '', location: '', showRemove: false }
                ];
                this.isContractModalOpen = true;
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
}
