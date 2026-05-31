/**
 * @description       : 
 * @author            : ChangeMeIn@UserSettingsUnder.SFDoc
 * @group             : 
 * @last modified on  : 05-30-2026
 * @last modified by  : ChangeMeIn@UserSettingsUnder.SFDoc
**/

@isTest
private class HouseMapControllerTest {


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

    @isTest
    static void testGetCameras() {
        Test.startTest();
        List<Camara__c> resultado = HouseMapController.getCamaras(null);
        Test.stopTest();

        System.assertEquals(2, resultado.size(),
            'Se esperaban exactamente 2 cámaras activas');

        for (Camara__c cam : resultado) {
            System.assertNotEquals(null, cam.Name,
                'Name no debe ser nulo');
            System.assertNotEquals(null, cam.Posicion_X__c,
                'Posicion_X__c no debe ser nulo');
            System.assertNotEquals(null, cam.Posicion_Y__c,
                'Posicion_Y__c no debe ser nulo');
        }
    }

    @isTest
    static void testIsSystemAdmin() {
        Test.startTest();
        Boolean esAdmin = HouseMapController.isSystemAdmin();
        Test.stopTest();

        System.assertNotEquals(null, esAdmin,
            'isSystemAdmin() debe devolver un valor booleano no nulo');
    }

    @isTest
    static void testSaveDraggedCamera() {
        String nombre   = 'Cámara Test Drag';
        Decimal posX    = 50.0;
        Decimal posY    = 70.0;
        String videoUrl = 'https://leena-menopausal-weepily.ngrok-free.dev/video_feed';

        Test.startTest();
        Camara__c nueva = HouseMapController.saveDraggedCamera(
            nombre, posX, posY, videoUrl
        );
        Test.stopTest();

        System.assertNotEquals(null, nueva.Id,
            'La cámara creada debe tener un Id asignado');
        System.assertEquals(nombre, nueva.Name,
            'El nombre debe coincidir');
        System.assertEquals(posX, nueva.Posicion_X__c,
            'Posicion_X__c debe coincidir');
        System.assertEquals(posY, nueva.Posicion_Y__c,
            'Posicion_Y__c debe coincidir');
        System.assertEquals(videoUrl, nueva.Video_Url__c,
            'Video_Url__c debe coincidir');
        System.assertEquals(true, nueva.Activa__c,
            'La cámara debe crearse como activa');
        System.assertEquals('Salón', nueva.Zone__c,
            'La zona debe ser Salón');
    }

    @isTest
    static void testUpdateCameraPosition() {
        Camara__c cam = [
            SELECT Id, Posicion_X__c, Posicion_Y__c
            FROM   Camara__c
            WHERE  Activa__c = TRUE
            LIMIT  1
        ];

        Decimal nuevaPosX = 99.0;
        Decimal nuevaPosY = 88.0;

        Test.startTest();
        HouseMapController.updateCameraPosition(cam.Id, nuevaPosX, nuevaPosY);
        Test.stopTest();

        Camara__c actualizada = [
            SELECT Posicion_X__c, Posicion_Y__c
            FROM   Camara__c
            WHERE  Id = :cam.Id
        ];

        System.assertEquals(nuevaPosX, actualizada.Posicion_X__c,
            'Posicion_X__c debe haberse actualizado');
        System.assertEquals(nuevaPosY, actualizada.Posicion_Y__c,
            'Posicion_Y__c debe haberse actualizado');
    }
}
