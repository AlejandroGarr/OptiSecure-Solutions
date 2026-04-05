/**
 * @description Clase de prueba para CameraIncidentController.
 *              Verifica la obtención de opciones de cámara y la
 *              creación de Cases asociados a incidencias de cámaras.
 * @author      OptiSecure Solutions
 * @date        2026-02-26
 */
@isTest
private class CameraIncidentControllerTest {

    @testSetup
    static void setupTestData() {
        List<Camara__c> camaras = new List<Camara__c>{
            new Camara__c(
                Name          = 'Cámara Salón',
                Zone__c       = 'Salón',
                Posicion_X__c = 25.0,
                Posicion_Y__c = 40.0,
                Activa__c     = true,
                Video_Url__c  = 'https://leena-menopausal-weepily.ngrok-free.dev/video_feed'
            ),
            new Camara__c(
                Name          = 'Cámara Jardín',
                Zone__c       = 'Jardín',
                Posicion_X__c = 60.0,
                Posicion_Y__c = 80.0,
                Activa__c     = true,
                Video_Url__c  = 'https://leena-menopausal-weepily.ngrok-free.dev/video_feed'
            ),
            new Camara__c(
                Name          = 'Cámara Entrada',
                Zone__c       = 'Entrada',
                Posicion_X__c = 10.0,
                Posicion_Y__c = 15.0,
                Activa__c     = false,
                Video_Url__c  = 'https://leena-menopausal-weepily.ngrok-free.dev/video_feed'
            )
        };
        insert camaras;
    }

    /**
     * @description Verifica que getCameraOptions() devuelve solo las cámaras
     *              activas con el formato correcto (value=Id, label=Name—Zone).
     */
    @isTest
    static void testGetCameraOptions() {
        Test.startTest();
        List<Map<String, String>> options = CameraIncidentController.getCameraOptions();
        Test.stopTest();

        System.assertEquals(2, options.size(),
            'Se esperaban 2 opciones (solo cámaras activas)');

        for (Map<String, String> opt : options) {
            System.assertNotEquals(null, opt.get('value'),
                'Cada opción debe tener un value (Id)');
            System.assertNotEquals(null, opt.get('label'),
                'Cada opción debe tener un label (Name — Zone)');
            System.assert(opt.get('label').contains('—'),
                'El label debe contener el separador "—"');
        }
    }

    /**
     * @description Verifica que createCameraIncident() crea un Case
     *              con los datos correctos.
     */
    @isTest
    static void testCreateCameraIncident() {
        Camara__c cam = [
            SELECT Id, Name
            FROM   Camara__c
            WHERE  Activa__c = TRUE
            LIMIT  1
        ];

        String subject     = 'Cámara sin señal';
        String description = 'La cámara no transmite imagen desde las 14:00';
        String priority    = 'High';

        Test.startTest();
        Id caseId = CameraIncidentController.createCameraIncident(
            cam.Id, subject, description, priority
        );
        Test.stopTest();

        System.assertNotEquals(null, caseId,
            'Debe devolver el Id del Case creado');

        Case createdCase = [
            SELECT Subject, Description, Priority, Status, Origin, Type
            FROM   Case
            WHERE  Id = :caseId
        ];

        System.assertEquals(subject, createdCase.Subject,
            'El asunto debe coincidir');
        System.assertEquals('High', createdCase.Priority,
            'La prioridad debe ser High');
        System.assertEquals('New', createdCase.Status,
            'El estado debe ser New');
        System.assertEquals('Web', createdCase.Origin,
            'El origen debe ser Web');
        System.assertEquals('Mechanical', createdCase.Type,
            'El tipo debe ser Mechanical');
        System.assert(createdCase.Description.contains(cam.Name),
            'La descripción debe contener el nombre de la cámara');
    }

    /**
     * @description Verifica que createCameraIncident() con un Id
     *              inválido lanza AuraHandledException.
     */
    @isTest
    static void testCreateCameraIncidentInvalidId() {
        Boolean exceptionThrown = false;

        Test.startTest();
        try {
            CameraIncidentController.createCameraIncident(
                'a00000000000000AAA', 'Test', 'Test', 'Low'
            );
        } catch (Exception e) {
            exceptionThrown = true;
        }
        Test.stopTest();

        System.assert(exceptionThrown,
            'Debe lanzar una excepción para un Id inválido');
    }
}
