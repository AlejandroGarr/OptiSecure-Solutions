// Reasignar Tasks huérfanos de detección al contacto real de su cámara.
// Extrae el nombre de la cámara del Subject y busca su Contacto__c.

// 1. Mapa cámara-nombre → contacto
Map<String, Id> camNameToContact = new Map<String, Id>();
for (Camara__c cam : [SELECT Name, Contacto__c FROM Camara__c WHERE Contacto__c != null]) {
    camNameToContact.put(cam.Name, cam.Contacto__c);
}

// 2. Tasks de detección sin contacto asignado
List<Task> tasks = [
    SELECT Id, Subject, WhoId
    FROM Task
    WHERE Subject LIKE '%Persona detectada%'
    AND WhoId = null
];

Integer fixed = 0;
for (Task t : tasks) {
    // Subject: "⚠ Persona detectada - NombreCámara"
    String camName = t.Subject.substringAfter(' - ');
    if (camName != null && camNameToContact.containsKey(camName)) {
        t.WhoId = camNameToContact.get(camName);
        fixed++;
    }
}

if (!tasks.isEmpty()) {
    update tasks;
}
System.debug('Tasks encontrados: ' + tasks.size() + ' | Corregidos: ' + fixed);
