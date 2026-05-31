/**
 * @description       : 
 * @author            : ChangeMeIn@UserSettingsUnder.SFDoc
 * @group             : 
 * @last modified on  : 05-30-2026
 * @last modified by  : ChangeMeIn@UserSettingsUnder.SFDoc
**/

public with sharing class SecurityClipController {

    @AuraEnabled(cacheable=false)
    public static List<ClipInfo> getClipsForCamera(Id cameraId) {
        List<ClipInfo> clips = new List<ClipInfo>();

        List<ContentDocumentLink> links = [
            SELECT ContentDocumentId,
                   ContentDocument.Title,
                   ContentDocument.CreatedDate,
                   ContentDocument.ContentSize,
                   ContentDocument.LatestPublishedVersionId,
                   ContentDocument.FileExtension
            FROM   ContentDocumentLink
            WHERE  LinkedEntityId = :cameraId
            AND    ContentDocument.FileExtension = 'mp4'
            ORDER BY ContentDocument.CreatedDate DESC
            LIMIT  50
        ];

        for (ContentDocumentLink link : links) {
            clips.add(buildClipInfo(link, null));
        }
        return clips;
    }

    @AuraEnabled(cacheable=false)
    public static List<ClipInfo> getClipsForContact(Id contactId) {
        List<ClipInfo> clips = new List<ClipInfo>();

        // Obtener cámaras del contacto
        List<Camara__c> cameras = [
            SELECT Id, Name
            FROM   Camara__c
            WHERE  Contacto__c = :contactId
            AND    Activa__c = TRUE
        ];

        if (cameras.isEmpty()) {
            return clips;
        }

        Set<Id> cameraIds = new Set<Id>();
        Map<Id, String> cameraNames = new Map<Id, String>();
        for (Camara__c cam : cameras) {
            cameraIds.add(cam.Id);
            cameraNames.put(cam.Id, cam.Name);
        }

        List<ContentDocumentLink> links = [
            SELECT LinkedEntityId,
                   ContentDocumentId,
                   ContentDocument.Title,
                   ContentDocument.CreatedDate,
                   ContentDocument.ContentSize,
                   ContentDocument.LatestPublishedVersionId,
                   ContentDocument.FileExtension
            FROM   ContentDocumentLink
            WHERE  LinkedEntityId IN :cameraIds
            AND    ContentDocument.FileExtension = 'mp4'
            ORDER BY ContentDocument.CreatedDate DESC
            LIMIT  100
        ];

        for (ContentDocumentLink link : links) {
            String camName = cameraNames.get(link.LinkedEntityId);
            clips.add(buildClipInfo(link, camName));
        }
        return clips;
    }

    @AuraEnabled(cacheable=false)
    public static List<ClipInfo> getMyClips() {
        User currentUser = [
            SELECT ContactId
            FROM   User
            WHERE  Id = :UserInfo.getUserId()
            LIMIT  1
        ];

        // Usuario de portal → filtrar por su contacto
        if (currentUser.ContactId != null) {
            return getClipsForContact(currentUser.ContactId);
        }

        // Admin → todos los clips recientes
        List<ClipInfo> clips = new List<ClipInfo>();

        // Obtener todas las cámaras activas
        List<Camara__c> cameras = [
            SELECT Id, Name
            FROM   Camara__c
            WHERE  Activa__c = TRUE
        ];

        if (cameras.isEmpty()) {
            return clips;
        }

        Set<Id> cameraIds = new Set<Id>();
        Map<Id, String> cameraNames = new Map<Id, String>();
        for (Camara__c cam : cameras) {
            cameraIds.add(cam.Id);
            cameraNames.put(cam.Id, cam.Name);
        }

        List<ContentDocumentLink> links = [
            SELECT LinkedEntityId,
                   ContentDocumentId,
                   ContentDocument.Title,
                   ContentDocument.CreatedDate,
                   ContentDocument.ContentSize,
                   ContentDocument.LatestPublishedVersionId,
                   ContentDocument.FileExtension
            FROM   ContentDocumentLink
            WHERE  LinkedEntityId IN :cameraIds
            AND    ContentDocument.FileExtension = 'mp4'
            ORDER BY ContentDocument.CreatedDate DESC
            LIMIT  100
        ];

        for (ContentDocumentLink link : links) {
            String camName = cameraNames.get(link.LinkedEntityId);
            clips.add(buildClipInfo(link, camName));
        }
        return clips;
    }

    private static ClipInfo buildClipInfo(ContentDocumentLink link, String cameraName) {
        ClipInfo clip       = new ClipInfo();
        clip.contentDocumentId = link.ContentDocumentId;
        clip.contentVersionId  = link.ContentDocument.LatestPublishedVersionId;
        clip.title             = link.ContentDocument.Title;
        clip.cameraName        = cameraName;
        clip.createdDate       = link.ContentDocument.CreatedDate;
        clip.fileSize          = link.ContentDocument.ContentSize;
        clip.downloadUrl       = '/sfc/servlet.shepherd/version/download/'
                               + link.ContentDocument.LatestPublishedVersionId;
        return clip;
    }

    public class ClipInfo {
        @AuraEnabled public String   contentDocumentId;
        @AuraEnabled public String   contentVersionId;
        @AuraEnabled public String   title;
        @AuraEnabled public String   cameraName;
        @AuraEnabled public Datetime createdDate;
        @AuraEnabled public Long     fileSize;
        @AuraEnabled public String   downloadUrl;
    }

    @AuraEnabled(cacheable=false)
    public static List<AlertInfo> getRecentAlerts() {
        return new AlertHelper().fetchAlerts();
    }

    @AuraEnabled
    public static void deleteAlert(Id taskId) {
        new AlertHelper().removeAlert(taskId);
    }
    private without sharing class AlertHelper {
        public void removeAlert(Id taskId) {
            List<Task> tasks = [
                SELECT Id FROM Task
                WHERE  Id = :taskId
                AND    Subject LIKE '%Persona detectada%'
                LIMIT  1
            ];
            if (!tasks.isEmpty()) {
                delete tasks;
            }
        }

        public List<AlertInfo> fetchAlerts() {
            User currentUser = [
                SELECT ContactId
                FROM   User
                WHERE  Id = :UserInfo.getUserId()
                LIMIT  1
            ];

            List<Task> tasks;

            if (currentUser.ContactId != null) {
                tasks = [
                    SELECT Id, Subject, Description, CreatedDate,
                           Who.Name
                    FROM   Task
                    WHERE  Subject LIKE '%Persona detectada%'
                    AND    WhoId = :currentUser.ContactId
                    ORDER BY CreatedDate DESC
                    LIMIT  30
                ];
            } else {
                tasks = [
                    SELECT Id, Subject, Description, CreatedDate,
                           Who.Name
                    FROM   Task
                    WHERE  Subject LIKE '%Persona detectada%'
                    ORDER BY CreatedDate DESC
                    LIMIT  50
                ];
            }

            List<AlertInfo> alerts = new List<AlertInfo>();
            for (Task t : tasks) {
                AlertInfo ai = new AlertInfo();
                ai.taskId      = t.Id;
                ai.subject     = t.Subject;
                ai.createdDate = t.CreatedDate;
                ai.contactName = t.Who != null ? t.Who.Name : null;
                ai.clipUrl     = extractClipUrl(t.Description);
                if (String.isNotBlank(ai.clipUrl)) {
                    alerts.add(ai);
                }
            }
            return alerts;
        }
    }

    private static String extractClipUrl(String description) {
        if (String.isBlank(description)) return null;
        Integer startIdx = description.indexOf('[CLIP_URL]');
        Integer endIdx   = description.indexOf('[/CLIP_URL]');
        if (startIdx == -1 || endIdx == -1 || endIdx <= startIdx) return null;
        return description.substring(startIdx + 10, endIdx).trim();
    }


    public class AlertInfo {
        @AuraEnabled public String   taskId;
        @AuraEnabled public String   subject;
        @AuraEnabled public Datetime createdDate;
        @AuraEnabled public String   contactName;
        @AuraEnabled public String   clipUrl;
    }
}
