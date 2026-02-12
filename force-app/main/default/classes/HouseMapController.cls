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
}