/**
 * @description Controlador Apex para el componente HouseMap / Cámara LWC.
 *              Devuelve las cámaras activas con sus coordenadas y zona
 *              para renderizarlas sobre el plano de la vivienda.
 * @author      OptiSecure Solutions
 * @date        2026-02-12
 */
public with sharing class HouseMapController {

    /**
     * @description Obtiene todas las cámaras activas (Is_Active__c = true).
     * @return      Lista de Camara__c con Id, Name, Video_Url__c,
     *              Position_X__c, Position_Y__c y Zone__c.
     * @throws      AuraHandledException si ocurre un error en la consulta.
     */
    @AuraEnabled(cacheable=true)
    public static List<Camara__c> getCamaras() {
        try {
            return [
                SELECT Id,
                       Name,
                       Video_Url__c,
                       Posicion_X__c,
                       Posicion_Y__c,
                       Zone__c
                FROM   Camara__c
                WHERE  Activa__c = TRUE
                WITH   SECURITY_ENFORCED
                ORDER BY Name ASC
            ];
        } catch (Exception e) {
            throw new AuraHandledException(
                'Error al obtener las cámaras: ' + e.getMessage()
            );
        }
    }

    /**
     * @description Comprueba si el usuario actual tiene perfil System Administrator.
     * @return      True si el usuario es System Administrator, false en caso contrario.
     */
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

    /**
     * @description Guarda la posición de una chincheta (cámara) creada por drag & drop.
     * @param       name     Nombre de la cámara
     * @param       posX     Posición X en porcentaje
     * @param       posY     Posición Y en porcentaje
     * @param       videoUrl URL del vídeo de YouTube
     * @return      La cámara creada
     */
    @AuraEnabled
    public static Camara__c saveDraggedCamera(String name, Decimal posX, Decimal posY, String videoUrl) {
        Camara__c cam = new Camara__c(
            Name          = name,
            Posicion_X__c = posX,
            Posicion_Y__c = posY,
            Video_Url__c  = videoUrl,
            Activa__c     = true,
            Zone__c       = 'Salón'
        );
        insert cam;
        return cam;
    }

    /**
     * @description Actualiza la posición de una cámara existente.
     * @param       cameraId Id de la cámara a reposicionar
     * @param       newX     Nueva posición X en porcentaje (0-100)
     * @param       newY     Nueva posición Y en porcentaje (0-100)
     * @throws      AuraHandledException si la cámara no existe o falla el update.
     */
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