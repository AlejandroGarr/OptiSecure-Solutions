import { LightningElement, api } from 'lwc';
import getRecentAlerts from '@salesforce/apex/SecurityClipController.getRecentAlerts';

export default class ClipNotifications extends LightningElement {
    @api recordId;

    alerts = [];
    isLoading = true;
    error;
    selectedAlert = null;

    connectedCallback() {
        this.loadAlerts();
    }

    async loadAlerts() {
        this.isLoading = true;
        this.error     = undefined;
        try {
            const result = await getRecentAlerts();
            this.alerts = (result || []).map(alert => ({
                ...alert,
                formattedDate: this._formatDate(alert.createdDate),
                cameraName: this._extractCamera(alert.subject)
            }));
        } catch (err) {
            this.error = err.body?.message || 'Error al cargar las notificaciones';
            console.error('ClipNotifications — error:', err);
        } finally {
            this.isLoading = false;
        }
    }

    get showContent() {
        return !this.isLoading && !this.error;
    }

    get hasAlerts() {
        return this.alerts && this.alerts.length > 0;
    }

    get showPlayer() {
        return this.selectedAlert != null;
    }

    handleRefresh() {
        this.loadAlerts();
    }

    handleOpenClip(event) {
        const taskId = event.currentTarget.dataset.id;
        this.selectedAlert = this.alerts.find(a => a.taskId === taskId) || null;
    }

    handleClosePlayer() {
        this.selectedAlert = null;
    }

    handleOpenExternal() {
        if (this.selectedAlert && this.selectedAlert.clipUrl) {
            window.open(this.selectedAlert.clipUrl, '_blank');
        }
    }

    _formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleString('es-ES', {
            day:    '2-digit',
            month:  '2-digit',
            year:   'numeric',
            hour:   '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    _extractCamera(subject) {
        if (!subject) return '';
        const match = subject.match(/Persona detectada - (.+)/);
        return match ? match[1] : '';
    }
}
