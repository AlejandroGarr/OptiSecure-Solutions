import { LightningElement, wire, track } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getCamaras from '@salesforce/apex/HouseMapController.getCamaras';
import isSystemAdmin from '@salesforce/apex/HouseMapController.isSystemAdmin';
import saveDraggedCamera from '@salesforce/apex/HouseMapController.saveDraggedCamera';
import updateCameraPosition from '@salesforce/apex/HouseMapController.updateCameraPosition';
import PLANO_CASA from '@salesforce/resourceUrl/Plano_Casa_1';

// ── Vídeos de reserva (se usan cuando la cámara no tiene Video_Url__c) ──
const FALLBACK_VIDEOS = [
    'https://www.youtube.com/embed/mKCieTImjvU?autoplay=1&mute=1&controls=0&loop=1&playlist=mKCieTImjvU',
    'https://www.youtube.com/embed/fO9e9jnhYK8?autoplay=1&mute=1&controls=0&loop=1&playlist=fO9e9jnhYK8',
    'https://www.youtube.com/embed/rnXIjl_Rzy4?autoplay=1&mute=1&controls=0&loop=1&playlist=rnXIjl_Rzy4',
    'https://www.youtube.com/embed/UUhTr19MH0k?autoplay=1&mute=1&controls=0&loop=1&playlist=UUhTr19MH0k'
];

// ── IDs de vídeos de YouTube aleatorios para thumbnails de chinchetas ──
const YOUTUBE_VIDEO_IDS = [
    'mKCieTImjvU', 'fO9e9jnhYK8', 'rnXIjl_Rzy4', 'UUhTr19MH0k',
    'dQw4w9WgXcQ', 'jNQXAC9IVRw', '9bZkp7q19f0', 'kJQP7kiw5Fk',
    'RgKAFK5djSk', 'JGwWNGJdvx8', 'OPf0YbXqDm0', 'LsoLEjrDogU'
];

/** Devuelve un ID de vídeo aleatorio */
function _randomVideoId() {
    return YOUTUBE_VIDEO_IDS[Math.floor(Math.random() * YOUTUBE_VIDEO_IDS.length)];
}

/** Genera la URL de thumbnail de YouTube */
function _thumbnailUrl(videoId) {
    return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}

