import { LightningElement, api, wire, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getCamaras from '@salesforce/apex/HouseMapController.getCamaras';
import isSystemAdmin from '@salesforce/apex/HouseMapController.isSystemAdmin';
import saveDraggedCamera from '@salesforce/apex/HouseMapController.saveDraggedCamera';
import updateCameraPosition from '@salesforce/apex/HouseMapController.updateCameraPosition';
import deleteCamera from '@salesforce/apex/HouseMapController.deleteCamera';
import renameCamera from '@salesforce/apex/UserMenuController.renameCamera';
import getSolicitudAprobadaActiva from '@salesforce/apex/ContratacionCamaraController.getSolicitudAprobadaActiva';
import completarSolicitud from '@salesforce/apex/ContratacionCamaraController.completarSolicitud';
import saveCamarasContratadas from '@salesforce/apex/ContratacionCamaraController.saveCamarasContratadas';
import getContactIdUsuarioActual from '@salesforce/apex/ContratacionCamaraController.getContactIdUsuarioActual';
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

    // ── Public API — contactId recibido del padre (null = sin filtro) ──
    _contactId = null;
    @api
    get contactId() {
        return this._contactId;
    }
    set contactId(value) {
        this._contactId = value || null;
        this.loadCameras();
    }

    // ── State ──
    @track cameras = [];
    @track selectedCamera = null;
    @track isFullscreen = false;
    @track fullscreenVideoUrl = '';
    @track fullscreenCameraName = '';
    @track currentDateTime = '';
    @track isLoading = false;

    // ── Admin / Drag & Drop ──
    @track isAdmin = false;
    @track draggablePins = [];       // Chinchetas en la bandeja para arrastrar
    @track droppedPins = [];         // Chinchetas soltadas en el mapa (aún no guardadas)
    @track isDragOver = false;       // Feedback visual al arrastrar sobre el mapa
    @track _draggedPinId = null;     // ID de la chincheta que se está arrastrando
    @track _isDraggingExisting = false; // Si se está reposicionando un pin ya existente
    @track _draggingExistingId = null;  // Id del pin existente que se reposiciona

    // ── Contratación / Solicitud aprobada ──
    @track hasSolicitudAprobada = false;
    @track solicitudActiva = null;    // { solicitudId, nombre, numeroCamaras, contactId }
    @track camarasRestantes = 0;
    @track isSaving = false;          // Bloquea el botón guardar durante el DML
    @track inlineMessage = '';        // Mensaje visible inline (por si los toasts no aparecen)
    @track inlineMessageType = 'info'; // 'success' | 'error' | 'info'
    _solicitudContactId = null;       // ContactId del portal user con solicitud aprobada

    // ── Renombrar cámara en la sidebar ──
    @track editingCameraId = null;
    @track editingCameraName = '';
    @track isRenaming = false;

    // ── Menú contextual (clic derecho) ──
    @track contextMenuVisible = false;
    @track contextMenuX = 0;
    @track contextMenuY = 0;
    @track _contextMenuCameraId = null;

    // Referencia no usada (legacy)
    _wiredCamerasResult;

    // Timer
    _intervalId;

    // Contador para IDs de chinchetas en la bandeja
    _pinCounter = 0;

    // ═══════════════════════════════════════════
    //  CARGA DE CÁMARAS — Llamada imperativa a Apex
    // ═══════════════════════════════════════════

    loadCameras() {
        this.isLoading = true;
        getCamaras({ contactId: this._contactId })
            .then((data) => {
                this.cameras = data.map((cam) => ({
                    ...cam,
                    positionStyle: `top: ${cam.Posicion_Y__c}%; left: ${cam.Posicion_X__c}%;`,
                    listItemClass:
                        'cam-list-item' +
                        (this.selectedCamera && this.selectedCamera.Id === cam.Id
                            ? ' cam-list-item--selected'
                            : ''),
                    isEditing: this.editingCameraId === cam.Id
                }));
            })
            .catch((error) => {
                this.cameras = [];
                const msg = error && error.body ? error.body.message : 'Error al cargar cámaras';
                console.error('Error al cargar cámaras:', JSON.stringify(error));
                this.inlineMessage = 'Error al cargar cámaras: ' + msg;
                this.inlineMessageType = 'error';
                this.dispatchEvent(
                    new ShowToastEvent({ title: 'Error al cargar cámaras', message: msg, variant: 'error' })
                );
            })
            .finally(() => {
                this.isLoading = false;
            });
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

        // Para usuarios de portal: obtener su ContactId y filtrar siempre sus cámaras
        // Para admins: ContactId = null → ven todas las cámaras
        getContactIdUsuarioActual()
            .then((contactId) => {
                if (contactId) {
                    this._contactId = contactId;
                    this._solicitudContactId = contactId;
                }
                // Carga inicial de cámaras (ya con el filtro correcto si es portal)
                this.loadCameras();
                // Comprobar solicitud aprobada activa (activa drag&drop si procede)
                this._checkSolicitudAprobada();
            })
            .catch(() => {
                // Si falla (ej. admin sin contacto) cargamos sin filtro
                this.loadCameras();
                this._checkSolicitudAprobada();
            });

        this._boundHandleKeyDown = this._handleKeyDown.bind(this);
        this._boundCloseContextMenu = this._closeContextMenu.bind(this);
        // eslint-disable-next-line @lwc/lwc/no-document-query
        document.addEventListener('keydown', this._boundHandleKeyDown);
        // eslint-disable-next-line @lwc/lwc/no-document-query
        document.addEventListener('click', this._boundCloseContextMenu);
    }

    disconnectedCallback() {
        if (this._intervalId) {
            clearInterval(this._intervalId);
        }
        // eslint-disable-next-line @lwc/lwc/no-document-query
        document.removeEventListener('keydown', this._boundHandleKeyDown);
        // eslint-disable-next-line @lwc/lwc/no-document-query
        document.removeEventListener('click', this._boundCloseContextMenu);
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

    /** Estilo inline para posicionar el menú contextual */
    get contextMenuStyle() {
        return `top: ${this.contextMenuY}px; left: ${this.contextMenuX}px;`;
    }

    /** True si el usuario puede arrastrar chinchetas (admin o solicitud aprobada) */
    get canDragDrop() {
        return this.isAdmin || this.hasSolicitudAprobada;
    }

    /** True si se debe mostrar la bandeja de drag & drop */
    get showDragTray() {
        return this.isAdmin || this.hasSolicitudAprobada;
    }

    /** Solo el admin puede añadir chinchetas ilimitadas; el usuario con ticket no */
    get showAddPinButton() {
        return this.isAdmin;
    }

    /** Label dinámico del botón guardar */
    get saveButtonLabel() {
        return this.isSaving ? 'Guardando...' : 'Guardar chinchetas';
    }

    /** Texto de info para el usuario con solicitud aprobada */
    get solicitudInfoText() {
        if (!this.hasSolicitudAprobada) return '';
        return `Solicitud ${this.solicitudActiva.nombre} — Coloca ${this.camarasRestantes} cámara(s) en el mapa`;
    }

    /** Devuelve "true" o "false" como string para el atributo draggable del HTML */
    get draggableAttr() {
        return this.canDragDrop ? 'true' : 'false';
    }

    /** Clase CSS del mensaje inline según el tipo */
    get inlineMessageClass() {
        return `inline-msg inline-msg--${this.inlineMessageType}`;
    }

    /** True si hay mensaje inline visible */
    get showInlineMessage() {
        return !!this.inlineMessage;
    }

    /** Icono para el mensaje inline */
    get inlineMessageIcon() {
        if (this.inlineMessageType === 'error') return 'utility:error';
        if (this.inlineMessageType === 'success') return 'utility:success';
        return 'utility:info';
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

    /** Refresca los datos de cámaras */
    handleRefresh() {
        this.loadCameras();
    }

    // ═══════════════════════════════════════════
    //  MENÚ CONTEXTUAL — Clic derecho (solo admin)
    // ═══════════════════════════════════════════

    /** Clic derecho en un pin de cámara existente → menú contextual */
    handleCameraContextMenu(event) {
        if (!this.isAdmin) return;
        event.preventDefault();
        event.stopPropagation();

        const camId = event.currentTarget.dataset.id;
        this._contextMenuCameraId = camId;

        // Posicionar el menú relativo al componente host
        const hostRect = this.template.querySelector('.house-security-map').getBoundingClientRect();
        this.contextMenuX = event.clientX - hostRect.left;
        this.contextMenuY = event.clientY - hostRect.top;
        this.contextMenuVisible = true;
    }

    /** Eliminar cámara seleccionada en el menú contextual */
    handleDeleteCamera() {
        if (!this._contextMenuCameraId) return;
        const camId = this._contextMenuCameraId;
        this.contextMenuVisible = false;

        // Optimistic UI — quitar visualmente
        const prevCameras = [...this.cameras];
        this.cameras = this.cameras.filter((c) => c.Id !== camId);

        if (this.selectedCamera && this.selectedCamera.Id === camId) {
            this.selectedCamera = null;
        }

        deleteCamera({ cameraId: camId })
            .then(() => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Cámara eliminada',
                        message: 'La cámara se ha eliminado correctamente.',
                        variant: 'success'
                    })
                );
                return this.loadCameras();
            })
            .catch((err) => {
                // Revertir
                this.cameras = prevCameras;
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error al eliminar',
                        message: err.body ? err.body.message : err.message,
                        variant: 'error'
                    })
                );
            });
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
        if (!this.canDragDrop) return;
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
        if (!this.canDragDrop) return;
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
        if (!this.canDragDrop) return;
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
        if (this.isSaving || !this.droppedPins.length) return;
        this.isSaving = true;

        if (this.hasSolicitudAprobada && this.solicitudActiva) {
            // ── Flujo de contratación: guardar con método específico para portal ──
            const camarasData = this.droppedPins.map((pin) => ({
                name: pin.name,
                posX: parseFloat(pin.posX),
                posY: parseFloat(pin.posY),
                videoUrl: pin.embedUrl
            }));

            saveCamarasContratadas({
                solicitudId: this.solicitudActiva.solicitudId,
                camarasJson: JSON.stringify(camarasData)
            })
                .then(() => {
                    this.droppedPins = [];
                    // Mantener _contactId = solicitudContactId para que loadCameras
                    // muestre las cámaras del portal user al recargar
                    this._contactId = this._solicitudContactId;
                    this.hasSolicitudAprobada = false;
                    this.solicitudActiva = null;
                    this.camarasRestantes = 0;
                    this.draggablePins = [];
                    this.inlineMessage = '¡Cámaras guardadas! Cargando tu mapa...';
                    this.inlineMessageType = 'success';
                    this.dispatchEvent(
                        new ShowToastEvent({
                            title: 'Contratación completada',
                            message: 'Tus cámaras han sido colocadas correctamente.',
                            variant: 'success'
                        })
                    );
                    this.loadCameras();
                })
                .catch((err) => {
                    const msg = err && err.body ? err.body.message : (err ? err.message : 'Error desconocido');
                    this.inlineMessage = 'Error al guardar cámaras: ' + msg;
                    this.inlineMessageType = 'error';
                    this.dispatchEvent(
                        new ShowToastEvent({
                            title: 'Error al guardar cámaras',
                            message: msg,
                            variant: 'error',
                            mode: 'sticky'
                        })
                    );
                })
                .finally(() => {
                    this.isSaving = false;
                });

        } else {
            // ── Flujo admin: guardar cámaras una a una ──
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
                    this.dispatchEvent(
                        new ShowToastEvent({
                            title: 'Cámaras guardadas',
                            message: 'Las cámaras se han añadido al mapa correctamente.',
                            variant: 'success'
                        })
                    );
                    this.loadCameras();
                })
                .catch((err) => {
                    const msg = err && err.body ? err.body.message : (err ? err.message : 'Error desconocido');
                    this.dispatchEvent(
                        new ShowToastEvent({
                            title: 'Error al guardar cámaras',
                            message: msg,
                            variant: 'error',
                            mode: 'sticky'
                        })
                    );
                })
                .finally(() => {
                    this.isSaving = false;
                });
        }
    }

    /** Añade una nueva chincheta a la bandeja (solo admin) */
    handleAddPin() {
        if (!this.isAdmin) return;
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

    /** Comprueba si el usuario portal tiene una solicitud aprobada activa */
    _checkSolicitudAprobada() {
        getSolicitudAprobadaActiva()
            .then((result) => {
                if (result) {
                    this.hasSolicitudAprobada = true;
                    this.solicitudActiva = result;
                    this.camarasRestantes = result.numeroCamaras;
                    // Garantizar que _contactId y _solicitudContactId están seteados
                    if (result.contactId) {
                        this._contactId = result.contactId;
                        this._solicitudContactId = result.contactId;
                    }
                    this._initSolicitudPins(result.numeroCamaras);
                }
            })
            .catch((err) => {
                console.error('Error al comprobar solicitud aprobada:', JSON.stringify(err));
            });
    }

    /** Inicializa N chinchetas para el usuario con solicitud aprobada */
    _initSolicitudPins(numCamaras) {
        const pins = [];
        for (let i = 1; i <= numCamaras; i++) {
            this._pinCounter++;
            const videoId = _randomVideoId();
            pins.push({
                id: `pin-${this._pinCounter}`,
                name: `Cámara contratada ${i}`,
                videoId: videoId,
                thumbnailUrl: _thumbnailUrl(videoId),
                embedUrl: _embedUrl(videoId)
            });
        }
        this.draggablePins = pins;
    }

    /**
     * Actualiza la posición de una cámara existente en el servidor.
     * Implementa Optimistic UI: actualiza visualmente primero y revierte si falla.
     */
    _updateExistingCameraPosition(camId, posX, posY) {
        // Guardar posición anterior para poder revertir en caso de error
        const prevCameras = [...this.cameras];

        // Optimistic UI — actualizar visualmente de inmediato
        this.cameras = this.cameras.map((c) => {
            if (c.Id === camId) {
                return {
                    ...c,
                    Posicion_X__c: posX,
                    Posicion_Y__c: posY,
                    positionStyle: `top: ${posY.toFixed(1)}%; left: ${posX.toFixed(1)}%;`
                };
            }
            return c;
        });

        // Llamada Apex con los nombres de parámetro actualizados
        updateCameraPosition({ cameraId: camId, newX: posX, newY: posY })
            .then(() => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Posición actualizada',
                        message: 'La cámara se ha reposicionado correctamente.',
                        variant: 'success'
                    })
                );
                return this.loadCameras();
            })
            .catch((err) => {
                // Revertir a la posición anterior
                this.cameras = prevCameras;
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error al guardar posición',
                        message: err.body ? err.body.message : err.message,
                        variant: 'error'
                    })
                );
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

    /** Cierra fullscreen con ESC / cierra menú contextual con ESC */
    _handleKeyDown(event) {
        if (event.key === 'Escape') {
            if (this.contextMenuVisible) {
                this.contextMenuVisible = false;
            } else if (this.isFullscreen) {
                this.handleCloseFullscreen();
            }
        }
    }

    /** Cierra el menú contextual al hacer clic en cualquier lugar */
    _closeContextMenu() {
        if (this.contextMenuVisible) {
            this.contextMenuVisible = false;
        }
    }

    // ═══════════════════════════════════════════
    //  RENOMBRAR CÁMARA — Sidebar derecha
    // ═══════════════════════════════════════════

    handleStartRename(event) {
        event.stopPropagation();
        this.editingCameraId   = event.currentTarget.dataset.id;
        this.editingCameraName = event.currentTarget.dataset.name;
        this.cameras = this.cameras.map((c) => ({
            ...c,
            isEditing: c.Id === this.editingCameraId
        }));
    }

    handleRenameInputChange(event) {
        this.editingCameraName = event.detail.value;
    }

    handleRenameInputClick(event) {
        event.stopPropagation();
    }

    handleCancelRename(event) {
        event.stopPropagation();
        this.editingCameraId   = null;
        this.editingCameraName = '';
        this.cameras = this.cameras.map((c) => ({ ...c, isEditing: false }));
    }

    handleConfirmRename(event) {
        event.stopPropagation();
        const newName   = (this.editingCameraName || '').trim();
        const cameraId  = this.editingCameraId;
        if (!newName || !cameraId) return;
        this.isRenaming = true;
        renameCamera({ cameraId, newName })
            .then(() => {
                this.editingCameraId   = null;
                this.editingCameraName = '';
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Nombre actualizado',
                        message: `La cámara se ha renombrado a "${newName}".`,
                        variant: 'success'
                    })
                );
                this.loadCameras();
            })
            .catch((err) => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error al renombrar',
                        message: err.body ? err.body.message : 'Error desconocido',
                        variant: 'error'
                    })
                );
            })
            .finally(() => {
                this.isRenaming = false;
            });
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
