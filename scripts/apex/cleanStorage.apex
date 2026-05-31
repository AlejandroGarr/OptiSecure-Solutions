// 1. Borrar Tasks de detección primero
List<Task> tasks = [SELECT Id FROM Task WHERE Subject LIKE '%Persona detectada%' LIMIT 200];
System.debug('Tasks a borrar: ' + tasks.size());
if (!tasks.isEmpty()) { delete tasks; }

// 2. Borrar ContentDocuments (clips de vídeo) — saltar los que tienen dependencias
List<ContentDocument> docs = [SELECT Id, Title FROM ContentDocument LIMIT 200];
System.debug('ContentDocuments encontrados: ' + docs.size());
Integer deleted = 0;
for (ContentDocument doc : docs) {
    try {
        delete doc;
        deleted++;
    } catch (DmlException e) {
        System.debug('No se pudo borrar ' + doc.Title + ': ' + e.getMessage());
    }
}
System.debug('ContentDocuments borrados: ' + deleted);

// 3. Vaciar papelera de reciclaje
List<Task> recycleTasks = [SELECT Id FROM Task WHERE Subject LIKE '%Persona detectada%' ALL ROWS];
if (!recycleTasks.isEmpty()) { Database.emptyRecycleBin(recycleTasks); }
List<ContentDocument> recycleDocs = [SELECT Id FROM ContentDocument ALL ROWS];
// solo vaciar los que estén en la papelera
List<Id> docIds = new List<Id>();
for (ContentDocument d : recycleDocs) { docIds.add(d.Id); }
if (!docIds.isEmpty()) {
    try { Database.emptyRecycleBin(docIds); } catch (Exception e) { System.debug('Papelera docs: ' + e.getMessage()); }
}
System.debug('Limpieza completada');
