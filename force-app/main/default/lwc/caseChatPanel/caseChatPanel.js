import { LightningElement, api, track } from 'lwc';
import getCaseComments from '@salesforce/apex/CaseViewerController.getCaseComments';
import addCaseComment  from '@salesforce/apex/CaseViewerController.addCaseComment';

/**
 * @description Componente de chat para la ficha de Caso en CRM.
 *              El admin puede ver y enviar comentarios al cliente.
 * @author      OptiSecure Solutions
 */
export default class CaseChatPanel extends LightningElement {

    @api recordId;

    @track chatMessages  = [];
    @track newMessage    = '';
    @track isSending     = false;
    @track isLoading     = true;
    @track errorMessage  = '';

    // ═══════════════════════════════════════════
    //  LIFECYCLE
    // ═══════════════════════════════════════════

    connectedCallback() {
        this._loadComments();
    }

    // ═══════════════════════════════════════════
    //  GETTERS
    // ═══════════════════════════════════════════

    get hasChatMessages() {
        return this.chatMessages && this.chatMessages.length > 0;
    }

    get isSendDisabled() {
        return !this.newMessage || !this.newMessage.trim() || this.isSending;
    }

    // ═══════════════════════════════════════════
    //  CARGAR COMENTARIOS
    // ═══════════════════════════════════════════

    _loadComments() {
        this.isLoading = true;
        getCaseComments({ caseId: this.recordId })
            .then(data => {
                this.chatMessages = data.map(msg => ({
                    ...msg,
                    bubbleClass: msg.isCurrentUser
                        ? 'chat-bubble chat-bubble-mine'
                        : 'chat-bubble chat-bubble-other'
                }));
                this._scrollChatToBottom();
            })
            .catch(err => {
                console.error('Error al cargar comentarios:', JSON.stringify(err));
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    handleRefresh() {
        this._loadComments();
    }

    // ═══════════════════════════════════════════
    //  ENVIAR MENSAJE
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
        if (this.isSendDisabled) return;

        this.isSending    = true;
        this.errorMessage = '';
        const body = this.newMessage.trim();

        addCaseComment({ caseId: this.recordId, body })
            .then(msg => {
                this.chatMessages = [
                    ...this.chatMessages,
                    { ...msg, bubbleClass: 'chat-bubble chat-bubble-mine' }
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
