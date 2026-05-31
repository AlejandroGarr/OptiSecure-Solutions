import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import processVoiceCommand from '@salesforce/apex/VoiceCommandController.processVoiceCommand';

export default class VoiceAssistant extends LightningElement {

    // ── State ──
    @track isListening = false;
    @track isProcessing = false;
    @track isModalOpen = false;
    @track transcript = '';
    @track aiResponse = null;
    @track errorMessage = '';
    @track isSuccess = false;
    @track expandedCamera = null;
    @track selectedNotification = null;

    _recognition = null;
    _micStream = null;
    _silenceTimer = null;
    _SILENCE_TIMEOUT = 3000;

    // ═══════════════════════════════════════════
    //  GETTERS
    // ═══════════════════════════════════════════

    get micButtonClass() {
        return this.isListening ? 'mic-btn mic-btn--active' : 'mic-btn';
    }

    get micButtonTitle() {
        return this.isListening ? 'Detener grabación' : 'Asistente de voz';
    }

    get modalMicClass() {
        return this.isListening ? 'modal-mic-btn modal-mic-btn--active' : 'modal-mic-btn';
    }

    get showForm() {
        return !this.isSuccess;
    }

    get hasTranscript() {
        return this.transcript && this.transcript.length > 0;
    }

    get isSendDisabled() {
        return this.isProcessing || !this.hasTranscript;
    }

    get showCameraModal() {
        return this.expandedCamera != null;
    }

    get showNotificationModal() {
        return this.selectedNotification != null;
    }

    handleCloseCameraModal() {
        this.expandedCamera = null;
    }

    handleCloseNotificationModal() {
        this.selectedNotification = null;
    }

    // ═══════════════════════════════════════════
    //  HANDLERS — Modal
    // ═══════════════════════════════════════════

    handleOpenModal() {
        this.isModalOpen = true;
        this.isSuccess = false;
        this.isProcessing = false;
        this.errorMessage = '';
        this.transcript = '';
        this.aiResponse = null;
    }

    handleCloseModal() {
        this._stopListening();
        this.isModalOpen = false;
        this.isSuccess = false;
        this.isProcessing = false;
        this.isListening = false;
        this.errorMessage = '';
        this.transcript = '';
        this.aiResponse = null;
    }

    handleBackdropClick() {
        this.handleCloseModal();
    }

    handleModalClick(event) {
        event.stopPropagation();
    }

    // ═══════════════════════════════════════════
    //  HANDLERS — Micrófono
    // ═══════════════════════════════════════════

    handleToggleListening() {
        if (this.isListening) {
            this._stopListening();
        } else {
            this._startListening();
        }
    }

    async _startListening() {
        this.errorMessage = '';

        // 1) Pedir permiso de micrófono (esto lanza el popup del navegador)
        try {
            this._micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (err) {
            this.errorMessage = 'No se pudo acceder al micrófono. Permite el acceso en tu navegador.';
            return;
        }

        // 2) Iniciar reconocimiento de voz
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            this._releaseMic();
            this.errorMessage = 'Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.';
            return;
        }

        try {
            this._recognition = new SpeechRecognition();
            this._recognition.lang = 'es-ES';
            this._recognition.continuous = true;
            this._recognition.interimResults = true;

            this._recognition.onresult = (event) => {
                let finalTranscript = '';
                for (let i = 0; i < event.results.length; i++) {
                    finalTranscript += event.results[i][0].transcript;
                }
                this.transcript = finalTranscript;
                this._resetSilenceTimer();
            };

            this._recognition.onerror = (event) => {
                this.isListening = false;
                if (event.error !== 'aborted') {
                    this.errorMessage = 'Error de reconocimiento: ' + event.error;
                }
                this._releaseMic();
            };

            this._recognition.onend = () => {
                this.isListening = false;
                this._releaseMic();
            };

            this._recognition.start();
            this.isListening = true;
        } catch (err) {
            this._releaseMic();
            this.errorMessage = 'No se pudo iniciar el reconocimiento de voz: ' + (err.message || err);
        }
    }