/** Genera la URL de embed de YouTube */
function _embedUrl(videoId) {
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${videoId}`;
}

/**
 * @description LWC interactivo que muestra un plano de la casa con las cámaras
 *              de seguridad posicionadas. Al hacer clic en un pin se abre la
 *              retransmisión de vídeo a pantalla completa.
 *              Los usuarios System Administrator pueden arrastrar y soltar
 *              chinchetas nuevas sobre el plano.
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

    // ── Admin / Drag & Drop ──
    @track isAdmin = false;
    @track draggablePins = [];       // Chinchetas en la bandeja para arrastrar
    @track droppedPins = [];         // Chinchetas soltadas en el mapa (aún no guardadas)
    @track isDragOver = false;       // Feedback visual al arrastrar sobre el mapa
    @track _draggedPinId = null;     // ID de la chincheta que se está arrastrando
    @track _isDraggingExisting = false; // Si se está reposicionando un pin ya existente
    @track _draggingExistingId = null;  // Id del pin existente que se reposiciona

    // Referencia al resultado de wire para refreshApex
    _wiredCamerasResult;

    // Timer
    _intervalId;

    // Contador para IDs de chinchetas en la bandeja
    _pinCounter = 0;

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

    @wire(isSystemAdmin)
    wiredIsAdmin({ data, error }) {
        if (data === true) {
            this.isAdmin = true;
            this._initDraggablePins();
        } else if (error) {
            this.isAdmin = false;
            console.error('Error al comprobar perfil:', JSON.stringify(error));
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

    /** Tiene chinchetas arrastrables disponibles */
    get hasDraggablePins() {
        return this.draggablePins && this.draggablePins.length > 0;
    }

    /** Tiene chinchetas soltadas sin guardar */
    get hasDroppedPins() {
        return this.droppedPins && this.droppedPins.length > 0;
    }

    /** Clase CSS del contenedor del mapa con feedback de arrastre */
    get mapContainerClass() {
        return 'map-container' + (this.isDragOver ? ' map-container--dragover' : '');
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
    //  DRAG & DROP — Solo para administradores
    // ═══════════════════════════════════════════

    /** Inicio del arrastre desde la bandeja */
    handleDragStart(event) {
        const pinId = event.currentTarget.dataset.pinId;
        this._draggedPinId = pinId;
        this._isDraggingExisting = false;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', pinId);
    }

    /** Inicio del arrastre de un pin ya soltado en el mapa (reposicionar) */
    handleDroppedPinDragStart(event) {
        const pinId = event.currentTarget.dataset.pinId;
        this._draggedPinId = pinId;
        this._isDraggingExisting = true;
        this._draggingExistingId = pinId;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', pinId);
    }

    /** Inicio del arrastre de un pin de cámara existente de la BBDD */
    handleExistingCameraDragStart(event) {
        event.stopPropagation();
        const camId = event.currentTarget.dataset.id;
        this._draggedPinId = camId;
        this._isDraggingExisting = true;
        this._draggingExistingId = camId;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', camId);
    }

    /** DragOver sobre el mapa — necesario para permitir el drop */
    handleDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        this.isDragOver = true;
    }

    /** DragLeave del mapa */
    handleDragLeave() {
        this.isDragOver = false;
    }

    /** Drop sobre el mapa */
    handleDrop(event) {
        event.preventDefault();
        this.isDragOver = false;

        const mapRect = event.currentTarget.getBoundingClientRect();
        const posX = ((event.clientX - mapRect.left) / mapRect.width) * 100;
        const posY = ((event.clientY - mapRect.top) / mapRect.height) * 100;

        // Comprobar si estamos reposicionando un pin existente de la BBDD
        if (this._isDraggingExisting) {
            const existingCam = this.cameras.find((c) => c.Id === this._draggingExistingId);
            if (existingCam) {
                // Actualizar posición en el servidor
                this._updateExistingCameraPosition(existingCam.Id, posX, posY);
            } else {
                // Reposicionar un pin soltado (no guardado aún)
                this.droppedPins = this.droppedPins.map((p) => {
                    if (p.id === this._draggingExistingId) {
                        return {
                            ...p,
                            posX: posX.toFixed(1),
                            posY: posY.toFixed(1),
                            positionStyle: `top: ${posY.toFixed(1)}%; left: ${posX.toFixed(1)}%;`
                        };
                    }
                    return p;
                });
            }
            this._isDraggingExisting = false;
            this._draggingExistingId = null;
            this._draggedPinId = null;
            return;
        }

        // Pin nuevo desde la bandeja
        const pin = this.draggablePins.find((p) => p.id === this._draggedPinId);
        if (!pin) return;

        // Mover de la bandeja al mapa
        this.draggablePins = this.draggablePins.filter((p) => p.id !== pin.id);
        this.droppedPins = [
            ...this.droppedPins,
            {
                ...pin,
                posX: posX.toFixed(1),
                posY: posY.toFixed(1),
                positionStyle: `top: ${posY.toFixed(1)}%; left: ${posX.toFixed(1)}%;`
            }
        ];

        this._draggedPinId = null;
    }

    /** Clic en una chincheta soltada → abre el vídeo */
    handleDroppedPinClick(event) {
        event.stopPropagation();
        const pinId = event.currentTarget.dataset.pinId;
        const pin = this.droppedPins.find((p) => p.id === pinId);
        if (!pin) return;
        this.fullscreenCameraName = pin.name;
        this.fullscreenVideoUrl = pin.embedUrl;
        this.isFullscreen = true;
    }

    /** Guarda todas las chinchetas soltadas como cámaras en Salesforce */
    handleSaveDroppedPins() {
        const promises = this.droppedPins.map((pin) =>
            saveDraggedCamera({
                name: pin.name,
                posX: parseFloat(pin.posX),
                posY: parseFloat(pin.posY),
                videoUrl: pin.embedUrl
            })
        );

        Promise.all(promises)
            .then(() => {
                this.droppedPins = [];
                return refreshApex(this._wiredCamerasResult);
            })
            .catch((err) => {
                console.error('Error al guardar chinchetas:', JSON.stringify(err));
            });
    }

    /** Añade una nueva chincheta a la bandeja */
    handleAddPin() {
        this._pinCounter++;
        const videoId = _randomVideoId();
        this.draggablePins = [
            ...this.draggablePins,
            {
                id: `pin-${this._pinCounter}`,
                name: `Cámara ${this.cameraCount + this.droppedPins.length + this._pinCounter}`,
                videoId: videoId,
                thumbnailUrl: _thumbnailUrl(videoId),
                embedUrl: _embedUrl(videoId)
            }
        ];
    }

    /** Elimina un pin de la bandeja */
    handleRemoveTrayPin(event) {
        const pinId = event.currentTarget.dataset.pinId;
        this.draggablePins = this.draggablePins.filter((p) => p.id !== pinId);
    }

    /** Elimina un pin soltado del mapa */
    handleRemoveDroppedPin(event) {
        event.stopPropagation();
        const pinId = event.currentTarget.dataset.pinId;
        this.droppedPins = this.droppedPins.filter((p) => p.id !== pinId);
    }

    // ═══════════════════════════════════════════
    //  PRIVATE HELPERS
    // ═══════════════════════════════════════════

    /** Inicializa la bandeja con 3 chinchetas por defecto */
    _initDraggablePins() {
        const pins = [];
        for (let i = 1; i <= 3; i++) {
            this._pinCounter++;
            const videoId = _randomVideoId();
            pins.push({
                id: `pin-${this._pinCounter}`,
                name: `Cámara nueva ${i}`,
                videoId: videoId,
                thumbnailUrl: _thumbnailUrl(videoId),
                embedUrl: _embedUrl(videoId)
            });
        }
        this.draggablePins = pins;
    }

    /** Actualiza la posición de una cámara existente en el servidor */
    _updateExistingCameraPosition(camId, posX, posY) {
        updateCameraPosition({ camId, posX, posY })
            .then(() => refreshApex(this._wiredCamerasResult))
            .catch((err) => {
                console.error('Error al actualizar posición:', JSON.stringify(err));
            });
    }

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
