import { LightningElement, track, wire } from 'lwc';
import { refreshApex }               from '@salesforce/apex';
import getUserCases     from '@salesforce/apex/CaseViewerController.getUserCases';
import getCaseComments  from '@salesforce/apex/CaseViewerController.getCaseComments';
import addCaseComment   from '@salesforce/apex/CaseViewerController.addCaseComment';

/**
 * @description LWC que muestra un botón "Casos" en el footer del mapa.
 *              Al pulsar, abre un modal con la lista de casos del usuario
 *              y permite ver el detalle + chat de cada caso.
 * @author      OptiSecure Solutions
 */
export default class CaseViewer extends LightningElement {

    // ── Estado del modal ──
    @track isModalOpen   = false;
    @track selectedCase  = null;
    @track chatMessages  = [];
    @track newMessage    = '';
    @track isSending     = false;
    @track isLoadingChat = false;
    @track errorMessage  = '';

    // ── Datos wired ──
    _wiredCasesResult;
    @track cases = [];

    // ═══════════════════════════════════════════
    //  WIRE — Lista de casos
    // ═══════════════════════════════════════════

    @wire(getUserCases)
    wiredCases(result) {
        this._wiredCasesResult = result;
        if (result.data) {
            this.cases = result.data;
        } else if (result.error) {
            console.error('Error al cargar casos:', JSON.stringify(result.error));
        }
    }

    // ═══════════════════════════════════════════
    //  GETTERS
    // ═══════════════════════════════════════════

    get hasCases() {
        return this.cases && this.cases.length > 0;
    }

    get showList() {
        return !this.selectedCase;
    }

    get showDetail() {
        return !!this.selectedCase;
    }

    get hasChatMessages() {
        return this.chatMessages && this.chatMessages.length > 0;
    }

    get isSendDisabled() {
        return !this.newMessage || !this.newMessage.trim() || this.isSending;
    }

    get caseCount() {
        return this.cases ? this.cases.length : 0;
    }

    get caseList() {
        return this.cases.map(c => ({
            ...c,
            priorityClass: 'priority-badge priority-' + (c.priority || 'medium').toLowerCase(),
            statusClass:   'status-badge status-' + (c.status || 'new').toLowerCase().replace(/\s/g, '-')
        }));
    }

    get detailPriorityClass() {
        if (!this.selectedCase) return '';
        return 'priority-badge priority-' + (this.selectedCase.priority || 'medium').toLowerCase();
    }

    get detailStatusClass() {
        if (!this.selectedCase) return '';
        return 'status-badge status-' + (this.selectedCase.status || 'new').toLowerCase().replace(/\s/g, '-');
    }

    // ═══════════════════════════════════════════
    //  MODAL — Abrir / cerrar
    // ═══════════════════════════════════════════

    handleOpenModal() {
        this.isModalOpen  = true;
        this.selectedCase = null;
        this.chatMessages = [];
        this.newMessage   = '';
        this.errorMessage = '';
        refreshApex(this._wiredCasesResult);
    }

    handleCloseModal() {
        this.isModalOpen  = false;
        this.selectedCase = null;
        this.chatMessages = [];
        this.newMessage   = '';
        this.errorMessage = '';
    }

    handleBackdropClick() {
        this.handleCloseModal();
    }

    handleModalClick(event) {
        event.stopPropagation();
    }

    // ═══════════════════════════════════════════
    //  LISTA → DETALLE
    // ═══════════════════════════════════════════

    handleCaseClick(event) {
        const caseId = event.currentTarget.dataset.id;
        const found = this.cases.find(c => c.id === caseId);
        if (found) {
            this.selectedCase = found;
            this._loadComments(caseId);
        }
    }

    handleBack() {
        this.selectedCase = null;
        this.chatMessages = [];
        this.newMessage   = '';
        this.errorMessage = '';
    }

    // ═══════════════════════════════════════════
    //  CHAT — Cargar comentarios
    // ═══════════════════════════════════════════

    _loadComments(caseId) {
        this.isLoadingChat = true;
        this.chatMessages  = [];
        getCaseComments({ caseId })
            .then(data => {
                this.chatMessages = data.map(msg => ({
                    ...msg,
                    bubbleClass: msg.isCurrentUser ? 'chat-bubble chat-bubble-mine' : 'chat-bubble chat-bubble-other'
                }));
                this._scrollChatToBottom();
            })
            .catch(err => {
                console.error('Error al cargar comentarios:', JSON.stringify(err));
            })
            .finally(() => {
                this.isLoadingChat = false;
            });
    }

    // ═══════════════════════════════════════════
    //  CHAT — Enviar mensaje
    // ═══════════════════════════════════════════

    handleMessageChange(event) {
        this.newMessage = event.target.value;
    }

    handleKeyPress(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.handleSendMessage();
        }
    }

    handleSendMessage() {
        if (this.isSendDisabled || !this.selectedCase) return;

        this.isSending    = true;
        this.errorMessage = '';
        const body = this.newMessage.trim();

        addCaseComment({ caseId: this.selectedCase.id, body })
            .then(msg => {
                this.chatMessages = [
                    ...this.chatMessages,
                    {
                        ...msg,
                        bubbleClass: 'chat-bubble chat-bubble-mine'
                    }
                ];
                this.newMessage = '';
                this._scrollChatToBottom();
            })
            .catch(err => {
                this.errorMessage = err.body ? err.body.message : 'Error al enviar el mensaje';
            })
            .finally(() => {
                this.isSending = false;
            });
    }

    // ═══════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════

    _scrollChatToBottom() {
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
            const chatContainer = this.template.querySelector('.chat-messages');
            if (chatContainer) {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
        }, 100);
    }
}
