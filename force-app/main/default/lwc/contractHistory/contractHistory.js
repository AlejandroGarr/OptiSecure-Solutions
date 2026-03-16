import { LightningElement, track } from 'lwc';
import getAllSolicitudes from '@salesforce/apex/ContratacionCamaraController.getAllSolicitudes';

const BADGE_MAP = {
    'Pendiente':   'badge badge-pending',
    'En Revision': 'badge badge-review',
    'Aprobada':    'badge badge-approved',
    'Rechazada':   'badge badge-rejected',
    'Completada':  'badge badge-completed'
};

const ALL_STATES = ['Todos', 'Pendiente', 'En Revision', 'Aprobada', 'Rechazada', 'Completada'];

export default class ContractHistory extends LightningElement {

    @track _allSolicitudes = [];
    @track solicitudes = [];
    @track isLoading = false;
    @track activeFilter = 'Todos';

    get filterOptions() {
        return ALL_STATES.map((s) => ({
            label: s,
            value: s,
            cssClass: 'filter-btn' + (this.activeFilter === s ? ' filter-btn--active' : '')
        }));
    }

    get hasSolicitudes() {
        return this.solicitudes && this.solicitudes.length > 0;
    }

    get totalCount() {
        return this._allSolicitudes.length;
    }

    get filteredCount() {
        return this.solicitudes.length;
    }

    connectedCallback() {
        this._load();
    }

    handleRefresh() {
        this._load();
    }

    handleFilter(event) {
        this.activeFilter = event.currentTarget.dataset.value;
        this._applyFilter();
    }

    _load() {
        this.isLoading = true;
        getAllSolicitudes()
            .then((data) => {
                this._allSolicitudes = data.map((sol) => ({
                    ...sol,
                    badgeClass: BADGE_MAP[sol.Estado__c] || 'badge',
                    solicitante: sol.Nombre_Solicitante__c || '—',
                    cuenta: sol.Cuenta__r ? sol.Cuenta__r.Name : '—',
                    contacto: sol.Contacto__r ? sol.Contacto__r.Name : '—',
                    fechaFormateada: sol.Fecha_Solicitud__c
                        ? new Date(sol.Fecha_Solicitud__c).toLocaleDateString('es-ES')
                        : '—',
                    fechaModificacion: sol.LastModifiedDate
                        ? new Date(sol.LastModifiedDate).toLocaleDateString('es-ES', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })
                        : '—'
                }));
                this._applyFilter();
            })
            .catch((err) => {
                this._allSolicitudes = [];
                this.solicitudes = [];
                console.error('Error cargando historial:', JSON.stringify(err));
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    _applyFilter() {
        if (this.activeFilter === 'Todos') {
            this.solicitudes = [...this._allSolicitudes];
        } else {
            this.solicitudes = this._allSolicitudes.filter(
                (s) => s.Estado__c === this.activeFilter
            );
        }
    }
}
