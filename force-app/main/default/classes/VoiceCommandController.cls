/**
 * @description Controlador Apex para el Asistente de Voz IA.
 *              Recibe el texto transcrito del LWC, lo envía a la API de Google Gemini
 *              (gratuita) para extraer la intención y los parámetros, y luego ejecuta
 *              la acción correspondiente en Salesforce (ej. crear un Caso).
 * @author      OptiSecure Solutions
 */
public with sharing class VoiceCommandController {

    // Prompt del sistema que define el comportamiento del LLM
    private static final String SYSTEM_PROMPT =
        'Eres un asistente de seguridad para OptiSecure Solutions. '
        + 'Analiza el texto del usuario y extrae la intención y parámetros. '
        + 'Responde SIEMPRE en formato JSON válido con esta estructura exacta:\n'
        + '{\n'
        + '  "accion": "crear_caso" | "consultar_camaras" | "no_reconocido",\n'
        + '  "parametros": {\n'
        + '    "asunto": "string — resumen corto del problema",\n'
        + '    "descripcion": "string — descripción completa",\n'
        + '    "prioridad": "High" | "Medium" | "Low",\n'
        + '    "tipo": "Mechanical" | "Electrical" | "Electronic" | "Structural" | "Other"\n'
        + '  }\n'
        + '}\n\n'
        + 'Reglas:\n'
        + '- Si el usuario pide abrir un caso, reportar un fallo, una incidencia o problema → accion = "crear_caso"\n'
        + '- Si el usuario pregunta por el estado de las cámaras → accion = "consultar_camaras"\n'
        + '- Si no entiendes la intención → accion = "no_reconocido"\n'
        + '- Infiere la prioridad según la urgencia: palabras como "urgente", "crítico", "no funciona" → High; '
        + '"parcial", "intermitente" → Medium; "menor", "estético" → Low. Por defecto → Medium.\n'
        + '- Responde SOLO con el JSON, sin texto adicional ni bloques de código.';

    /**
     * @description Punto de entrada invocado desde el LWC.
     *              Envía el texto a Google Gemini, parsea la respuesta y ejecuta la acción.
     * @param  userText  Texto transcrito del usuario.
     * @return String    JSON con el resultado: {exito, accion, mensaje, recordId}
     */
    @AuraEnabled
    public static String processVoiceCommand(String userText) {
        try {
            if (String.isBlank(userText)) {
                return buildResponse(false, 'no_reconocido', 'No se recibió ningún texto.', null);
            }

            // 1. Llamar a la API de Google Gemini
            String aiJson = callGemini(userText);

            // 2. Limpiar posibles bloques markdown (```json ... ```)
            aiJson = stripMarkdownCodeBlock(aiJson);

            // 3. Parsear la respuesta del LLM
            Map<String, Object> aiResult = (Map<String, Object>) JSON.deserializeUntyped(aiJson);
            String accion = (String) aiResult.get('accion');
            Map<String, Object> parametros = (Map<String, Object>) aiResult.get('parametros');

            // 4. Ejecutar la acción correspondiente
            if ('crear_caso'.equals(accion)) {
                return ejecutarCrearCaso(parametros);
            } else if ('consultar_camaras'.equals(accion)) {
                return ejecutarConsultarCamaras();
            } else {
                return buildResponse(false, 'no_reconocido',
                    'No he podido entender tu solicitud. Intenta algo como: '
                    + '"Abre un caso porque la cámara del jardín no funciona".', null);
            }
        } catch (Exception e) {
            String errorMsg = 'Error al procesar el comando de voz: ' + e.getMessage();
            AuraHandledException auraEx = new AuraHandledException(errorMsg);
            auraEx.setMessage(errorMsg);
            throw auraEx;
        }
    }

    // ═══════════════════════════════════════════
    //  ACCIONES
    // ═══════════════════════════════════════════

    /**
     * @description Crea un registro Case con los parámetros extraídos por la IA.
     */
    private static String ejecutarCrearCaso(Map<String, Object> parametros) {
        String asunto      = parametros != null ? (String) parametros.get('asunto') : 'Incidencia por voz';
        String descripcion = parametros != null ? (String) parametros.get('descripcion') : '';
        String prioridad   = parametros != null ? (String) parametros.get('prioridad') : 'Medium';
        String tipo        = parametros != null ? (String) parametros.get('tipo') : 'Other';

        // Validar prioridad
        Set<String> validPriorities = new Set<String>{ 'High', 'Medium', 'Low' };
        if (!validPriorities.contains(prioridad)) {
            prioridad = 'Medium';
        }

        Case newCase = new Case(
            Subject     = asunto,
            Description = '[Creado por Asistente de Voz IA]\n\n' + descripcion,
            Priority    = prioridad,
            Status      = 'New',
            Origin      = 'Web',
            Type        = tipo
        );
        insert newCase;

        return buildResponse(true, 'crear_caso',
            'Se ha creado el caso "' + asunto + '" con prioridad ' + prioridad + '.', newCase.Id);
    }

    /**
     * @description Consulta las cámaras activas y devuelve un resumen.
     */
    private static String ejecutarConsultarCamaras() {
        List<Camara__c> camaras = [
            SELECT Name, Zone__c
            FROM   Camara__c
            WHERE  Activa__c = TRUE
            WITH   SECURITY_ENFORCED
            ORDER BY Name ASC
            LIMIT 50
        ];

        if (camaras.isEmpty()) {
            return buildResponse(true, 'consultar_camaras',
                'No hay cámaras activas en el sistema.', null);
        }

        List<String> nombres = new List<String>();
        for (Camara__c cam : camaras) {
            nombres.add(cam.Name + ' (' + cam.Zone__c + ')');
        }

        return buildResponse(true, 'consultar_camaras',
            'Hay ' + camaras.size() + ' cámaras activas: ' + String.join(nombres, ', ') + '.', null);
    }

    // ═══════════════════════════════════════════
    //  CALLOUT A GOOGLE GEMINI (GRATUITO)
    // ═══════════════════════════════════════════

    /**
     * @description Realiza una llamada HTTP POST a la API de Google Gemini
     *              (modelo gemini-2.0-flash, gratuito hasta 15 RPM).
     *              La API Key se almacena en una Custom Label llamada 'Gemini_API_Key'.
     * @param  userText  El texto del usuario a analizar.
     * @return String    El contenido JSON devuelto por el modelo.
     */
    private static String callGemini(String userText) {
        String apiKey = System.Label.Gemini_API_Key;

        // Construir el cuerpo de la petición (formato Gemini)
        Map<String, Object> requestBody = new Map<String, Object>{
            'system_instruction' => new Map<String, Object>{
                'parts' => new List<Map<String, String>>{
                    new Map<String, String>{ 'text' => SYSTEM_PROMPT }
                }
            },
            'contents' => new List<Map<String, Object>>{
                new Map<String, Object>{
                    'parts' => new List<Map<String, String>>{
                        new Map<String, String>{ 'text' => userText }
                    }
                }
            },
            'generationConfig' => new Map<String, Object>{
                'temperature' => 0.2,
                'maxOutputTokens' => 500
            }
        };

        HttpRequest req = new HttpRequest();
        req.setEndpoint('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey);
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setTimeout(30000);
        req.setBody(JSON.serialize(requestBody));

        Http http = new Http();
        HttpResponse res = http.send(req);

        if (res.getStatusCode() != 200) {
            throw new AuraHandledException(
                'Error en la API de Gemini (HTTP ' + res.getStatusCode() + '): ' + res.getBody()
            );
        }

        // Extraer el contenido de la respuesta (formato Gemini)
        Map<String, Object> responseBody = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
        List<Object> candidates = (List<Object>) responseBody.get('candidates');
        Map<String, Object> firstCandidate = (Map<String, Object>) candidates[0];
        Map<String, Object> content = (Map<String, Object>) firstCandidate.get('content');
        List<Object> parts = (List<Object>) content.get('parts');
        Map<String, Object> firstPart = (Map<String, Object>) parts[0];
        String text = (String) firstPart.get('text');

        return text.trim();
    }

    // ═══════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════

    /**
     * @description Elimina bloques de código markdown que Gemini a veces
     *              añade alrededor del JSON (```json ... ```).
     */
    private static String stripMarkdownCodeBlock(String text) {
        if (String.isBlank(text)) return text;
        String trimmed = text.trim();
        // Eliminar ```json al inicio y ``` al final
        if (trimmed.startsWith('```')) {
            Integer firstNewline = trimmed.indexOf('\n');
            if (firstNewline > 0) {
                trimmed = trimmed.substring(firstNewline + 1);
            }
            if (trimmed.endsWith('```')) {
                trimmed = trimmed.substring(0, trimmed.length() - 3);
            }
        }
        return trimmed.trim();
    }

    /**
     * @description Construye el JSON de respuesta estándar.
     */
    private static String buildResponse(Boolean exito, String accion, String mensaje, Id recordId) {
        Map<String, Object> response = new Map<String, Object>{
            'exito'    => exito,
            'accion'   => accion,
            'mensaje'  => mensaje,
            'recordId' => recordId
        };
        return JSON.serialize(response);
    }
}
