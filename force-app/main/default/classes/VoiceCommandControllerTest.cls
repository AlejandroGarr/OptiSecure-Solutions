/**
 * @description Clase de prueba para VoiceCommandController.
 *              Usa HttpCalloutMock para simular la respuesta de Google Gemini
 *              y verifica la creación de Casos y la consulta de cámaras.
 * @author      OptiSecure Solutions
 */
@isTest
private class VoiceCommandControllerTest {

    // ═══════════════════════════════════════════
    //  MOCK — Simula la respuesta de Google Gemini
    // ═══════════════════════════════════════════

    private class GeminiMockCrearCaso implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            res.setHeader('Content-Type', 'application/json');
            res.setStatusCode(200);
            res.setBody('{"candidates":[{"content":{"parts":[{"text":"{\\"accion\\":\\"crear_caso\\",\\"parametros\\":{\\"asunto\\":\\"Router no funciona\\",\\"descripcion\\":\\"El router de la oficina ha dejado de funcionar completamente\\",\\"prioridad\\":\\"High\\",\\"tipo\\":\\"Electronic\\"}}"}]}}]}');
            return res;
        }
    }

    private class GeminiMockConsultarCamaras implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            res.setHeader('Content-Type', 'application/json');
            res.setStatusCode(200);
            res.setBody('{"candidates":[{"content":{"parts":[{"text":"{\\"accion\\":\\"consultar_camaras\\",\\"parametros\\":{}}"}]}}]}');
            return res;
        }
    }

    private class GeminiMockNoReconocido implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            res.setHeader('Content-Type', 'application/json');
            res.setStatusCode(200);
            res.setBody('{"candidates":[{"content":{"parts":[{"text":"{\\"accion\\":\\"no_reconocido\\",\\"parametros\\":{}}"}]}}]}');
            return res;
        }
    }

    private class GeminiMockError implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            res.setHeader('Content-Type', 'application/json');
            res.setStatusCode(500);
            res.setBody('{"error":{"message":"Internal Server Error"}}');
            return res;
        }
    }

    // ═══════════════════════════════════════════
    //  TEST SETUP
    // ═══════════════════════════════════════════

    @testSetup
    static void setupTestData() {
        List<Camara__c> camaras = new List<Camara__c>{
            new Camara__c(
                Name          = 'Cámara Salón',
                Zone__c       = 'Salón',
                Posicion_X__c = 25.0,
                Posicion_Y__c = 40.0,
                Activa__c     = true,
                Video_Url__c  = 'https://www.youtube.com/watch?v=test1'
            ),
            new Camara__c(
                Name          = 'Cámara Jardín',
                Zone__c       = 'Jardín',
                Posicion_X__c = 60.0,
                Posicion_Y__c = 80.0,
                Activa__c     = true,
                Video_Url__c  = 'https://www.youtube.com/watch?v=test2'
            )
        };
        insert camaras;
    }

    // ═══════════════════════════════════════════
    //  TESTS
    // ═══════════════════════════════════════════

    /**
     * @description Verifica que un comando de voz para crear un caso
     *              genera correctamente un registro Case en Salesforce.
     */
    @isTest
    static void testCrearCasoExitoso() {
        Test.setMock(HttpCalloutMock.class, new GeminiMockCrearCaso());

        Test.startTest();
        String result = VoiceCommandController.processVoiceCommand(
            'Abre un caso de soporte porque el router no funciona'
        );
        Test.stopTest();

        Map<String, Object> response = (Map<String, Object>) JSON.deserializeUntyped(result);
        System.assertEquals(true, response.get('exito'), 'Debería ser exitoso');
        System.assertEquals('crear_caso', response.get('accion'), 'Acción debería ser crear_caso');
        System.assertNotEquals(null, response.get('recordId'), 'Debería devolver un recordId');

        // Verificar que el Case se creó
        List<Case> cases = [SELECT Subject, Priority, Status, Origin FROM Case];
        System.assertEquals(1, cases.size(), 'Debería haber un caso creado');
        System.assertEquals('Router no funciona', cases[0].Subject);
        System.assertEquals('High', cases[0].Priority);
        System.assertEquals('New', cases[0].Status);
    }

    /**
     * @description Verifica que la consulta de cámaras devuelve la info correcta.
     */
    @isTest
    static void testConsultarCamaras() {
        Test.setMock(HttpCalloutMock.class, new GeminiMockConsultarCamaras());

        Test.startTest();
        String result = VoiceCommandController.processVoiceCommand(
            '¿Cuántas cámaras hay activas?'
        );
        Test.stopTest();

        Map<String, Object> response = (Map<String, Object>) JSON.deserializeUntyped(result);
        System.assertEquals(true, response.get('exito'), 'Debería ser exitoso');
        System.assertEquals('consultar_camaras', response.get('accion'), 'Acción debería ser consultar_camaras');
        String mensaje = (String) response.get('mensaje');
        System.assert(mensaje.contains('2'), 'Debería mencionar 2 cámaras activas');
    }

    /**
     * @description Verifica que un comando no reconocido devuelve la respuesta correcta.
     */
    @isTest
    static void testComandoNoReconocido() {
        Test.setMock(HttpCalloutMock.class, new GeminiMockNoReconocido());

        Test.startTest();
        String result = VoiceCommandController.processVoiceCommand(
            'Hola, ¿qué tiempo hace hoy?'
        );
        Test.stopTest();

        Map<String, Object> response = (Map<String, Object>) JSON.deserializeUntyped(result);
        System.assertEquals(false, response.get('exito'), 'Debería no ser exitoso');
        System.assertEquals('no_reconocido', response.get('accion'));
    }

    /**
     * @description Verifica que un texto vacío devuelve error sin hacer callout.
     */
    @isTest
    static void testTextoVacio() {
        Test.startTest();
        String result = VoiceCommandController.processVoiceCommand('');
        Test.stopTest();

        Map<String, Object> response = (Map<String, Object>) JSON.deserializeUntyped(result);
        System.assertEquals(false, response.get('exito'));
        System.assertEquals('no_reconocido', response.get('accion'));
    }

    /**
     * @description Verifica que un texto nulo devuelve error sin hacer callout.
     */
    @isTest
    static void testTextoNulo() {
        Test.startTest();
        String result = VoiceCommandController.processVoiceCommand(null);
        Test.stopTest();

        Map<String, Object> response = (Map<String, Object>) JSON.deserializeUntyped(result);
        System.assertEquals(false, response.get('exito'));
        System.assertEquals('no_reconocido', response.get('accion'));
    }

    /**
     * @description Verifica que un error HTTP de Gemini lanza AuraHandledException.
     */
    @isTest
    static void testErrorGemini() {
        Test.setMock(HttpCalloutMock.class, new GeminiMockError());

        Test.startTest();
        Boolean exceptionThrown = false;
        try {
            VoiceCommandController.processVoiceCommand('Crear un caso');
        } catch (AuraHandledException e) {
            exceptionThrown = true;
            System.assert(e.getMessage().contains('Error'), 'Debería contener mensaje de error');
        }
        Test.stopTest();

        System.assert(exceptionThrown, 'Debería lanzar AuraHandledException');
    }
}
