/**
 * @description Clase auxiliar without sharing para insertar cámaras en nombre
 *              de usuarios del portal que tienen una solicitud aprobada.
 *              El control de seguridad (verificar que la solicitud existe,
 *              pertenece al usuario y está Aprobada) se realiza en
 *              ContratacionCamaraController antes de llamar a este helper.
 */
public without sharing class CameraInsertHelper {
    public static void insertCameras(List<Camara__c> cameras) {
        if (cameras != null && !cameras.isEmpty()) {
            insert cameras;
        }
    }

    /**
     * Actualiza el estado de la solicitud a 'Completada'.
     * Se ejecuta without sharing para que los usuarios de portal,
     * que solo tienen Create (no Edit) en Solicitud_Camara__c, puedan completarla.
     */
    public static void completarSolicitud(Id solicitudId) {
        Solicitud_Camara__c sol = new Solicitud_Camara__c(
            Id        = solicitudId,
            Estado__c = 'Completada'
        );
        update sol;
    }
}
