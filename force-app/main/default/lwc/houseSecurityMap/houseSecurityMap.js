import { LightningElement, wire, track } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getCamaras from '@salesforce/apex/HouseMapController.getCamaras';
import PLANO_CASA from '@salesforce/resourceUrl/Plano_Casa_1';

// ── Vídeos de reserva (se usan cuando la cámara no tiene Video_Url__c) ──
const FALLBACK_VIDEOS = [
    'https://www.youtube.com/embed/mKCieTImjvU?autoplay=1&mute=1&controls=0&loop=1&playlist=mKCieTImjvU',
    'https://www.youtube.com/embed/fO9e9jnhYK8?autoplay=1&mute=1&controls=0&loop=1&playlist=fO9e9jnhYK8',
    'https://www.youtube.com/embed/rnXIjl_Rzy4?autoplay=1&mute=1&controls=0&loop=1&playlist=rnXIjl_Rzy4',
    'https://www.youtube.com/embed/UUhTr19MH0k?autoplay=1&mute=1&controls=0&loop=1&playlist=UUhTr19MH0k'
];

/**
 * @description LWC interactivo que muestra un plano de la casa con las cámaras
 *              de seguridad posicionadas. Al hacer clic en un pin se abre la
 *              retransmisión de vídeo a pantalla completa.
 */
export default class HouseSecurityMap extends LightningElement {

    // ── Static Resource ──
    floorPlanUrl = PLANO_CASA;

    // ── State ──
    @track cameras = [];
    @track selectedCamera = null;
    @track isFullscreen = false;
    @track fullscreenVideoUrl = '';
    @track fullscreenCameraName = '';
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

        // Cerrar pantalla completa con ESC
        this._boundHandleKeyDown = this._handleKeyDown.bind(this);
        // eslint-disable-next-line @lwc/lwc/no-document-query
        document.addEventListener('keydown', this._boundHandleKeyDown);
    }

    disconnectedCallback() {
        if (this._intervalId) {
            clearInterval(this._intervalId);
        }
        // eslint-disable-next-line @lwc/lwc/no-document-query
        document.removeEventListener('keydown', this._boundHandleKeyDown);
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

        // Abrir directamente a pantalla completa
        this._openFullscreen(cam);
    }

    /** Abre la vista fullscreen con el vídeo de la cámara */
    handleOpenFullscreen() {
        if (!this.selectedCamera) return;
        this._openFullscreen(this.selectedCamera);
    }

    /** Cierra la vista fullscreen y limpia el src para detener el vídeo */
    handleCloseFullscreen() {
        this.isFullscreen = false;
        this.fullscreenVideoUrl = '';
        this.fullscreenCameraName = '';
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

    /** Abre la vista fullscreen; usa fallback si no hay URL */
    _openFullscreen(cam) {
        const idx = this.cameras.findIndex((c) => c.Id === cam.Id);
        const fallback = FALLBACK_VIDEOS[idx % FALLBACK_VIDEOS.length];

        this.fullscreenCameraName = cam.Name;
        this.fullscreenVideoUrl   = cam.Video_Url__c || fallback;
        this.isFullscreen          = true;
    }

    /** Cierra fullscreen con la tecla ESC */
    _handleKeyDown(event) {
        if (event.key === 'Escape' && this.isFullscreen) {
            this.handleCloseFullscreen();
        }
    }

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
