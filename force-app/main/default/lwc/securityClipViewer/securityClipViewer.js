/**
 * @description Componente LWC para visualizar clips de seguridad grabados
 *              automáticamente por el sistema de detección de personas (YOLOv8).
 *              Funciona en páginas de registro Camara__c, Contact, o standalone.
 * @author      OptiSecure Solutions
 * @date        2026-04-05
 */
import { LightningElement, api } from 'lwc';
import getClipsForCamera  from '@salesforce/apex/SecurityClipController.getClipsForCamera';
import getClipsForContact from '@salesforce/apex/SecurityClipController.getClipsForContact';
import getMyClips         from '@salesforce/apex/SecurityClipController.getMyClips';

export default class SecurityClipViewer extends LightningElement {
    @api recordId;
    @api objectApiName;

    clips = [];
    isLoading = true;
    error;
    selectedClip = null;

    connectedCallback() {
        this.loadClips();
    }

    async loadClips() {
        this.isLoading = true;
        this.error     = undefined;
        try {
            let result;
            if (this.objectApiName === 'Camara__c' && this.recordId) {
                result = await getClipsForCamera({ cameraId: this.recordId });
            } else if (this.objectApiName === 'Contact' && this.recordId) {
                result = await getClipsForContact({ contactId: this.recordId });
            } else {
                // Standalone o página genérica: auto-detectar usuario
                result = await getMyClips();
            }
            this.clips = result || [];
        } catch (error) {
            this.error = error.body?.message || 'Error al cargar los clips de seguridad';
            console.error('SecurityClipViewer — error:', error);
        } finally {
            this.isLoading = false;
        }
    }

    // ─── Getters computados ───

    get showContent() {
        return !this.isLoading && !this.error;
    }

    get hasClips() {
        return this.clips && this.clips.length > 0;
    }

    get showPlayer() {
        return this.selectedClip != null;
    }

    get selectedClipUrl() {
        if (!this.selectedClip) return '';
        return '/sfc/servlet.shepherd/version/download/' + this.selectedClip.contentVersionId;
    }

    get formattedClips() {
        return this.clips.map(clip => ({
            ...clip,
            formattedDate: this._formatDate(clip.createdDate),
            formattedSize: this._formatSize(clip.fileSize)
        }));
    }

    // ─── Handlers ───

    handleClipClick(event) {
        const clipId = event.currentTarget.dataset.id;
        this.selectedClip = this.clips.find(c => c.contentVersionId === clipId) || null;
    }

    handleClosePlayer() {
        this.selectedClip = null;
    }

    handleDownload(event) {
        event.stopPropagation();
        const url = event.currentTarget.dataset.url;
        if (url) {
            window.open(url, '_blank');
        }
    }

    handleRefresh() {
        this.loadClips();
    }

    // ─── Utilidades ───

    _formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleString('es-ES', {
            day:    '2-digit',
            month:  '2-digit',
            year:   'numeric',
            hour:   '2-digit',
            minute: '2-digit'
        });
    }

    _formatSize(bytes) {
        if (!bytes) return '';
        if (bytes < 1024)    return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }
}
