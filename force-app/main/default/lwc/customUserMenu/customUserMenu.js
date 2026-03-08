/**
 * @description Componente LWC de menú de usuario para Experience Cloud.
 *              Muestra un desplegable con opciones de perfil, contratación
 *              y cierre de sesión. Al abrir el perfil se muestra un modal
 *              SLDS con los datos del usuario y sus cámaras contratadas.
 * @author      OptiSecure Solutions
 * @date        2026-03-06
 */
import { LightningElement, wire, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getUserProfileData from '@salesforce/apex/UserMenuController.getUserProfileData';

// URL de logout estándar de Salesforce con redirección al sitio público
const LOGOUT_URL = '/secur/logout.jsp?retUrl=https://www.optisecure-solutions.com';

export default class CustomUserMenu extends NavigationMixin(LightningElement) {

    // ── State ──
    @track profileData = null;
    @track profileError = null;
    @track isProfileModalOpen = false;

    // ═══════════════════════════════════════════
    //  WIRE — Datos de perfil del usuario actual
    // ═══════════════════════════════════════════

    @wire(getUserProfileData)
    wiredProfile({ data, error }) {
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
    //  HANDLERS
    // ═══════════════════════════════════════════

    /**
     * Gestiona la selección de un item del menú desplegable.
     * - profile:  abre el modal de perfil.
     * - contract: muestra un Toast informativo (futura implementación).
     * - logout:   redirige a la URL de logout de la comunidad.
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
}
