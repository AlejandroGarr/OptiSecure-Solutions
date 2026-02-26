/**
 * @description Controlador Apex para el componente de reporte de incidencias
 *              de cámaras de seguridad. Permite a los usuarios de Experience
 *              Cloud crear Casos (Case) asociados a una cámara que falla.
 * @author      OptiSecure Solutions
 * @date        2026-02-26
 */
public with sharing class CameraIncidentController {

    /**
     * @description Obtiene la lista de cámaras activas para el picklist
     *              del formulario de incidencias.
     * @return      Lista de mapas con Id y Name de cada cámara activa.
     */
    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getCameraOptions() {
        List<Map<String, String>> options = new List<Map<String, String>>();
        for (Camara__c cam : [
            SELECT Id, Name, Zone__c
            FROM   Camara__c
            WHERE  Activa__c = TRUE
            WITH   SECURITY_ENFORCED
            ORDER BY Name ASC
        ]) {
            Map<String, String> opt = new Map<String, String>();
            opt.put('value', cam.Id);
            opt.put('label', cam.Name + ' — ' + cam.Zone__c);
            options.add(opt);
        }
        return options;
    }

    /**
     * @description Crea un registro Case vinculado a una cámara con fallo.
     * @param       cameraId    Id de la cámara reportada.
     * @param       subject     Asunto del caso.
     * @param       description Descripción detallada del problema.
     * @param       priority    Prioridad (High, Medium, Low).
     * @return      El Id del Case creado.
     * @throws      AuraHandledException si ocurre un error.
     */
    @AuraEnabled
    public static Id createCameraIncident(Id cameraId, String subject, String description, String priority) {
        try {
            // Obtener datos de la cámara para enriquecer el caso
            Camara__c cam = [
                SELECT Name, Zone__c
                FROM   Camara__c
                WHERE  Id = :cameraId
                WITH   SECURITY_ENFORCED
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
                Type        = 'Mechanical'
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
