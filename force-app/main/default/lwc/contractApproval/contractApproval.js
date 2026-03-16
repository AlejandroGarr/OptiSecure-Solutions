import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getSolicitudesPendientes from '@salesforce/apex/ContratacionCamaraController.getSolicitudesPendientes';
import aprobarSolicitud from '@salesforce/apex/ContratacionCamaraController.aprobarSolicitud';
import rechazarSolicitud from '@salesforce/apex/ContratacionCamaraController.rechazarSolicitud';

const BADGE_MAP = {
    'Pendiente':   'badge badge-pending',
    'En Revision': 'badge badge-review'
};

export default class ContractApproval extends LightningElement {

    @track solicitudes = [];
    @track isLoading = false;
    @track processingId = null; // Id de la solicitud en proceso (para deshabilitar botones)

    get hasSolicitudes() {
        return this.solicitudes && this.solicitudes.length > 0;
    }

    connectedCallback() {
        this._loadSolicitudes();
    }

    handleRefresh() {
        this._loadSolicitudes();
    }

    handleAprobar(event) {
        const solId = event.currentTarget.dataset.id;
        this.processingId = solId;

        aprobarSolicitud({ solicitudId: solId })
            .then(() => {
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Solicitud aprobada',
                    message: 'La solicitud ha sido aprobada. El usuario podrá colocar sus cámaras.',
                    variant: 'success'
                }));
                this._loadSolicitudes();
            })
            .catch((err) => {
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Error al aprobar',
                    message: err.body ? err.body.message : err.message,
                    variant: 'error'
                }));
            })
            .finally(() => {
                this.processingId = null;
            });
    }

    handleRechazar(event) {
        const solId = event.currentTarget.dataset.id;
        this.processingId = solId;

        rechazarSolicitud({ solicitudId: solId })
            .then(() => {
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Solicitud rechazada',
                    message: 'La solicitud ha sido rechazada.',
                    variant: 'warning'
                }));
                this._loadSolicitudes();
            })
            .catch((err) => {
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Error al rechazar',
                    message: err.body ? err.body.message : err.message,
                    variant: 'error'
                }));
            })
            .finally(() => {
                this.processingId = null;
            });
    }

    _loadSolicitudes() {
        this.isLoading = true;
        getSolicitudesPendientes()
            .then((data) => {
                this.solicitudes = data.map((sol) => ({
                    ...sol,
                    badgeClass: BADGE_MAP[sol.Estado__c] || 'badge',
                    solicitante: sol.Nombre_Solicitante__c || 'Desconocido',
                    cuenta: sol.Cuenta__r ? sol.Cuenta__r.Name : '—',
                    contacto: sol.Contacto__r ? sol.Contacto__r.Name : '—',
                    fechaFormateada: sol.Fecha_Solicitud__c
                        ? new Date(sol.Fecha_Solicitud__c).toLocaleDateString('es-ES')
                        : '',
                    isProcessing: false
                }));
            })
            .catch((err) => {
                this.solicitudes = [];
                console.error('Error cargando solicitudes pendientes:', JSON.stringify(err));
            })
            .finally(() => {
                this.isLoading = false;
            });
    }
}
