/**
 * @description       : 
 * @author            : ChangeMeIn@UserSettingsUnder.SFDoc
 * @group             : 
 * @last modified on  : 05-30-2026
 * @last modified by  : ChangeMeIn@UserSettingsUnder.SFDoc
**/

public without sharing class HouseMapController {

    @AuraEnabled(cacheable=false)
    public static List<Camara__c> getCamaras(Id contactId) {
        try {
            // Detectar si el usuario actual es un usuario de portal/comunidad
            // (los usuarios de portal tienen ContactId en su User record)
            User currentUser = [
                SELECT ContactId
                FROM   User
                WHERE  Id = :UserInfo.getUserId()
                LIMIT  1
            ];

            // Portal/comunidad: siempre filtrar por su propio ContactId (seguridad server-side)
            // Admin/interno: respetar el contactId pasado desde el cliente (puede ser null = todos)
            Id effectiveContactId;
            if (currentUser.ContactId != null) {
                effectiveContactId = currentUser.ContactId;
            } else {
                effectiveContactId = contactId;
            }

            if (effectiveContactId != null) {
                return [
                    SELECT Id,
                           Name,
                           Video_URL__c,
                           Posicion_X__c,
                           Posicion_Y__c,
                           Zone__c,
                           Contacto__c,
                           Contacto__r.Name
                    FROM   Camara__c
                    WHERE  Activa__c = TRUE
                    AND    Contacto__c = :effectiveContactId
                    ORDER BY Name ASC
                ];
            }
            return [
                SELECT Id,
                       Name,
                       Video_URL__c,
                       Posicion_X__c,
                       Posicion_Y__c,
                       Zone__c
                FROM   Camara__c
                WHERE  Activa__c = TRUE
                ORDER BY Name ASC
            ];
        } catch (Exception e) {
            throw new AuraHandledException(
                'Error al obtener las cámaras: ' + e.getMessage()
            );
        }
    }

    @AuraEnabled(cacheable=true)
    public static Boolean isSystemAdmin() {
        try {
            Profile p = [
                SELECT Name
                FROM   Profile
                WHERE  Id = :UserInfo.getProfileId()
                LIMIT  1
            ];
            return p.Name == 'System Administrator' || p.Name == 'Administrador del sistema';
        } catch (Exception e) {
            return false;
        }
    }

    @AuraEnabled
    public static Camara__c saveDraggedCamera(String name, Decimal posX, Decimal posY, String videoUrl) {
        Camara__c cam = new Camara__c(
            Name          = name,
            Posicion_X__c = posX,
            Posicion_Y__c = posY,
            Video_URL__c  = videoUrl,
            Activa__c     = true,
            Zone__c       = 'Salón'
        );
        insert cam;
        return cam;
    }

    @AuraEnabled
    public static void deleteCamera(Id cameraId) {
        try {
            Camara__c cam = [
                SELECT Id
                FROM   Camara__c
                WHERE  Id = :cameraId
                WITH   SECURITY_ENFORCED
                LIMIT  1
            ];
            delete cam;
        } catch (Exception e) {
            throw new AuraHandledException(
                'Error al eliminar la cámara: ' + e.getMessage()
            );
        }
    }

    @AuraEnabled
    public static void updateCameraPosition(Id cameraId, Decimal newX, Decimal newY) {
        try {
            Camara__c cam = [
                SELECT Id, Posicion_X__c, Posicion_Y__c
                FROM   Camara__c
                WHERE  Id = :cameraId
                WITH   SECURITY_ENFORCED
                LIMIT  1
            ];
            cam.Posicion_X__c = newX;
            cam.Posicion_Y__c = newY;
            update cam;
        } catch (Exception e) {
            throw new AuraHandledException(
                'Error al actualizar la posición de la cámara: ' + e.getMessage()
            );
        }
    }
}