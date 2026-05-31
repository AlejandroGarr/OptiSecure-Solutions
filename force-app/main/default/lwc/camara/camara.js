import { LightningElement, track } from 'lwc';

export default class Camara extends LightningElement {
    @track currentDateTime = '';
    @track expandedCamera = null;
    intervalId;
    _lmsSubscription = null;

    /**
     * 16 cámaras de vigilancia simuladas con streams en vivo 24/7.
     * Organizadas en 4 cuadrantes de 4 cámaras cada uno.
     * Se usan YouTube Live embeds de cámaras reales 24h.
     */
    cameras = [
        // ─── CUADRANTE 1: Perímetro Exterior ───
        {
            id: 'cam-01',
            label: 'CAM 01',
            zone: 'Entrada Principal',
            location: 'Perímetro Norte',
            status: 'ONLINE',
            url: 'https://www.youtube.com/embed/ByED80IKdIU?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&loop=1&modestbranding=1&playsinline=1'
        },
        {
            id: 'cam-02',
            label: 'CAM 02',
            zone: 'Parking Visitantes',
            location: 'Perímetro Norte',
            status: 'ONLINE',
            url: 'https://www.youtube.com/embed/1EiC9bvVGnk?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&loop=1&modestbranding=1&playsinline=1'
        },
        {
            id: 'cam-03',
            label: 'CAM 03',
            zone: 'Valla Perimetral',
            location: 'Perímetro Este',
            status: 'ONLINE',
            url: 'https://www.youtube.com/embed/AdUw5RdyZxI?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&loop=1&modestbranding=1&playsinline=1'
        },
        {
            id: 'cam-04',
            label: 'CAM 04',
            zone: 'Acceso Carga',
            location: 'Perímetro Sur',
            status: 'ONLINE',
            url: 'https://www.youtube.com/embed/gGzRFEbdOg4?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&loop=1&modestbranding=1&playsinline=1'
        },
        // ─── CUADRANTE 2: Zonas Interiores ───
        {
            id: 'cam-05',
            label: 'CAM 05',
            zone: 'Vestíbulo Central',
            location: 'Interior Planta 0',
            status: 'ONLINE',
            url: 'https://www.youtube.com/embed/eJ7ZkQ5TC08?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&loop=1&modestbranding=1&playsinline=1'
        },
        {
            id: 'cam-06',
            label: 'CAM 06',
            zone: 'Pasillo Oficinas',
            location: 'Interior Planta 1',
            status: 'ONLINE',
            url: 'https://www.youtube.com/embed/MWP8vVMgFZ8?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&loop=1&modestbranding=1&playsinline=1'
        },
        {
            id: 'cam-07',
            label: 'CAM 07',
            zone: 'Sala Servidores',
            location: 'Interior Planta -1',
            status: 'ONLINE',
            url: 'https://www.youtube.com/embed/W_gYxMSt_qI?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&loop=1&modestbranding=1&playsinline=1'
        },
        {
            id: 'cam-08',
            label: 'CAM 08',
            zone: 'Escaleras Emergencia',
            location: 'Interior Planta 0-2',
            status: 'ONLINE',
            url: 'https://www.youtube.com/embed/vCYpmMHTCjA?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&loop=1&modestbranding=1&playsinline=1'
        },
        // ─── CUADRANTE 3: Almacenes y Logística ───
        {
            id: 'cam-09',
            label: 'CAM 09',
            zone: 'Almacén Zona A',
            location: 'Nave Industrial',
            status: 'ONLINE',
            url: 'https://www.youtube.com/embed/4xDzrJKXOOY?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&loop=1&modestbranding=1&playsinline=1'
        },
        {
            id: 'cam-10',
            label: 'CAM 10',
            zone: 'Almacén Zona B',
            location: 'Nave Industrial',
            status: 'ONLINE',
            url: 'https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&loop=1&modestbranding=1&playsinline=1'
        },
        {
            id: 'cam-11',
            label: 'CAM 11',
            zone: 'Muelle de Carga',
            location: 'Zona Logística',
            status: 'ONLINE',
            url: 'https://www.youtube.com/embed/nTmkpqFJwqA?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&loop=1&modestbranding=1&playsinline=1'
        },
        {
            id: 'cam-12',
            label: 'CAM 12',
            zone: 'Control de Acceso',
            location: 'Zona Logística',
            status: 'ONLINE',
            url: 'https://www.youtube.com/embed/Cp3eFJSsBMM?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&loop=1&modestbranding=1&playsinline=1'
        },
        // ─── CUADRANTE 4: Áreas Críticas ───
        {
            id: 'cam-13',
            label: 'CAM 13',
            zone: 'Centro de Control',
            location: 'Área Restringida',
            status: 'ONLINE',
            url: 'https://www.youtube.com/embed/fSGvsi_RYOQ?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&loop=1&modestbranding=1&playsinline=1'
        },
        {
            id: 'cam-14',
            label: 'CAM 14',
            zone: 'Bóveda Seguridad',
            location: 'Área Restringida',
            status: 'ONLINE',
            url: 'https://www.youtube.com/embed/cof4VRkOmWg?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&loop=1&modestbranding=1&playsinline=1'
        },
        {
            id: 'cam-15',
            label: 'CAM 15',
            zone: 'Azotea / Helipuerto',
            location: 'Exterior Superior',
            status: 'ONLINE',
            url: 'https://www.youtube.com/embed/Y2WKLnIELBo?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&loop=1&modestbranding=1&playsinline=1'
        },
        {
            id: 'cam-16',
            label: 'CAM 16',
            zone: 'Parking Subterráneo',
            location: 'Planta -2',
            status: 'ONLINE',
            url: 'https://www.youtube.com/embed/qo1MYEFAEdo?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&loop=1&modestbranding=1&playsinline=1'
        }
    ];

