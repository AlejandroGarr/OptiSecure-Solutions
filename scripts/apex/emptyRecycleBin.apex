// Vaciar papelera de los registros borrados recientemente para liberar storage.
List<Id> toEmpty = new List<Id>();

// SOQL ALL ROWS para incluir los borrados
for (ContentDocument cd : [
    SELECT Id FROM ContentDocument WHERE IsDeleted = TRUE ALL ROWS
]) {
    toEmpty.add(cd.Id);
}
for (Solicitud_Camara__c s : [
    SELECT Id FROM Solicitud_Camara__c WHERE IsDeleted = TRUE ALL ROWS
]) {
    toEmpty.add(s.Id);
}

System.debug('IDs a vaciar de la papelera: ' + toEmpty.size());

if (!toEmpty.isEmpty()) {
    // emptyRecycleBin acepta hasta 200 IDs por llamada
    Integer batchSize = 200;
    for (Integer i = 0; i < toEmpty.size(); i += batchSize) {
        Integer endIdx = Math.min(i + batchSize, toEmpty.size());
        List<Id> chunk = new List<Id>();
        for (Integer j = i; j < endIdx; j++) {
            chunk.add(toEmpty[j]);
        }
        Database.emptyRecycleBin(chunk);
        System.debug('Papelera vaciada chunk ' + chunk.size());
    }
}

System.debug('Papelera vaciada correctamente.');
