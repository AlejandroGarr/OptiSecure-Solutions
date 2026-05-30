/**
 * @description       : 
 * @author            : ChangeMeIn@UserSettingsUnder.SFDoc
 * @group             : 
 * @last modified on  : 05-30-2026
 * @last modified by  : ChangeMeIn@UserSettingsUnder.SFDoc
**/
public with sharing class VoiceCommandController {

    // Prompt del sistema que define el comportamiento del LLM
    private static final String SYSTEM_PROMPT =
        'Eres un asistente de seguridad para OptiSecure Solutions. '
        + 'Analiza el texto del usuario y extrae la intención y parámetros. '
        + 'Responde SIEMPRE en formato JSON válido con esta estructura exacta:\n'
        + '{\n'
        + '  "accion": "crear_caso" | "consultar_camaras" | "abrir_camara" | "abrir_notificacion" | "contar_notificaciones" | "no_reconocido",\n'
        + '  "parametros": {\n'
        + '    "asunto": "string — resumen corto del problema (solo para crear_caso)",\n'
        + '    "descripcion": "string — descripción completa (solo para crear_caso)",\n'
        + '    "prioridad": "High" | "Medium" | "Low" (solo para crear_caso)",\n'
        + '    "tipo": "Mechanical" | "Electrical" | "Electronic" | "Structural" | "Other" (solo para crear_caso)",\n'
        + '    "nombre_camara": "string — nombre o zona de la cámara tal como la menciona el usuario (solo para abrir_camara)",\n'
        + '    "selector_notificacion": "string — criterio para seleccionar la notificación (solo para abrir_notificacion)"\n'
        + '  }\n'
        + '}\n\n'
        + 'Reglas:\n'
        + '- Si el usuario pide abrir un caso, reportar un fallo, una incidencia o problema → accion = "crear_caso"\n'
        + '- Si el usuario pregunta por el estado de las cámaras → accion = "consultar_camaras"\n'
        + '- Si el usuario dice "abre la cámara X", "muéstrame la cámara X", "pon la cámara X", '
        + '"abre cámara X" (donde X es un nombre o zona como Salón, Jardín, Cocina, Entrada, etc.) → accion = "abrir_camara", '
        + 'parametros.nombre_camara = el nombre o zona mencionado (ej: "Salón", "Jardín", "Cocina", "Entrada")\n'
        + '- Si el usuario quiere abrir/ver una notificación, alerta o clip → accion = "abrir_notificacion" y pon en '
        + 'parametros.selector_notificacion UNO de estos valores exactos:\n'
        + '  · "ultima" — si dice "la última notificación", "la más reciente", "la última alerta"\n'
        + '  · "penultima" — si dice "la penúltima", "la anterior a la última"\n'
        + '  · "primera" — si dice "la primera", "la más antigua", "la primera de hoy"\n'
        + '  · "N" (un número, ej: "1", "2", "3") — si dice "la notificación número 3", "la tercera notificación"\n'
        + '  · "HH:MM" (formato 12h o 24h, ej: "10:05", "14:30") — si dice "la notificación de las 10 y 5", "la de las 2 y media" → "14:30". '
        + 'Si la hora es ambigua (ej: "las 10" puede ser 10:00 o 22:00), pon la hora tal cual en formato HH:MM (ej: "10:00") '
        + 'y el sistema elegirá automáticamente la más cercana entre AM y PM.\n'
        + '- Si el usuario pregunta cuántas notificaciones, alertas o detecciones ha habido hoy → accion = "contar_notificaciones"\n'
        + '- Si no entiendes la intención → accion = "no_reconocido"\n'
        + '- Infiere la prioridad según la urgencia: palabras como "urgente", "crítico", "no funciona" → High; '
        + '"parcial", "intermitente" → Medium; "menor", "estético" → Low. Por defecto → Medium.\n'
        + '- Responde SOLO con el JSON, sin texto adicional ni bloques de código.';

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
            } else if ('abrir_camara'.equals(accion)) {
                String nombreCamara = parametros != null && parametros.get('nombre_camara') != null
                    ? String.valueOf(parametros.get('nombre_camara'))
                    : null;
                if (String.isBlank(nombreCamara)) {
                    return buildResponse(false, 'no_reconocido',
                        'No he podido identificar la cámara. Indica el nombre o zona (ej: Salón, Jardín).', null);
                }
                return ejecutarAbrirCamara(nombreCamara);
            } else if ('abrir_notificacion'.equals(accion)) {
                String selector = parametros != null && parametros.get('selector_notificacion') != null
                    ? String.valueOf(parametros.get('selector_notificacion'))
                    : 'ultima';
                return ejecutarAbrirNotificacion(selector);
            } else if ('contar_notificaciones'.equals(accion)) {
                return ejecutarContarNotificaciones();
            } else {
                return buildResponse(false, 'no_reconocido',
                    'No he podido entender tu solicitud. Intenta algo como: '
                    + '"Abre un caso porque la cámara del jardín no funciona", '
                    + '"Abre la cámara 3" o "Abre la última notificación".', null);
            }
        } catch (Exception e) {
            String errorMsg = 'Error al procesar el comando de voz: ' + e.getMessage();
            AuraHandledException auraEx = new AuraHandledException(errorMsg);
            auraEx.setMessage(errorMsg);
            throw auraEx;
        }
    }

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

    private static String ejecutarAbrirCamara(String nombreCamara) {
        // Generar variantes: texto original + conversión número↔palabra
        List<String> variantes = new List<String>();
        variantes.add(nombreCamara);
        String alternativa = convertirNumero(nombreCamara);
        if (alternativa != null && alternativa != nombreCamara) {
            variantes.add(alternativa);
        }

        // Buscar por nombre o zona con cada variante
        for (String variante : variantes) {
            String searchTerm = '%' + String.escapeSingleQuotes(variante) + '%';
            List<Camara__c> camaras = new CameraFetcher().search(searchTerm);
            if (!camaras.isEmpty()) {
                return buildCameraResponse(camaras[0]);
            }
        }

        // Fallback: si es un número (o palabra numérica), seleccionar la N-ésima cámara por orden
        Integer posicion = resolverPosicionNumerica(nombreCamara);
        if (posicion != null && posicion >= 1) {
            List<Camara__c> todas = new CameraFetcher().fetchAll();
            if (posicion <= todas.size()) {
                return buildCameraResponse(todas[posicion - 1]);
            }
            return buildResponse(false, 'abrir_camara',
                'Solo hay ' + todas.size() + ' cámaras activas. Indica un número del 1 al ' + todas.size() + '.', null);
        }

        return buildResponse(false, 'abrir_camara',
            'No se encontró ninguna cámara con el nombre "' + nombreCamara + '".', null);
    }

    private static String buildCameraResponse(Camara__c cam) {
        Map<String, Object> response = new Map<String, Object>{
            'exito'   => true,
            'accion'  => 'abrir_camara',
            'mensaje' => 'Abriendo cámara ' + cam.Name + ' (' + cam.Zone__c + ')',
            'recordId' => cam.Id,
            'camara'  => new Map<String, Object>{
                'id'       => cam.Id,
                'label'    => cam.Name,
                'zone'     => cam.Zone__c,
                'url'      => cam.Video_URL__c,
                'location' => cam.Zone__c
            }
        };
        return JSON.serialize(response);
    }

    private static Integer resolverPosicionNumerica(String input) {
        String lower = input.toLowerCase().trim();
        // Si ya es un dígito
        if (lower.isNumeric()) {
            return Integer.valueOf(lower);
        }
        // Convertir palabra a dígito
        String digito = convertirNumero(input);
        if (digito != null && digito.isNumeric()) {
            return Integer.valueOf(digito);
        }
        return null;
    }

    private static String convertirNumero(String input) {
        Map<String, String> palabraADigito = new Map<String, String>{
            'uno' => '1', 'una' => '1', 'primero' => '1', 'primera' => '1',
            'dos' => '2', 'segundo' => '2', 'segunda' => '2',
            'tres' => '3', 'tercero' => '3', 'tercera' => '3',
            'cuatro' => '4', 'cuarto' => '4', 'cuarta' => '4',
            'cinco' => '5', 'quinto' => '5', 'quinta' => '5',
            'seis' => '6', 'sexto' => '6', 'sexta' => '6',
            'siete' => '7', 'séptimo' => '7', 'séptima' => '7',
            'ocho' => '8', 'octavo' => '8', 'octava' => '8',
            'nueve' => '9', 'noveno' => '9', 'novena' => '9',
            'diez' => '10', 'décimo' => '10', 'décima' => '10'
        };
        Map<String, String> digitoAPalabra = new Map<String, String>{
            '1' => 'uno', '2' => 'dos', '3' => 'tres', '4' => 'cuatro',
            '5' => 'cinco', '6' => 'seis', '7' => 'siete', '8' => 'ocho',
            '9' => 'nueve', '10' => 'diez'
        };

        String lower = input.toLowerCase().trim();

        // Palabra → dígito
        if (palabraADigito.containsKey(lower)) {
            return palabraADigito.get(lower);
        }
        // Dígito → palabra
        if (digitoAPalabra.containsKey(lower)) {
            return digitoAPalabra.get(lower);
        }
        return null;
    }

    private without sharing class CameraFetcher {
        public List<Camara__c> search(String searchTerm) {
            return [
                SELECT Id, Name, Zone__c, Video_URL__c
                FROM   Camara__c
                WHERE  Activa__c = TRUE
                AND    (Name LIKE :searchTerm OR Zone__c LIKE :searchTerm)
                ORDER BY Name ASC
                LIMIT 1
            ];
        }
        public List<Camara__c> fetchAll() {
            return [
                SELECT Id, Name, Zone__c, Video_URL__c
                FROM   Camara__c
                WHERE  Activa__c = TRUE
                ORDER BY Name ASC
                LIMIT 50
            ];
        }
    }

    private static String ejecutarAbrirNotificacion(String selector) {
        // Reutilizar AlertHelper (without sharing) del SecurityClipController
        List<Task> tasks = fetchAlertTasks();

        if (tasks.isEmpty()) {
            return buildResponse(false, 'abrir_notificacion',
                'No hay notificaciones disponibles.', null);
        }

        Integer idx = resolveAlertIndex(selector, tasks);

        if (idx < 0 || idx >= tasks.size()) {
            return buildResponse(false, 'abrir_notificacion',
                'No se encontró una notificación que coincida con "' + selector + '".', null);
        }

        Task selected = tasks[idx];
        String clipUrl = extractClipUrlFromDescription(selected.Description);
        String subject = selected.Subject;
        Datetime created = selected.CreatedDate;
        String timeStr = created != null
            ? created.format('HH:mm', 'Europe/Madrid')
            : '';

        Map<String, Object> response = new Map<String, Object>{
            'exito'   => true,
            'accion'  => 'abrir_notificacion',
            'mensaje' => 'Abriendo notificación: ' + subject + ' (' + timeStr + ')',
            'recordId' => null,
            'notificacion' => new Map<String, Object>{
                'taskId'  => selected.Id,
                'subject' => subject,
                'clipUrl' => clipUrl,
                'createdDate' => String.valueOf(created),
                'contactName' => selected.Who != null ? selected.Who.Name : null
            }
        };
        return JSON.serialize(response);
    }

    private static String ejecutarContarNotificaciones() {
        List<Task> tasks = fetchAlertTasks();
        Date hoy = Date.today();
        Integer count = 0;
        for (Task t : tasks) {
            if (t.CreatedDate != null && t.CreatedDate.dateGmt() == hoy) {
                count++;
            }
        }

        String mensaje;
        if (count == 0) {
            mensaje = 'No ha habido ninguna notificación hoy.';
        } else if (count == 1) {
            mensaje = 'Ha habido 1 notificación hoy.';
        } else {
            mensaje = 'Ha habido ' + count + ' notificaciones hoy.';
        }

        return buildResponse(true, 'contar_notificaciones', mensaje, null);
    }

    private static Integer resolveAlertIndex(String selector, List<Task> tasks) {
        if (String.isBlank(selector) || selector == 'ultima') {
            return 0;
        }
        if (selector == 'penultima') {
            return tasks.size() > 1 ? 1 : -1;
        }
        if (selector == 'primera') {
            return tasks.size() - 1;
        }

        // Número: "1" → primera (index 0), "2" → segunda, etc.
        if (selector.isNumeric()) {
            Integer n = Integer.valueOf(selector);
            return (n >= 1 && n <= tasks.size()) ? n - 1 : -1;
        }

        // Hora "HH:MM": buscar la notificación más cercana a esa hora
        // Si la hora es ≤12, prueba tanto AM como PM y elige la más cercana
        if (selector.contains(':') && selector.length() <= 5) {
            List<String> parts = selector.split(':');
            if (parts.size() == 2) {
                try {
                    Integer targetHour = Integer.valueOf(parts[0]);
                    Integer targetMin  = Integer.valueOf(parts[1]);

                    // Candidatos de hora: la literal y, si ≤12, también +12 (PM)
                    List<Integer> candidateMins = new List<Integer>();
                    candidateMins.add(targetHour * 60 + targetMin);
                    if (targetHour >= 1 && targetHour <= 11) {
                        candidateMins.add((targetHour + 12) * 60 + targetMin);
                    }

                    Integer bestIdx = -1;
                    Integer bestDiff = 999999;
                    for (Integer i = 0; i < tasks.size(); i++) {
                        Datetime dt = tasks[i].CreatedDate;
                        String timeStr = dt.format('HH:mm', 'Europe/Madrid');
                        List<String> tp = timeStr.split(':');
                        Integer taskMins = Integer.valueOf(tp[0]) * 60 + Integer.valueOf(tp[1]);
                        for (Integer candidate : candidateMins) {
                            Integer diff = Math.abs(taskMins - candidate);
                            if (diff < bestDiff) {
                                bestDiff = diff;
                                bestIdx = i;
                            }
                        }
                    }
                    return bestIdx;
                } catch (Exception e) {
                    return -1;
                }
            }
        }

        return -1;
    }

    private static List<Task> fetchAlertTasks() {
        return new AlertTaskFetcher().fetch();
    }

    private without sharing class AlertTaskFetcher {
        public List<Task> fetch() {
            User currentUser = [
                SELECT ContactId
                FROM   User
                WHERE  Id = :UserInfo.getUserId()
                LIMIT  1
            ];

            if (currentUser.ContactId != null) {
                return [
                    SELECT Id, Subject, Description, CreatedDate, Who.Name
                    FROM   Task
                    WHERE  Subject LIKE '%Persona detectada%'
                    AND    WhoId = :currentUser.ContactId
                    ORDER BY CreatedDate DESC
                    LIMIT  30
                ];
            } else {
                return [
                    SELECT Id, Subject, Description, CreatedDate, Who.Name
                    FROM   Task
                    WHERE  Subject LIKE '%Persona detectada%'
                    ORDER BY CreatedDate DESC
                    LIMIT  50
                ];
            }
        }
    }

    private static String extractClipUrlFromDescription(String description) {
        if (String.isBlank(description)) return null;
        Integer startIdx = description.indexOf('[CLIP_URL]');
        Integer endIdx   = description.indexOf('[/CLIP_URL]');
        if (startIdx == -1 || endIdx == -1 || endIdx <= startIdx) return null;
        return description.substring(startIdx + 10, endIdx).trim();
    }

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
        req.setEndpoint('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=' + apiKey);
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setTimeout(30000);
        req.setBody(JSON.serialize(requestBody));

        Http http = new Http();
        HttpResponse res = http.send(req);

        if (res.getStatusCode() != 200) {
            throw new CalloutException(
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

    private static String buildResponse(Boolean exito, String accion, String mensaje, Id recordId) {
        Map<String, Object> response = new Map<String, Object>{
            'exito'    => exito,
            'accion'   => accion,
            'mensaje'  => mensaje,
            'recordId' => recordId
        };
        return JSON.serialize(response);
    }

    private static String buildResponseWithPayload(Boolean exito, String accion, String mensaje, Integer payload) {
        Map<String, Object> response = new Map<String, Object>{
            'exito'    => exito,
            'accion'   => accion,
            'mensaje'  => mensaje,
            'recordId' => null,
            'payload'  => payload
        };
        return JSON.serialize(response);
    }
}
