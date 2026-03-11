/**
 * @description Componente LWC de menú de usuario para Experience Cloud.
 *              Muestra un desplegable con opciones de perfil, contratación
 *              y cierre de sesión. Al abrir el perfil se muestra un modal
 *              con los datos completos del usuario, su cuenta y cámaras.
 * @author      OptiSecure Solutions
 * @date        2026-03-06
 */
import { LightningElement, wire, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import getUserProfileData from '@salesforce/apex/UserMenuController.getUserProfileData';
import deleteCamera from '@salesforce/apex/UserMenuController.deleteCamera';

// URL de logout estándar de Salesforce con redirección al sitio público
const LOGOUT_URL = '/secur/logout.jsp?retUrl=https://www.optisecure-solutions.com';

export default class CustomUserMenu extends NavigationMixin(LightningElement) {

    // ── State ──
    @track profileData = null;
    @track profileError = null;
    @track isProfileModalOpen = false;
    @track isDeleting = false;
    _wiredProfileResult;

    // ═══════════════════════════════════════════
    //  WIRE — Datos de perfil del usuario actual
    // ═══════════════════════════════════════════

    @wire(getUserProfileData)
    wiredProfile(result) {
        this._wiredProfileResult = result;
        const { data, error } = result;
        if (data) {
            this.profileData  = data;
            this.profileError = null;
        } else if (error) {
            this.profileData  = null;
            this.profileError = error;
            console.error('Error al cargar perfil:', JSON.stringify(error));
        }
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
            statusLabel: cam.active ? 'Activa' : 'Inactiva'
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
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Contratación',
                        message: 'Redirigiendo a contratación de nuevas cámaras...',
                        variant: 'info'
                    })
                );
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
                return refreshApex(this._wiredProfileResult);
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
}
