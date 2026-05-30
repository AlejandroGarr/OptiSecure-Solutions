/**
 * @description       : 
 * @author            : ChangeMeIn@UserSettingsUnder.SFDoc
 * @group             : 
 * @last modified on  : 05-30-2026
 * @last modified by  : ChangeMeIn@UserSettingsUnder.SFDoc
**/

public with sharing class CaseViewerController {

    public class CaseInfo {
        @AuraEnabled public String id;
        @AuraEnabled public String caseNumber;
        @AuraEnabled public String subject;
        @AuraEnabled public String status;
        @AuraEnabled public String priority;
        @AuraEnabled public String createdDate;
        @AuraEnabled public String description;
        @AuraEnabled public String contactName;
        @AuraEnabled public String contactEmail;
    }

    public class ChatMessage {
        @AuraEnabled public String id;
        @AuraEnabled public String body;
        @AuraEnabled public String createdByName;
        @AuraEnabled public String createdDate;
        @AuraEnabled public Boolean isCurrentUser;
    }

    @AuraEnabled(cacheable=true)
    public static List<CaseInfo> getUserCases() {
        try {
            Id currentUserId = UserInfo.getUserId();

            User u = [
                SELECT ContactId
                FROM   User
                WHERE  Id = :currentUserId
                WITH   SECURITY_ENFORCED
                LIMIT  1
            ];

            List<Case> cases;
            if (u.ContactId != null) {
                cases = [
                    SELECT Id, CaseNumber, Subject, Status, Priority,
                           CreatedDate, Description,
                           Contact.Name, Contact.Email
                    FROM   Case
                    WHERE  ContactId = :u.ContactId
                    WITH   SECURITY_ENFORCED
                    ORDER BY CreatedDate DESC
                    LIMIT  50
                ];
            } else {
                // Admin u otro usuario interno: mostrar sus casos propios
                cases = [
                    SELECT Id, CaseNumber, Subject, Status, Priority,
                           CreatedDate, Description,
                           Contact.Name, Contact.Email
                    FROM   Case
                    WHERE  OwnerId = :currentUserId
                    WITH   SECURITY_ENFORCED
                    ORDER BY CreatedDate DESC
                    LIMIT  50
                ];
            }

            List<CaseInfo> result = new List<CaseInfo>();
            for (Case c : cases) {
                CaseInfo ci       = new CaseInfo();
                ci.id             = c.Id;
                ci.caseNumber     = c.CaseNumber;
                ci.subject        = c.Subject;
                ci.status         = c.Status;
                ci.priority       = c.Priority;
                ci.createdDate    = c.CreatedDate.format('dd/MM/yyyy HH:mm');
                ci.description    = c.Description;
                ci.contactName    = c.Contact != null ? c.Contact.Name : null;
                ci.contactEmail   = c.Contact != null ? c.Contact.Email : null;
                result.add(ci);
            }
            return result;
        } catch (Exception e) {
            throw new AuraHandledException(
                'Error al obtener los casos: ' + e.getMessage()
            );
        }
    }


    @AuraEnabled
    public static List<ChatMessage> getCaseComments(Id caseId) {
        try {
            Id currentUserId = UserInfo.getUserId();

            List<CaseComment> comments = [
                SELECT Id, CommentBody, CreatedBy.Name, CreatedDate
                FROM   CaseComment
                WHERE  ParentId = :caseId
                WITH   SECURITY_ENFORCED
                ORDER BY CreatedDate ASC
            ];

            List<ChatMessage> result = new List<ChatMessage>();
            for (CaseComment cc : comments) {
                ChatMessage msg     = new ChatMessage();
                msg.id              = cc.Id;
                msg.body            = cc.CommentBody;
                msg.createdByName   = cc.CreatedBy.Name;
                msg.createdDate     = cc.CreatedDate.format('dd/MM/yyyy HH:mm');
                msg.isCurrentUser   = (cc.CreatedById == currentUserId);
                result.add(msg);
            }
            return result;
        } catch (Exception e) {
            throw new AuraHandledException(
                'Error al obtener los comentarios: ' + e.getMessage()
            );
        }
    }

    @AuraEnabled
    public static ChatMessage addCaseComment(Id caseId, String body) {
        try {
            CaseComment cc = new CaseComment(
                ParentId    = caseId,
                CommentBody = body,
                IsPublished = true
            );
            insert cc;

            // Re-query para obtener el nombre del creador
            cc = [
                SELECT Id, CommentBody, CreatedBy.Name, CreatedDate, CreatedById
                FROM   CaseComment
                WHERE  Id = :cc.Id
                WITH   SECURITY_ENFORCED
                LIMIT  1
            ];

            ChatMessage msg     = new ChatMessage();
            msg.id              = cc.Id;
            msg.body            = cc.CommentBody;
            msg.createdByName   = cc.CreatedBy.Name;
            msg.createdDate     = cc.CreatedDate.format('dd/MM/yyyy HH:mm');
            msg.isCurrentUser   = true;
            return msg;
        } catch (Exception e) {
            throw new AuraHandledException(
                'Error al enviar el mensaje: ' + e.getMessage()
            );
        }
    }
}
