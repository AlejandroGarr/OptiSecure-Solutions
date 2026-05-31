@isTest
private class ContratacionCamaraControllerTest {

    @TestSetup
    static void setup() {
        // Crear cuenta y contacto
        Account acc = new Account(Name = 'Test Account');
        insert acc;

        Contact con = new Contact(
            FirstName = 'Test',
            LastName  = 'User',
            AccountId = acc.Id,
            Email     = 'test@optisecure.com'
        );
        insert con;
    }

    @isTest
    static void testGetSolicitudesPendientes() {
        Account acc = [SELECT Id FROM Account LIMIT 1];
        Contact con = [SELECT Id FROM Contact LIMIT 1];

        Solicitud_Camara__c sol = new Solicitud_Camara__c(
            Numero_Camaras__c     = 3,
            Estado__c             = 'Pendiente',
            Contacto__c           = con.Id,
            Cuenta__c             = acc.Id,
            Nombre_Solicitante__c = 'Test User',
            Email_Solicitante__c  = 'test@optisecure.com',
            Fecha_Solicitud__c    = Date.today()
        );
        insert sol;

        Test.startTest();
        List<Solicitud_Camara__c> result = ContratacionCamaraController.getSolicitudesPendientes();
        Test.stopTest();

        System.assertEquals(1, result.size(), 'Debe devolver 1 solicitud pendiente');
        System.assertEquals('Pendiente', result[0].Estado__c);
    }

    @isTest
    static void testAprobarSolicitud() {
        Contact con = [SELECT Id FROM Contact LIMIT 1];

        Solicitud_Camara__c sol = new Solicitud_Camara__c(
            Numero_Camaras__c     = 2,
            Estado__c             = 'Pendiente',
            Contacto__c           = con.Id,
            Fecha_Solicitud__c    = Date.today()
        );
        insert sol;

        Test.startTest();
        ContratacionCamaraController.aprobarSolicitud(sol.Id);
        Test.stopTest();

        Solicitud_Camara__c updated = [SELECT Estado__c FROM Solicitud_Camara__c WHERE Id = :sol.Id];
        System.assertEquals('Aprobada', updated.Estado__c, 'La solicitud debe estar Aprobada');
    }

    @isTest
    static void testRechazarSolicitud() {
        Contact con = [SELECT Id FROM Contact LIMIT 1];

        Solicitud_Camara__c sol = new Solicitud_Camara__c(
            Numero_Camaras__c     = 1,
            Estado__c             = 'Pendiente',
            Contacto__c           = con.Id,
            Fecha_Solicitud__c    = Date.today()
        );
        insert sol;

        Test.startTest();
        ContratacionCamaraController.rechazarSolicitud(sol.Id);
        Test.stopTest();

        Solicitud_Camara__c updated = [SELECT Estado__c FROM Solicitud_Camara__c WHERE Id = :sol.Id];
        System.assertEquals('Rechazada', updated.Estado__c, 'La solicitud debe estar Rechazada');
    }

    @isTest
    static void testCompletarSolicitud() {
        Contact con = [SELECT Id FROM Contact LIMIT 1];

        Solicitud_Camara__c sol = new Solicitud_Camara__c(
            Numero_Camaras__c     = 4,
            Estado__c             = 'Aprobada',
            Contacto__c           = con.Id,
            Fecha_Solicitud__c    = Date.today()
        );
        insert sol;

        Test.startTest();
        ContratacionCamaraController.completarSolicitud(sol.Id);
        Test.stopTest();

        Solicitud_Camara__c updated = [SELECT Estado__c FROM Solicitud_Camara__c WHERE Id = :sol.Id];
        System.assertEquals('Completada', updated.Estado__c, 'La solicitud debe estar Completada');
    }

    @isTest
    static void testGetSolicitudAprobadaActiva() {
        // Ejecutando como admin sin ContactId devuelve null
        Test.startTest();
        ContratacionCamaraController.SolicitudAprobada result =
            ContratacionCamaraController.getSolicitudAprobadaActiva();
        Test.stopTest();

        System.assertEquals(null, result, 'Admin sin ContactId debe devolver null');
    }

    @isTest
    static void testGetMisSolicitudes() {
        // Ejecutando como admin sin ContactId devuelve lista vacía
        Test.startTest();
        List<Solicitud_Camara__c> result = ContratacionCamaraController.getMisSolicitudes();
        Test.stopTest();

        System.assertEquals(0, result.size(), 'Admin sin ContactId debe devolver lista vacía');
    }
}
