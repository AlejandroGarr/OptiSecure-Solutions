/**
 * @description Controlador Apex para el componente customUserMenu.
 *              Proporciona los datos de perfil del usuario actual y
 *              el recuento de cámaras asociadas.
 * @author      OptiSecure Solutions
 * @date        2026-03-06
 */
public with sharing class UserMenuController {

    /**
     * Wrapper ligero para devolver datos de perfil al LWC.
     */
    public class UserProfileData {
        @AuraEnabled public String name;
        @AuraEnabled public String email;
        @AuraEnabled public Integer totalCameras;
    }

    /**
     * @description Obtiene el nombre, correo y número de cámaras del usuario actual.
     * @return      UserProfileData con Name, Email y TotalCameras.
     * @throws      AuraHandledException si ocurre un error en la consulta.
     */
    @AuraEnabled(cacheable=true)
    public static UserProfileData getUserProfileData() {
        try {
            Id currentUserId = UserInfo.getUserId();

            User u = [
                SELECT Name, Email
                FROM   User
                WHERE  Id = :currentUserId
                WITH   SECURITY_ENFORCED
                LIMIT  1
            ];

            Integer cameraCount = [
                SELECT COUNT()
                FROM   Camara__c
                WHERE  OwnerId = :currentUserId
                WITH   SECURITY_ENFORCED
            ];

            UserProfileData profile   = new UserProfileData();
            profile.name              = u.Name;
            profile.email             = u.Email;
            profile.totalCameras      = cameraCount;

            return profile;
        } catch (Exception e) {
            throw new AuraHandledException(
                'Error al obtener datos del perfil: ' + e.getMessage()
            );
        }
    }
}
