import { LightningElement, wire, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getCameraOptions from '@salesforce/apex/CameraIncidentController.getCameraOptions';
import createCameraIncident from '@salesforce/apex/CameraIncidentController.createCameraIncident';

/**
 * @description LWC que muestra un botón "Reportar Incidencia" y abre un modal
 *              con un formulario para crear un Case en Salesforce vinculado a
 *              una cámara de seguridad que no funciona correctamente.
 *              Diseñado para usuarios de Experience Cloud.
 * @author      OptiSecure Solutions
 * @date        2026-02-26
 */
export default class CameraIncidentReport extends LightningElement {

    // ── State del modal ──
    @track isModalOpen = false;
    @track isSubmitting = false;
    @track isSuccess = false;
    @track createdCaseId = '';
    @track errorMessage = '';

    // ── Campos del formulario ──
    @track selectedCameraId = '';
    @track subject = '';
    @track description = '';
    @track priority = 'Medium';

    // ── Opciones para comboboxes ──
    @track cameraOptions = [];

    get priorityOptions() {
        return [
            { label: '🔴 Alta — Cámara completamente inoperativa', value: 'High' },
            { label: '🟡 Media — Cámara con funcionamiento parcial', value: 'Medium' },
            { label: '🟢 Baja — Problema menor o estético', value: 'Low' }
        ];
    }

    /** Mostrar formulario solo si no estamos en estado de éxito */
    get showForm() {
        return !this.isSuccess;
    }

    // ═══════════════════════════════════════════
    //  WIRE — Carga de opciones de cámara
    // ═══════════════════════════════════════════

    @wire(getCameraOptions)
    wiredCameraOptions({ data, error }) {
        if (data) {
            this.cameraOptions = data.map((opt) => ({
                label: opt.label,
                value: opt.value
            }));
        } else if (error) {
            console.error('Error al cargar cámaras:', JSON.stringify(error));
        }
    }

    // ═══════════════════════════════════════════
    //  HANDLERS — Apertura / cierre del modal
    // ═══════════════════════════════════════════

    handleOpenModal() {
        this.isModalOpen = true;
        this.isSuccess = false;
        this.isSubmitting = false;
        this.errorMessage = '';
        this._resetForm();
    }

    handleCloseModal() {
        this.isModalOpen = false;
        this.isSuccess = false;
        this.isSubmitting = false;
        this.errorMessage = '';
        this._resetForm();
    }

    /** Cierra el modal al hacer clic en el backdrop */
    handleBackdropClick() {
        this.handleCloseModal();
    }

    /** Evita que el clic dentro del modal cierre el backdrop */
    handleModalClick(event) {
        event.stopPropagation();
    }

    // ═══════════════════════════════════════════
    //  HANDLERS — Campos del formulario
    // ═══════════════════════════════════════════

    handleCameraChange(event) {
        this.selectedCameraId = event.detail.value;
    }

    handleSubjectChange(event) {
        this.subject = event.detail.value;
    }

    handlePriorityChange(event) {
        this.priority = event.detail.value;
    }

    handleDescriptionChange(event) {
        this.description = event.detail.value;
    }

    // ═══════════════════════════════════════════
    //  SUBMIT — Enviar incidencia
    // ═══════════════════════════════════════════

    handleSubmit() {
        // Validar campos obligatorios
        if (!this._validateForm()) {
            return;
        }

        this.isSubmitting = true;
        this.errorMessage = '';

        createCameraIncident({
            cameraId: this.selectedCameraId,
            subject: this.subject,
            description: this.description,
            priority: this.priority
        })
            .then((caseId) => {
                this.createdCaseId = caseId;
                this.isSuccess = true;
                this.isSubmitting = false;

                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Incidencia Registrada',
                        message: 'Se ha creado el caso ' + caseId + ' correctamente.',
                        variant: 'success',
                        mode: 'dismissable'
                    })
                );

                // Notificar al componente padre
                this.dispatchEvent(new CustomEvent('incidentcreated', {
                    detail: { caseId: caseId }
                }));
            })
            .catch((error) => {
                this.isSubmitting = false;
                this.errorMessage = this._reduceErrors(error);

                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error',
                        message: 'No se pudo crear la incidencia: ' + this.errorMessage,
                        variant: 'error',
                        mode: 'sticky'
                    })
                );
            });
    }

    // ═══════════════════════════════════════════
    //  PRIVATE HELPERS
    // ═══════════════════════════════════════════

    _validateForm() {
        const allValid = [
            ...this.template.querySelectorAll('lightning-combobox, lightning-input, lightning-textarea')
        ].reduce((valid, input) => {
            input.reportValidity();
            return valid && input.checkValidity();
        }, true);

        if (!allValid) {
            this.errorMessage = 'Por favor, complete todos los campos obligatorios.';
            return false;
        }

        return true;
    }

    _resetForm() {
        this.selectedCameraId = '';
        this.subject = '';
        this.description = '';
        this.priority = 'Medium';
        this.createdCaseId = '';
    }

    _reduceErrors(error) {
        if (typeof error === 'string') return error;
        if (error?.body?.message) return error.body.message;
        if (error?.message) return error.message;
        if (Array.isArray(error?.body)) {
            return error.body.map((e) => e.message).join(', ');
        }
        return 'Error desconocido';
    }
}
