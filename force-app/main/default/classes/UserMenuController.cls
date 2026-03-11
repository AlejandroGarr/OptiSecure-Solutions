/**
 * @description Controlador Apex para el componente customUserMenu.
 *              Proporciona los datos de perfil del usuario actual,
 *              información de su cuenta (Account) y el recuento de cámaras.
 * @author      OptiSecure Solutions
 * @date        2026-03-06
 */
public with sharing class UserMenuController {

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
    @AuraEnabled(cacheable=true)
    public static UserProfileData getUserProfileData() {
        try {
            Id currentUserId = UserInfo.getUserId();

            User u = [
                SELECT Name, Email, Phone, ContactId
                FROM   User
                WHERE  Id = :currentUserId
                WITH   SECURITY_ENFORCED
                LIMIT  1
            ];

            UserProfileData profile = new UserProfileData();
            profile.name            = u.Name;
            profile.email           = u.Email;
            profile.phone           = u.Phone;
            profile.initials        = buildInitials(u.Name);

            // Obtener Account a través del Contact (Experience Cloud)
            if (u.ContactId != null) {
                List<Contact> contacts = [
                    SELECT AccountId
                    FROM   Contact
                    WHERE  Id = :u.ContactId
                    WITH   SECURITY_ENFORCED
                    LIMIT  1
                ];
                if (!contacts.isEmpty() && contacts[0].AccountId != null) {
                    Account acc = [
                        SELECT Name, Phone, Industry, Active__c,
                               SLA__c, SLAExpirationDate__c, SLASerialNumber__c,
                               CustomerPriority__c, NumberofLocations__c,
                               BillingStreet, BillingCity, BillingState,
                               BillingPostalCode, BillingCountry
                        FROM   Account
                        WHERE  Id = :contacts[0].AccountId
                        WITH   SECURITY_ENFORCED
                        LIMIT  1
                    ];
                    profile.accountName      = acc.Name;
                    profile.accountPhone     = acc.Phone;
                    profile.industry         = acc.Industry;
                    profile.active           = acc.Active__c;
                    profile.sla              = acc.SLA__c;
                    profile.slaExpirationDate = acc.SLAExpirationDate__c != null
                        ? acc.SLAExpirationDate__c.format() : null;
                    profile.slaSerialNumber  = acc.SLASerialNumber__c;
                    profile.customerPriority = acc.CustomerPriority__c;
                    profile.numberOfLocations = acc.NumberofLocations__c != null
                        ? acc.NumberofLocations__c.intValue() : 0;
                    profile.billingStreet     = acc.BillingStreet;
                    profile.billingCity       = acc.BillingCity;
                    profile.billingState      = acc.BillingState;
                    profile.billingPostalCode = acc.BillingPostalCode;
                    profile.billingCountry    = acc.BillingCountry;
                }
            }

            // Conteo y lista de cámaras
            List<Camara__c> cameraList = [
                SELECT Id, Name, Zone__c, Activa__c
                FROM   Camara__c
                WHERE  OwnerId = :currentUserId
                WITH   SECURITY_ENFORCED
                ORDER BY Name
            ];

            profile.cameras = new List<CameraData>();
            Integer cameraActive = 0;
            for (Camara__c cam : cameraList) {
                profile.cameras.add(new CameraData(cam));
                if (cam.Activa__c) cameraActive++;
            }

            profile.totalCameras    = cameraList.size();
            profile.activeCameras   = cameraActive;
            profile.inactiveCameras = cameraList.size() - cameraActive;

            // Admin check
            profile.isAdmin = checkIsAdmin();

            return profile;
        } catch (Exception e) {
            throw new AuraHandledException(
                'Error al obtener datos del perfil: ' + e.getMessage()
            );
        }
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
}