    _stopListening() {
        this._clearSilenceTimer();
        if (this._recognition) {
            try { this._recognition.stop(); } catch (_e) { /* ignore */ }
            this._recognition = null;
        }
        this._releaseMic();
        this.isListening = false;
    }

    _resetSilenceTimer() {
        this._clearSilenceTimer();
        this._silenceTimer = setTimeout(() => {
            if (this.isListening && this.hasTranscript) {
                this._stopListening();
                this.handleSendCommand();
            }
        }, this._SILENCE_TIMEOUT);
    }

    _clearSilenceTimer() {
        if (this._silenceTimer) {
            clearTimeout(this._silenceTimer);
            this._silenceTimer = null;
        }
    }

    _releaseMic() {
        if (this._micStream) {
            this._micStream.getTracks().forEach(t => t.stop());
            this._micStream = null;
        }
    }

    // ═══════════════════════════════════════════
    //  HANDLERS — Transcript manual edit
    // ═══════════════════════════════════════════

    handleTranscriptChange(event) {
        this.transcript = event.detail.value;
    }

    // ═══════════════════════════════════════════
    //  HANDLERS — Envío a Apex / IA
    // ═══════════════════════════════════════════

    handleSendCommand() {
        if (!this.hasTranscript) {
            this.errorMessage = 'No hay texto para enviar. Habla o escribe un comando.';
            return;
        }

        this._stopListening();
        this.isProcessing = true;
        this.errorMessage = '';
        this.aiResponse = null;

        processVoiceCommand({ userText: this.transcript })
            .then((result) => {
                this.isProcessing = false;
                this.aiResponse = JSON.parse(result);

                if (this.aiResponse.exito) {
                    const accion = this.aiResponse.accion;

                    // Acciones de UI: abrir cámara o notificación directamente
                    if (accion === 'abrir_camara') {
                        if (this.aiResponse.camara && this.aiResponse.camara.url) {
                            this.expandedCamera = this.aiResponse.camara;
                            this.isModalOpen = false;
                        }
                        this.isSuccess = true;
                        this.dispatchEvent(
                            new ShowToastEvent({
                                title: 'Asistente de Voz',
                                message: this.aiResponse.mensaje,
                                variant: 'success',
                                mode: 'dismissable'
                            })
                        );
                    } else if (accion === 'abrir_notificacion') {
                        if (this.aiResponse.notificacion && this.aiResponse.notificacion.clipUrl) {
                            this.selectedNotification = this.aiResponse.notificacion;
                            this.isModalOpen = false;
                        }
                        this.isSuccess = true;
                        this.dispatchEvent(
                            new ShowToastEvent({
                                title: 'Asistente de Voz',
                                message: this.aiResponse.mensaje,
                                variant: 'success',
                                mode: 'dismissable'
                            })
                        );
                    } else {
                        this.isSuccess = true;
                        this.dispatchEvent(
                            new ShowToastEvent({
                                title: 'Comando Ejecutado',
                                message: this.aiResponse.mensaje,
                                variant: 'success',
                                mode: 'dismissable'
                            })
                        );
                        this.dispatchEvent(new CustomEvent('voicecommand', {
                            detail: { action: accion, recordId: this.aiResponse.recordId }
                        }));
                    }
                } else {
                    this.errorMessage = this.aiResponse.mensaje || 'No se pudo ejecutar el comando.';
                }
            })
            .catch((error) => {
                this.isProcessing = false;
                this.errorMessage = this._reduceErrors(error);

                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error',
                        message: 'No se pudo procesar el comando de voz: ' + this.errorMessage,
                        variant: 'error',
                        mode: 'sticky'
                    })
                );
            });
    }

    // ═══════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════

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
