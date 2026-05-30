/**
 * @description       : 
 * @author            : ChangeMeIn@UserSettingsUnder.SFDoc
 * @group             : 
 * @last modified on  : 05-31-2026
 * @last modified by  : ChangeMeIn@UserSettingsUnder.SFDoc
**/

@RestResource(urlMapping='/PersonDetection/*')
global without sharing class PersonDetectionController {

    @HttpPost
    global static String handleDetection() {
        RestRequest req = RestContext.request;
        Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(
            req.requestBody.toString()
        );

        String cameraId     = (String) body.get('cameraId');
        String timestampStr = (String) body.get('timestamp');
        String clipUrl      = (String) body.get('clipUrl');

        if (String.isBlank(cameraId)) {
            RestContext.response.statusCode = 400;
            return 'Error: falta el campo cameraId';
        }

        try {
            // Obtener la cámara con su contacto asociado
            List<Camara__c> cams = [
                SELECT Id, Name, Zone__c,
                       Contacto__c,
                       Contacto__r.Name
                FROM   Camara__c
                WHERE  Id = :cameraId
                LIMIT  1
            ];

            if (cams.isEmpty()) {
                RestContext.response.statusCode = 404;
                return 'Error: cámara no encontrada con Id ' + cameraId;
            }

            Camara__c cam = cams[0];

            // Obtener el contacto: del campo Contacto__c o del body
            Id contactId = cam.Contacto__c;
            String contactName = cam.Contacto__r != null ? cam.Contacto__r.Name : null;

            // Si la cámara no tiene contacto, buscar un contacto explícito del body
            if (contactId == null) {
                String bodyContactId = (String) body.get('contactId');
                if (String.isNotBlank(bodyContactId)) {
                    contactId = Id.valueOf(bodyContactId);
                    Contact c = [SELECT Name FROM Contact WHERE Id = :contactId LIMIT 1];
                    contactName = c.Name;
                }
            }

            // ─── Crear Task de actividad vinculado al contacto de la cámara ───
            Task t = new Task(
                Subject     = '\u26A0 Persona detectada - ' + cam.Name,
                Description = 'Se ha detectado una persona en la cámara "'
                            + cam.Name + '"'
                            + (cam.Zone__c != null ? ' (Zona: ' + cam.Zone__c + ')' : '')
                            + ' el ' + timestampStr + '.\n'
                            + 'Se ha grabado un clip de 8 segundos autom\u00e1ticamente.'
                            + (String.isNotBlank(clipUrl) ? '\n[CLIP_URL]' + clipUrl + '[/CLIP_URL]' : ''),
                Status       = 'Completed',
                Priority     = 'High',
                WhoId        = contactId,
                ActivityDate = Date.today()
            );
            insert t;

            String who = contactName != null ? contactName : '(sin contacto)';
            return 'OK - Alerta registrada para ' + who + ' (cámara ' + cam.Name + ')';
        } catch (Exception e) {
            RestContext.response.statusCode = 500;
            return 'Error: ' + e.getMessage();
        }
    }
}
