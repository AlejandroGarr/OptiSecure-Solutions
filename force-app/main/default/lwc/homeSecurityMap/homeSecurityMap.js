// 1. AÑADIDO 'api' AQUÍ ARRIBA
import { LightningElement, wire, track, api } from 'lwc';
import HOUSE_MAP from '@salesforce/resourceUrl/Plano_Casa_1'; 
import getCamaras from '@salesforce/apex/HouseMapController.getCamaras';

export default class HomeSecurityMap extends LightningElement {
    // 2. AÑADIDO ESTA LÍNEA PARA CORREGIR EL ERROR
    @api componentTitle; 

    mapImageUrl = HOUSE_MAP;
    
    @track camaras = []; 
    @track isModalOpen = false;
    @track currentVideoUrl = '';

    @wire(getCamaras)
    wiredCameras({ error, data }) {
        if (data) {
            this.camaras = data.map(cam => {
                return {
                    ...cam, 
                    cssStyle: `top: ${cam.Posicion_Y__c}%; left: ${cam.Posicion_X__c}%;`
                };
            });
        } else if (error) {
            console.error('Error cargando cámaras:', error);
        }
    }

    handlePinClick(event) {
        const videoUrl = event.currentTarget.dataset.video;
        this.currentVideoUrl = videoUrl;
        this.isModalOpen = true; 
    }

    closeModal() {
        this.isModalOpen = false;
        this.currentVideoUrl = ''; 
    }
}