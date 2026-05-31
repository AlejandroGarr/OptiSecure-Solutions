// Listar modelos disponibles
String apiKey = System.Label.Gemini_API_Key;

HttpRequest req = new HttpRequest();
req.setEndpoint('https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey);
req.setMethod('GET');
req.setTimeout(30000);

Http http = new Http();
HttpResponse res = http.send(req);
System.debug('HTTP_STATUS: ' + res.getStatusCode());
String body = res.getBody();
// Buscar nombres de modelos flash
Pattern p = Pattern.compile('"name"\\s*:\\s*"models/(gemini[^"]*flash[^"]*)"');
Matcher m = p.matcher(body);
while (m.find()) {
    System.debug('MODEL: ' + m.group(1));
}
