// Limpieza segura: borra clips de deteccion antiguos y solicitudes
// de camaras de pruebas. NO toca Account/Contact/Camara__c/Cuenta__c.

// 1) Videos "Deteccion persona - clip_*" (los webm de pruebas)
List<ContentDocument> oldClips = [
    SELECT Id, Title, ContentSize
    FROM ContentDocument
    WHERE Title LIKE 'Deteccion persona - clip%'
];
System.debug('Clips a eliminar: ' + oldClips.size());
Long bytes = 0;
for (ContentDocument cd : oldClips) {
    bytes += (Long) cd.ContentSize;
}
System.debug('Bytes a liberar (clips): ' + bytes);

if (!oldClips.isEmpty()) {
    delete oldClips;
}

// 2) Solicitudes de camara (formulario de contratacion, datos no esenciales)
List<Solicitud_Camara__c> sols = [SELECT Id FROM Solicitud_Camara__c];
System.debug('Solicitudes a eliminar: ' + sols.size());
if (!sols.isEmpty()) {
    delete sols;
}

System.debug('Limpieza completada correctamente.');
