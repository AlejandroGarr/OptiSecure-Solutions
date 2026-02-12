// ═══════════════════════════════════════════════════════════
//  DATA SEEDING — Camera__c (Cámaras de Seguridad)
//  Ejecutar como Anonymous Apex en Developer Console
//  Idempotente: borra registros previos antes de insertar
// ═══════════════════════════════════════════════════════════

// 1. Limpieza previa — Elimina todos los registros existentes
List<Camara__c> existing = [SELECT Id FROM Camara__c];
if (!existing.isEmpty()) {
    delete existing;
    System.debug('🗑️  Registros eliminados: ' + existing.size());
}

// 2. Creación de registros de prueba
List<Camara__c> cameras = new List<Camara__c>{
    new Camara__c(
        Name         = 'Cámara Salón Principal',
        Zone__c      = 'Salón',
        Posicion_X__c = 25.00,
        Posicion_Y__c = 60.00,
        Video_Url__c = 'https://www.youtube.com/embed/1-iS7LArMPA?autoplay=1&mute=1&controls=0&loop=1&playlist=1-iS7LArMPA',
        Activa__c    = true
    ),
    new Camara__c(
        Name         = 'Cámara Jardín / Entrada',
        Zone__c      = 'Jardín',
        Posicion_X__c = 10.00,
        Posicion_Y__c = 40.00,
        Video_Url__c = 'https://www.youtube.com/embed/2g811Eo7K8U?autoplay=1&mute=1&controls=0&loop=1&playlist=2g811Eo7K8U',
        Activa__c    = true
    ),
    new Camara__c(
        Name         = 'Cámara Cocina',
        Zone__c      = 'Cocina',
        Posicion_X__c = 45.00,
        Posicion_Y__c = 20.00,
        Video_Url__c = 'https://www.youtube.com/embed/tFhN0j0y5z0?autoplay=1&mute=1&controls=0&loop=1&playlist=tFhN0j0y5z0',
        Activa__c    = true
    ),
    new Camara__c(
        Name         = 'Cámara Dormitorio',
        Zone__c      = 'Dormitorio',
        Posicion_X__c = 75.00,
        Posicion_Y__c = 25.00,
        Video_Url__c = 'https://www.youtube.com/embed/5qap5aO4i9A?autoplay=1&mute=1&controls=0&loop=1&playlist=5qap5aO4i9A',
        Activa__c    = true
    )
};

// 3. Inserción en base de datos
insert cameras;

// 4. Feedback
System.debug('✅ Cámaras creadas exitosamente: ' + cameras.size());
for (Camara__c cam : cameras) {
    System.debug('   📷 ' + cam.Name + ' | Zona: ' + cam.Zone__c +
                 ' | Pos: (' + cam.Posicion_X__c + ', ' + cam.Posicion_Y__c + ')');
}
