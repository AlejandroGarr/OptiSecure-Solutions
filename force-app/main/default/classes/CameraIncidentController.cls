/**
 * @description       : 
 * @author            : ChangeMeIn@UserSettingsUnder.SFDoc
 * @group             : 
 * @last modified on  : 05-30-2026
 * @last modified by  : ChangeMeIn@UserSettingsUnder.SFDoc
**/

public without sharing class CameraIncidentController {


    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getCameraOptions() {
        User currentUser = [SELECT ContactId FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];
        List<Camara__c> cameras;
        if (currentUser.ContactId != null) {
            cameras = [
                SELECT Id, Name, Zone__c
                FROM   Camara__c
                WHERE  Activa__c = TRUE
                AND    Contacto__c = :currentUser.ContactId
                ORDER BY Name ASC
            ];
        } else {
            cameras = [
                SELECT Id, Name, Zone__c
                FROM   Camara__c
                WHERE  Activa__c = TRUE
                ORDER BY Name ASC
            ];
        }
        List<Map<String, String>> options = new List<Map<String, String>>();
        for (Camara__c cam : cameras) {
            Map<String, String> opt = new Map<String, String>();
            opt.put('value', cam.Id);
            opt.put('label', cam.Name + (cam.Zone__c != null ? ' — ' + cam.Zone__c : ''));
            options.add(opt);
        }
        return options;
    }


    @AuraEnabled
    public static Id createCameraIncident(Id cameraId, String subject, String description, String priority) {
        try {
            // Obtener datos de la cámara para enriquecer el caso
            Camara__c cam = [
                SELECT Name, Zone__c
                FROM   Camara__c
                WHERE  Id = :cameraId
                LIMIT  1
            ];

            // Obtener ContactId y AccountId del usuario actual
            User currentUser = [
                SELECT ContactId, Contact.AccountId
                FROM   User
                WHERE  Id = :UserInfo.getUserId()
                LIMIT  1
            ];

            Case newCase = new Case(
                Subject     = subject,
                Description = 'Cámara: ' + cam.Name + '\n'
                            + 'Zona: ' + cam.Zone__c + '\n\n'
                            + description,
                Priority    = priority,
                Status      = 'New',
                Origin      = 'Web',
                Type        = 'Mechanical',
                ContactId   = currentUser.ContactId,
                AccountId   = currentUser.ContactId != null ? currentUser.Contact.AccountId : null
            );
            insert newCase;
            return newCase.Id;
        } catch (Exception e) {
            String errorMsg = 'Error al crear la incidencia: ' + e.getMessage();
            AuraHandledException auraEx = new AuraHandledException(errorMsg);
            auraEx.setMessage(errorMsg);
            throw auraEx;
        }
    }
}
