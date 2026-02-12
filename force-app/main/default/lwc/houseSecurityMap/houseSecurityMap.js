import { LightningElement, wire, track } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getCamaras from '@salesforce/apex/HouseMapController.getCamaras';
import PLANO_CASA from '@salesforce/resourceUrl/Plano_Casa_1';

/**
 * @description LWC interactivo que muestra un plano de la casa con las cámaras
 *              de seguridad posicionadas. Al hacer clic se abre un modal con el
 *              stream de vídeo en vivo.
 */
export default class HouseSecurityMap extends LightningElement {

    // ── Static Resource ──
    floorPlanUrl = PLANO_CASA;

    // ── State ──
    @track cameras = [];
    @track selectedCamera = null;
    @track isModalOpen = false;
    @track modalVideoUrl = '';
    @track modalCameraName = '';
    @track currentDateTime = '';
    @track isLoading = true;

    // Referencia al resultado de wire para refreshApex
    _wiredCamerasResult;

    // Timer
    _intervalId;

    // ═══════════════════════════════════════════
    //  WIRE — Carga de cámaras activas desde Apex
    // ═══════════════════════════════════════════

    @wire(getCamaras)
    wiredCamaras(result) {
        this._wiredCamerasResult = result;
        const { data, error } = result;

        if (data) {
            this.cameras = data.map((cam) => ({
                ...cam,
                positionStyle: `top: ${cam.Posicion_Y__c}%; left: ${cam.Posicion_X__c}%;`,
                listItemClass:
                    'cam-list-item' +
                    (this.selectedCamera && this.selectedCamera.Id === cam.Id
                        ? ' cam-list-item--selected'
                        : '')
            }));
            this.isLoading = false;
        } else if (error) {
            this.cameras = [];
            this.isLoading = false;
            console.error('Error al cargar cámaras:', JSON.stringify(error));
        }
    }

    // ═══════════════════════════════════════════
    //  LIFECYCLE
    // ═══════════════════════════════════════════

    connectedCallback() {
        this._updateDateTime();
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this._intervalId = setInterval(() => {
            this._updateDateTime();
        }, 1000);
    }

    disconnectedCallback() {
        if (this._intervalId) {
            clearInterval(this._intervalId);
        }
    }

    // ═══════════════════════════════════════════
    //  GETTERS
    // ═══════════════════════════════════════════

    /** Número de cámaras activas cargadas */
    get cameraCount() {
        return this.cameras ? this.cameras.length : 0;
    }

    /** True si hay al menos una cámara cargada */
    get hasCameras() {
        return this.cameras && this.cameras.length > 0;
    }

    // ═══════════════════════════════════════════
    //  HANDLERS
    // ═══════════════════════════════════════════

    /**
     * Al hacer clic en un pin o en un item de la sidebar,
     * selecciona la cámara y actualiza estilos.
     */
    handleCameraClick(event) {
        const camId = event.currentTarget.dataset.id;
        const cam = this.cameras.find((c) => c.Id === camId);
        if (!cam) return;

        this.selectedCamera = { ...cam };

        // Actualizar clase activa en la lista lateral
        this.cameras = this.cameras.map((c) => ({
            ...c,
            listItemClass:
                'cam-list-item' +
                (c.Id === camId ? ' cam-list-item--selected' : '')
        }));
    }

    /** Abre el modal con el vídeo de la cámara seleccionada */
    handleOpenModal() {
        if (!this.selectedCamera) return;

        this.modalCameraName = this.selectedCamera.Name;
        this.modalVideoUrl = this.selectedCamera.Video_Url__c || '';
        this.isModalOpen = true;
    }

    /** Cierra el modal y limpia el src del iframe para detener el vídeo */
    handleCloseModal() {
        this.isModalOpen = false;
        this.modalVideoUrl = '';
        this.modalCameraName = '';
    }

    /** Deselecciona la cámara del panel lateral */
    handleCloseDetail() {
        this.selectedCamera = null;
        this.cameras = this.cameras.map((c) => ({
            ...c,
            listItemClass: 'cam-list-item'
        }));
    }

    /** Refresca los datos del wire */
    handleRefresh() {
        return refreshApex(this._wiredCamerasResult);
    }

    // ═══════════════════════════════════════════
    //  PRIVATE HELPERS
    // ═══════════════════════════════════════════

    _updateDateTime() {
        const now = new Date();
        this.currentDateTime = now.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }) + ' · ' + now.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
}
