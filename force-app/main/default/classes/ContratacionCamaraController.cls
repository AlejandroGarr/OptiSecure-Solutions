/**
 * @description Controlador Apex para el flujo de contratación de cámaras.
 *              Gestiona la creación de solicitudes desde el portal,
 *              la aprobación por parte del admin, y la consulta
 *              de solicitudes aprobadas pendientes de colocación.
 * @author      OptiSecure Solutions
 */
public with sharing class ContratacionCamaraController {

    /**
     * @description Devuelve el ContactId del usuario actual del portal.
     *              Devuelve null si el usuario es admin (sin ContactId).
     */
    @AuraEnabled(cacheable=true)
    public static Id getContactIdUsuarioActual() {
        User currentUser = [
            SELECT ContactId
            FROM   User
            WHERE  Id = :UserInfo.getUserId()
            LIMIT  1
        ];
        return currentUser.ContactId;
    }

    /**
     * @description Crea una nueva solicitud de contratación de cámaras
     *              desde el portal del cliente.
     * @param       numeroCamaras Cantidad de cámaras solicitadas
     * @param       detalle       Texto libre con detalles de la solicitud
     * @return      Id de la solicitud creada
     */
    @AuraEnabled
    public static Id crearSolicitud(Integer numeroCamaras, String detalle) {
        // Obtener contacto y cuenta del usuario del portal
        User currentUser = [
            SELECT ContactId, Contact.AccountId
            FROM   User
            WHERE  Id = :UserInfo.getUserId()
            LIMIT  1
        ];

        Solicitud_Camara__c solicitud = new Solicitud_Camara__c(
            Numero_Camaras__c       = numeroCamaras,
            Detalle_Camaras__c      = detalle,
            Estado__c               = 'Pendiente',
            Fecha_Solicitud__c      = Date.today(),
            Nombre_Solicitante__c   = UserInfo.getName(),
            Email_Solicitante__c    = UserInfo.getUserEmail(),
            Contacto__c             = currentUser.ContactId,
            Cuenta__c               = currentUser.Contact?.AccountId
        );
        insert solicitud;
        return solicitud.Id;
    }

    /**
     * @description Obtiene las solicitudes del usuario actual del portal.
     * @return      Lista de solicitudes del contacto actual.
     */
    @AuraEnabled
    public static List<Solicitud_Camara__c> getMisSolicitudes() {
        User currentUser = [
            SELECT ContactId
            FROM   User
            WHERE  Id = :UserInfo.getUserId()
            LIMIT  1
        ];

        if (currentUser.ContactId == null) {
            return new List<Solicitud_Camara__c>();
        }

        return [
            SELECT Id, Name, Numero_Camaras__c, Estado__c,
                   Fecha_Solicitud__c, Detalle_Camaras__c
            FROM   Solicitud_Camara__c
            WHERE  Contacto__c = :currentUser.ContactId
            ORDER BY CreatedDate DESC
            LIMIT 20
        ];
    }

    @AuraEnabled
    public static void deleteSolicitud(Id solicitudId) {
        List<Solicitud_Camara__c> sols = [
            SELECT Id FROM Solicitud_Camara__c
            WHERE  Id = :solicitudId
            LIMIT  1
        ];
        if (!sols.isEmpty()) {
            delete sols;
        }
    }

    /**
     * @description Obtiene todas las solicitudes pendientes (para el admin).
     * @return      Lista de solicitudes con estado Pendiente o En Revision.
     */
    @AuraEnabled
    public static List<Solicitud_Camara__c> getSolicitudesPendientes() {
        return [
            SELECT Id, Name, Numero_Camaras__c, Estado__c,
                   Fecha_Solicitud__c, Detalle_Camaras__c,
                   Nombre_Solicitante__c, Email_Solicitante__c,
                   Contacto__c, Contacto__r.Name, Cuenta__c, Cuenta__r.Name
            FROM   Solicitud_Camara__c
            WHERE  Estado__c IN ('Pendiente', 'En Revision')
            ORDER BY CreatedDate ASC
        ];
    }

    /**
     * @description El admin aprueba una solicitud. Cambia estado a 'Aprobada'.
     * @param       solicitudId Id de la solicitud a aprobar
     */
    @AuraEnabled
    public static void aprobarSolicitud(Id solicitudId) {
        Solicitud_Camara__c sol = [
            SELECT Id, Estado__c
            FROM   Solicitud_Camara__c
            WHERE  Id = :solicitudId
            LIMIT  1
        ];
        sol.Estado__c = 'Aprobada';
        update sol;
    }

    /**
     * @description El admin rechaza una solicitud. Cambia estado a 'Rechazada'.
     * @param       solicitudId Id de la solicitud a rechazar
     */
    @AuraEnabled
    public static void rechazarSolicitud(Id solicitudId) {
        Solicitud_Camara__c sol = [
            SELECT Id, Estado__c
            FROM   Solicitud_Camara__c
            WHERE  Id = :solicitudId
            LIMIT  1
        ];
        sol.Estado__c = 'Rechazada';
        update sol;
    }

    /**
     * @description Comprueba si el usuario actual del portal tiene una
     *              solicitud aprobada pendiente de colocar cámaras.
     * @return      Wrapper con la info de la solicitud aprobada, o null.
     */
    @AuraEnabled
    public static SolicitudAprobada getSolicitudAprobadaActiva() {
        User currentUser = [
            SELECT ContactId
            FROM   User
            WHERE  Id = :UserInfo.getUserId()
            LIMIT  1
        ];

        if (currentUser.ContactId == null) {
            return null;
        }

        List<Solicitud_Camara__c> solicitudes = [
            SELECT Id, Name, Numero_Camaras__c
            FROM   Solicitud_Camara__c
            WHERE  Contacto__c = :currentUser.ContactId
            AND    Estado__c = 'Aprobada'
            ORDER BY CreatedDate DESC
            LIMIT 1
        ];

        if (solicitudes.isEmpty()) {
            return null;
        }

        Solicitud_Camara__c sol = solicitudes[0];
        SolicitudAprobada result = new SolicitudAprobada();
        result.solicitudId   = sol.Id;
        result.nombre        = sol.Name;
        result.numeroCamaras = Integer.valueOf(sol.Numero_Camaras__c);
        result.contactId     = currentUser.ContactId;
        return result;
    }

    /**
     * @description Marca la solicitud como 'Completada' tras colocar las cámaras.
     * @param       solicitudId Id de la solicitud a completar
     */
    @AuraEnabled
    public static void completarSolicitud(Id solicitudId) {
        Solicitud_Camara__c sol = [
            SELECT Id, Estado__c
            FROM   Solicitud_Camara__c
            WHERE  Id = :solicitudId
            LIMIT  1
        ];
        sol.Estado__c = 'Completada';
        update sol;
    }

    /**
     * @description Guarda las cámaras colocadas por un usuario del portal tras
     *              una solicitud aprobada y marca la solicitud como Completada.
     *              Usa una inner class without sharing para el DML, ya que los
     *              usuarios de portal no tienen permisos directos de Create en
     *              Camara__c, pero la aprobación del admin autoriza la operación.
     * @param       solicitudId Id de la solicitud aprobada activa
     * @param       camarasJson JSON array con {name, posX, posY, videoUrl}
     */
    @AuraEnabled
    public static void saveCamarasContratadas(Id solicitudId, String camarasJson) {
        try {
            User currentUser = [
                SELECT ContactId
                FROM   User
                WHERE  Id = :UserInfo.getUserId()
                LIMIT  1
            ];

            if (currentUser.ContactId == null) {
                throw new AuraHandledException('El usuario no tiene un contacto asociado.');
            }

            List<Solicitud_Camara__c> solList = [
                SELECT Id, Estado__c, Numero_Camaras__c, Contacto__c
                FROM   Solicitud_Camara__c
                WHERE  Id = :solicitudId
                AND    Contacto__c = :currentUser.ContactId
                AND    Estado__c = 'Aprobada'
                LIMIT  1
            ];

            if (solList.isEmpty()) {
                throw new AuraHandledException('La solicitud no existe o no está aprobada para este usuario.');
            }

            List<Object> rawList = (List<Object>) JSON.deserializeUntyped(camarasJson);

            List<Camara__c> toInsert = new List<Camara__c>();
            for (Object item : rawList) {
                Map<String, Object> cam = (Map<String, Object>) item;
                toInsert.add(new Camara__c(
                    Name          = (String)  cam.get('name'),
                    Posicion_X__c = Decimal.valueOf(String.valueOf(cam.get('posX'))),
                    Posicion_Y__c = Decimal.valueOf(String.valueOf(cam.get('posY'))),
                    Video_URL__c  = (String)  cam.get('videoUrl'),
                    Activa__c     = true,
                    Zone__c       = 'Salón',
                    Contacto__c   = currentUser.ContactId
                ));
            }

            CameraInsertHelper.insertCameras(toInsert);
            CameraInsertHelper.completarSolicitud(solList[0].Id);

        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException('Error al guardar las cámaras: ' + e.getMessage());
        }
    }

    /**
     * @description Obtiene el historial completo de solicitudes (para el admin).
     * @return      Lista de todas las solicitudes ordenadas por fecha desc.
     */
    @AuraEnabled
    public static List<Solicitud_Camara__c> getAllSolicitudes() {
        return [
            SELECT Id, Name, Numero_Camaras__c, Estado__c,
                   Fecha_Solicitud__c, Detalle_Camaras__c,
                   Nombre_Solicitante__c, Email_Solicitante__c,
                   Contacto__c, Contacto__r.Name,
                   Cuenta__c, Cuenta__r.Name,
                   LastModifiedDate
            FROM   Solicitud_Camara__c
            ORDER BY CreatedDate DESC
            LIMIT 200
        ];
    }

    /**
     * @description Wrapper para devolver la info de una solicitud aprobada al LWC.
     */
    public class SolicitudAprobada {
        @AuraEnabled public Id      solicitudId;
        @AuraEnabled public String  nombre;
        @AuraEnabled public Integer numeroCamaras;
        @AuraEnabled public Id      contactId;   // Para filtrar cámaras del portal user
    }
}
