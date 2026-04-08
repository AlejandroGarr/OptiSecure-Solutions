// Simular lo que ve Pepe como usuario portal
// Pepe's UserId: 005gK00002bqmvbQAA, ContactId: 003gK00000TxYhhQAF

// 1. Verificar que el usuario tiene ContactId
User pepeUser = [SELECT Id, Name, ContactId, Profile.Name FROM User WHERE Id = '005gK00002bqmvbQAA'];
System.debug('USER: ' + pepeUser.Name + ' | ContactId: ' + pepeUser.ContactId + ' | Profile: ' + pepeUser.Profile.Name);

// 2. Simular la query que hace AlertHelper para un portal user
List<Task> tasks = [
    SELECT Id, Subject, Description, CreatedDate, Who.Name
    FROM Task
    WHERE Subject LIKE '%Persona detectada%'
    AND WhoId = :pepeUser.ContactId
    ORDER BY CreatedDate DESC
    LIMIT 30
];
System.debug('TASKS FOUND FOR PEPE: ' + tasks.size());

for (Task t : tasks) {
    String clipUrl = null;
    if (t.Description != null) {
        Integer startIdx = t.Description.indexOf('[CLIP_URL]');
        Integer endIdx = t.Description.indexOf('[/CLIP_URL]');
        if (startIdx != -1 && endIdx != -1 && endIdx > startIdx) {
            clipUrl = t.Description.substring(startIdx + 10, endIdx).trim();
        }
    }
    System.debug('TASK: ' + t.Subject + ' | Date: ' + t.CreatedDate + ' | ClipUrl: ' + clipUrl);
}

// 3. Probar llamando directamente a getRecentAlerts (como admin)
List<SecurityClipController.AlertInfo> alerts = SecurityClipController.getRecentAlerts();
System.debug('ALERTS FROM CONTROLLER (as admin): ' + alerts.size());
for (SecurityClipController.AlertInfo a : alerts) {
    System.debug('ALERT: ' + a.subject + ' | clipUrl: ' + a.clipUrl);
}