    /**
     * Cuadrantes: agrupa las 16 cámaras en 4 bloques de 4 (pantalla dividida).
     */
    get quadrants() {
        const q = [
            { id: 'q1', title: 'SECTOR A — Perímetro Exterior', cameras: this.cameras.slice(0, 4) },
            { id: 'q2', title: 'SECTOR B — Zonas Interiores', cameras: this.cameras.slice(4, 8) },
            { id: 'q3', title: 'SECTOR C — Almacenes y Logística', cameras: this.cameras.slice(8, 12) },
            { id: 'q4', title: 'SECTOR D — Áreas Críticas', cameras: this.cameras.slice(12, 16) }
        ];
        return q;
    }

    get totalCameras() {
        return this.cameras.length;
    }

    get onlineCameras() {
        return this.cameras.filter(c => c.status === 'ONLINE').length;
    }

    get showExpandedModal() {
        return this.expandedCamera != null;
    }

    connectedCallback() {
        this.updateDateTime();
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this.intervalId = setInterval(() => {
            this.updateDateTime();
        }, 1000);
        this._subscribeLMS();
    }

    disconnectedCallback() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
        window.removeEventListener('message', this._boundVoiceHandler);
    }

    _subscribeLMS() {
        console.log('[Camara] Subscribiendo a window message...');
        this._boundVoiceHandler = (event) => {
            console.log('[Camara] message recibido:', JSON.stringify(event.data));
            if (event.data && event.data.type === 'voiceassistantcommand') {
                const message = event.data;
                console.log('[Camara] Comando recibido - action:', message.action, 'cameraNumber:', message.cameraNumber);
                if (message.action === 'abrir_camara' && message.cameraNumber) {
                    const num = message.cameraNumber;
                    const camId = 'cam-' + String(num).padStart(2, '0');
                    console.log('[Camara] Buscando camId:', camId);
                    const found = this.cameras.find(c => c.id === camId);
                    console.log('[Camara] Encontrada:', found ? found.label : 'NO');
                    if (found) {
                        this.expandedCamera = found;
                    }
                }
            }
        };
        window.addEventListener('message', this._boundVoiceHandler);
        console.log('[Camara] Suscripción completada');
    }

    handleCamClick(event) {
        const camId = event.currentTarget.dataset.id;
        const found = this.cameras.find(c => c.id === camId);
        if (found) {
            this.expandedCamera = found;
        }
    }

    handleCloseExpanded() {
        this.expandedCamera = null;
    }

    updateDateTime() {
        const now = new Date();
        const options = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        };
        this.currentDateTime = now.toLocaleString('es-ES', options);
    }

    handleFullscreen() {
        const container = this.template.querySelector('.camera-monitor');
        if (container) {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                container.requestFullscreen();
            }
        }
    }
}