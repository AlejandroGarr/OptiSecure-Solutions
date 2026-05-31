/**
 * @description       : 
 * @author            : ChangeMeIn@UserSettingsUnder.SFDoc
 * @group             : 
 * @last modified on  : 05-30-2026
 * @last modified by  : ChangeMeIn@UserSettingsUnder.SFDoc
**/

public without sharing class CameraInsertHelper {
    public static void insertCameras(List<Camara__c> cameras) {
        if (cameras != null && !cameras.isEmpty()) {
            insert cameras;
        }
    }

    public static void completarSolicitud(Id solicitudId) {
        Solicitud_Camara__c sol = new Solicitud_Camara__c(
            Id        = solicitudId,
            Estado__c = 'Completada'
        );
        update sol;
    }
}
