/**
 * @description Controlador Apex para el componente customUserMenu.
 *              Proporciona los datos de perfil del usuario actual,
 *              información de su cuenta (Account) y el recuento de cámaras.
 * @author      OptiSecure Solutions
 * @date        2026-03-06
 */
public without sharing class UserMenuController {

    /**
     * Wrapper para devolver datos completos de perfil al LWC.
     */
    public class UserProfileData {
        // Usuario
        @AuraEnabled public String name;
        @AuraEnabled public String email;
        @AuraEnabled public String phone;
        @AuraEnabled public String initials;
        @AuraEnabled public Boolean isAdmin;
        // Cuenta (Account)
        @AuraEnabled public String accountName;
        @AuraEnabled public String accountPhone;
        @AuraEnabled public String industry;
        @AuraEnabled public String active;
        @AuraEnabled public String sla;
        @AuraEnabled public String slaExpirationDate;
        @AuraEnabled public String slaSerialNumber;
        @AuraEnabled public String customerPriority;
        @AuraEnabled public Integer numberOfLocations;
        @AuraEnabled public String billingStreet;
        @AuraEnabled public String billingCity;
        @AuraEnabled public String billingState;
        @AuraEnabled public String billingPostalCode;
        @AuraEnabled public String billingCountry;
        // Cámaras
        @AuraEnabled public Integer totalCameras;
        @AuraEnabled public Integer activeCameras;
        @AuraEnabled public Integer inactiveCameras;
        @AuraEnabled public List<CameraData> cameras;
    }

    /**
     * Wrapper ligero para cada cámara.
     */
    public class CameraData {
        @AuraEnabled public String id;
        @AuraEnabled public String name;
        @AuraEnabled public String zone;
        @AuraEnabled public Boolean active;

        public CameraData(Camara__c cam) {
            this.id     = cam.Id;
            this.name   = cam.Name;
            this.zone   = cam.Zone__c;
            this.active = cam.Activa__c;
        }
    }

    /**
     * @description Obtiene datos completos del usuario, su cuenta y cámaras.
     * @return      UserProfileData con toda la información del perfil.
     * @throws      AuraHandledException si ocurre un error en la consulta.
     */
    @AuraEnabled
    public static UserProfileData getUserProfileData() {
        Id currentUserId = UserInfo.getUserId();
        UserProfileData profile = new UserProfileData();

        // 1. Datos básicos del usuario — siempre disponible
        try {
            User u = [
                SELECT Name, Email, Phone, ContactId
                FROM   User
                WHERE  Id = :currentUserId
                LIMIT  1
            ];
            profile.name     = u.Name;
            profile.email    = u.Email;
            profile.phone    = u.Phone;
            profile.initials = buildInitials(u.Name);

            // 2. Datos de la cuenta a través del Contact
            if (u.ContactId != null) {
                try {
                    Contact con = [
                        SELECT AccountId, Account.Name, Account.Phone, Account.Industry,
                               Account.Active__c, Account.SLA__c, Account.SLAExpirationDate__c,
                               Account.SLASerialNumber__c, Account.CustomerPriority__c,
                               Account.NumberofLocations__c, Account.BillingStreet,
                               Account.BillingCity, Account.BillingState,
                               Account.BillingPostalCode, Account.BillingCountry
                        FROM   Contact
                        WHERE  Id = :u.ContactId
                        LIMIT  1
                    ];
                    if (con.AccountId != null) {
                        profile.accountName       = con.Account.Name;
                        profile.accountPhone      = con.Account.Phone;
                        profile.industry          = con.Account.Industry;
                        profile.active            = con.Account.Active__c;
                        profile.sla               = con.Account.SLA__c;
                        profile.slaExpirationDate = con.Account.SLAExpirationDate__c != null
                            ? con.Account.SLAExpirationDate__c.format() : null;
                        profile.slaSerialNumber   = con.Account.SLASerialNumber__c;
                        profile.customerPriority  = con.Account.CustomerPriority__c;
                        profile.numberOfLocations = con.Account.NumberofLocations__c != null
                            ? con.Account.NumberofLocations__c.intValue() : 0;
                        profile.billingStreet     = con.Account.BillingStreet;
                        profile.billingCity       = con.Account.BillingCity;
                        profile.billingState      = con.Account.BillingState;
                        profile.billingPostalCode = con.Account.BillingPostalCode;
                        profile.billingCountry    = con.Account.BillingCountry;
                    }
                } catch (Exception accErr) {
                    System.debug('Error al obtener datos de cuenta: ' + accErr.getMessage());
                }
            }

            // 3. Cámaras
            try {
                List<Camara__c> cameraList;
                if (u.ContactId != null) {
                    cameraList = [
                        SELECT Id, Name, Zone__c, Activa__c
                        FROM   Camara__c
                        WHERE  Contacto__c = :u.ContactId
                        ORDER BY Name
                    ];
                } else {
                    cameraList = [
                        SELECT Id, Name, Zone__c, Activa__c
                        FROM   Camara__c
                        WHERE  OwnerId = :currentUserId
                        ORDER BY Name
                    ];
                }
                profile.cameras = new List<CameraData>();
                Integer cameraActive = 0;
                for (Camara__c cam : cameraList) {
                    profile.cameras.add(new CameraData(cam));
                    if (cam.Activa__c) cameraActive++;
                }
                profile.totalCameras    = cameraList.size();
                profile.activeCameras   = cameraActive;
                profile.inactiveCameras = cameraList.size() - cameraActive;
            } catch (Exception camErr) {
                System.debug('Error al obtener cámaras: ' + camErr.getMessage());
                profile.cameras         = new List<CameraData>();
                profile.totalCameras    = 0;
                profile.activeCameras   = 0;
                profile.inactiveCameras = 0;
            }

        } catch (Exception e) {
            // Si ni siquiera el User se pudo consultar, datos mínimos de UserInfo
            profile.name     = UserInfo.getName();
            profile.email    = UserInfo.getUserEmail();
            profile.initials = buildInitials(UserInfo.getName());
            profile.cameras         = new List<CameraData>();
            profile.totalCameras    = 0;
            profile.activeCameras   = 0;
            profile.inactiveCameras = 0;
        }

        // Admin check — nunca falla gracias a su propio try-catch
        profile.isAdmin = checkIsAdmin();

        return profile;
    }

    /**
     * @description Elimina una cámara por su Id. Solo admins deberían invocar esto.
     * @param cameraId Id de la cámara a eliminar.
     */
    @AuraEnabled
    public static void deleteCamera(Id cameraId) {
        if (!checkIsAdmin()) {
            throw new AuraHandledException('No tienes permisos para eliminar cámaras.');
        }
        try {
            Camara__c cam = [
                SELECT Id FROM Camara__c
                WHERE  Id = :cameraId
                LIMIT  1
            ];
            delete cam;
        } catch (Exception e) {
            throw new AuraHandledException(
                'Error al eliminar la cámara: ' + e.getMessage()
            );
        }
    }

    /**
     * @description Crea una solicitud de contratación de nuevas cámaras.
     * @param camerasJson JSON con array de objetos {name, location}.
     * @return Id del registro Solicitud_Camara__c creado.
     */
    @AuraEnabled
    public static Id createSolicitudCamara(String camerasJson) {
        try {
            Id currentUserId = UserInfo.getUserId();

            User u = [
                SELECT Name, Email, Phone, ContactId
                FROM   User
                WHERE  Id = :currentUserId
                LIMIT  1
            ];

            Solicitud_Camara__c sol = new Solicitud_Camara__c();
            sol.Nombre_Solicitante__c = u.Name;
            sol.Email_Solicitante__c  = u.Email;
            sol.Telefono_Solicitante__c = u.Phone;
            sol.Detalle_Camaras__c    = camerasJson;
            sol.Estado__c             = 'Pendiente';
            sol.Fecha_Solicitud__c    = Datetime.now();

            // Contar cámaras del JSON
            List<Object> camerasList = (List<Object>) JSON.deserializeUntyped(camerasJson);
            sol.Numero_Camaras__c = camerasList.size();

            // Vincular a la cuenta si el usuario tiene Contact
            if (u.ContactId != null) {
                List<Contact> contacts = [
                    SELECT AccountId
                    FROM   Contact
                    WHERE  Id = :u.ContactId
                    LIMIT  1
                ];
                if (!contacts.isEmpty() && contacts[0].AccountId != null) {
                    sol.Cuenta__c = contacts[0].AccountId;
                }
            }

            insert sol;
            return sol.Id;
        } catch (Exception e) {
            throw new AuraHandledException(
                'Error al crear la solicitud: ' + e.getMessage()
            );
        }
    }

    /**
     * @description Comprueba si el usuario actual es System Administrator.
     */
    private static Boolean checkIsAdmin() {
        try {
            Profile p = [
                SELECT Name FROM Profile
                WHERE  Id = :UserInfo.getProfileId()
                LIMIT  1
            ];
            return p.Name == 'System Administrator' ||
                   p.Name == 'Administrador del sistema';
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * @description Genera iniciales a partir del nombre completo.
     */
    private static String buildInitials(String fullName) {
        if (String.isBlank(fullName)) return '??';
        List<String> parts = fullName.trim().split('\\s+');
        String result = parts[0].substring(0, 1).toUpperCase();
        if (parts.size() > 1) {
            result += parts[parts.size() - 1].substring(0, 1).toUpperCase();
        }
        return result;
    }

    /**
     * @description Renombra una cámara. Solo el propietario puede renombrar sus cámaras.
     * @param cameraId Id de la cámara.
     * @param newName  Nuevo nombre.
     */
    @AuraEnabled
    public static void renameCamera(Id cameraId, String newName) {
        if (String.isBlank(newName)) {
            AuraHandledException ex = new AuraHandledException('El nombre no puede estar vacío.');
            ex.setMessage('El nombre no puede estar vacío.');
            throw ex;
        }
        User currentUser = [SELECT ContactId FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];
        List<Camara__c> cams;
        if (currentUser.ContactId != null) {
            cams = [SELECT Id FROM Camara__c WHERE Id = :cameraId AND Contacto__c = :currentUser.ContactId LIMIT 1];
        } else {
            cams = [SELECT Id FROM Camara__c WHERE Id = :cameraId LIMIT 1];
        }
        if (cams.isEmpty()) {
            AuraHandledException ex = new AuraHandledException('No tienes acceso a esta cámara.');
            ex.setMessage('No tienes acceso a esta cámara.');
            throw ex;
        }
        try {
            cams[0].Name = newName.trim();
            update cams[0];
        } catch (Exception e) {
            AuraHandledException ex = new AuraHandledException('Error al renombrar: ' + e.getMessage());
            ex.setMessage('Error al renombrar: ' + e.getMessage());
            throw ex;
        }
    }
}
