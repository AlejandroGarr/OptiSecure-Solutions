import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import crearSolicitud from '@salesforce/apex/ContratacionCamaraController.crearSolicitud';
import getMisSolicitudes from '@salesforce/apex/ContratacionCamaraController.getMisSolicitudes';

const BADGE_MAP = {
    'Pendiente':   'badge badge-pending',
    'En Revision': 'badge badge-review',
    'Aprobada':    'badge badge-approved',
    'Rechazada':   'badge badge-rejected',
    'Completada':  'badge badge-completed'
};

export default class CameraContractRequest extends LightningElement {

    @track isModalOpen = false;
    @track activeTab = 'nueva';
    @track numeroCamaras = 1;
    @track detalle = '';
    @track misSolicitudes = [];
    @track isLoadingSolicitudes = false;

    // ── Tabs ──
    get isTabNueva() { return this.activeTab === 'nueva'; }
    get isTabLista() { return this.activeTab === 'lista'; }

    get tabNuevaClass() {
        return 'tab-btn' + (this.activeTab === 'nueva' ? ' tab-btn--active' : '');
    }
    get tabListaClass() {
        return 'tab-btn' + (this.activeTab === 'lista' ? ' tab-btn--active' : '');
    }

    get hasSolicitudes() {
        return this.misSolicitudes && this.misSolicitudes.length > 0;
    }

    get isSubmitDisabled() {
        return !this.numeroCamaras || this.numeroCamaras < 1;
    }

    // ── Handlers ──
    handleOpenModal() {
        this.isModalOpen = true;
        this.activeTab = 'nueva';
        this.numeroCamaras = 1;
        this.detalle = '';
    }

    handleCloseModal() {
        this.isModalOpen = false;
    }

    handleStopPropagation(event) {
        event.stopPropagation();
    }

    handleTabNueva() { this.activeTab = 'nueva'; }

    handleTabLista() {
        this.activeTab = 'lista';
        this._loadSolicitudes();
    }

    handleNumCamarasChange(event) {
        this.numeroCamaras = event.detail.value;
    }

    handleDetalleChange(event) {
        this.detalle = event.detail.value;
    }

    handleSubmit() {
        if (!this.numeroCamaras || this.numeroCamaras < 1) return;

        crearSolicitud({
            numeroCamaras: parseInt(this.numeroCamaras, 10),
            detalle: this.detalle || ''
        })
            .then(() => {
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Solicitud enviada',
                    message: `Tu solicitud de ${this.numeroCamaras} cámara(s) ha sido enviada. Te notificaremos cuando sea aprobada.`,
                    variant: 'success'
                }));
                this.isModalOpen = false;
            })
            .catch((err) => {
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Error al enviar',
                    message: err.body ? err.body.message : err.message,
                    variant: 'error'
                }));
            });
    }

    _loadSolicitudes() {
        this.isLoadingSolicitudes = true;
        getMisSolicitudes()
            .then((data) => {
                this.misSolicitudes = data.map((sol) => ({
                    ...sol,
                    badgeClass: BADGE_MAP[sol.Estado__c] || 'badge',
                    fechaFormateada: sol.Fecha_Solicitud__c
                        ? new Date(sol.Fecha_Solicitud__c).toLocaleDateString('es-ES')
                        : ''
                }));
            })
            .catch((err) => {
                this.misSolicitudes = [];
                console.error('Error cargando solicitudes:', JSON.stringify(err));
            })
            .finally(() => {
                this.isLoadingSolicitudes = false;
            });
    }
}
