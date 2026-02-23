// ═══════════════════════════════════════════════════════════
//  DATA SEEDING — Camara__c (Cámaras de Seguridad)
//  Ejecutar como Anonymous Apex en Developer Console
//  Idempotente: borra registros previos antes de insertar
// ═══════════════════════════════════════════════════════════

// 1. Limpieza previa — Elimina todos los registros existentes
List<Camara__c> existing = [SELECT Id FROM Camara__c];
if (!existing.isEmpty()) {
    delete existing;
    System.debug('Registros eliminados: ' + existing.size());
}

// 2. Creación de registros de prueba
List<Camara__c> cameras = new List<Camara__c>{
    new Camara__c(
        Name          = 'Salón',
        Zone__c       = 'Salón',
        Posicion_X__c = 30,
        Posicion_Y__c = 60,
        Activa__c     = true,
        Video_Url__c  = 'https://www.youtube.com/embed/ByED80IKdIU?autoplay=1&mute=1&controls=0&loop=1&playlist=ByED80IKdIU'
    ),
    new Camara__c(
        Name          = 'Jardín',
        Zone__c       = 'Jardín',
        Posicion_X__c = 10,
        Posicion_Y__c = 40,
        Activa__c     = true,
        Video_Url__c  = 'https://www.youtube.com/embed/wOFnJViMKqo?autoplay=1&mute=1&controls=0&loop=1&playlist=wOFnJViMKqo'
    ),
    new Camara__c(
        Name          = 'Cocina',
        Zone__c       = 'Cocina',
        Posicion_X__c = 50,
        Posicion_Y__c = 20,
        Activa__c     = true,
        Video_Url__c  = 'https://www.youtube.com/embed/AdUw5RdyZxI?autoplay=1&mute=1&controls=0&loop=1&playlist=AdUw5RdyZxI'
    ),
    new Camara__c(
        Name          = 'Entrada',
        Zone__c       = 'Entrada',
        Posicion_X__c = 80,
        Posicion_Y__c = 80,
        Activa__c     = true,
        Video_Url__c  = 'https://www.youtube.com/embed/WDin4yjkhKE?autoplay=1&mute=1&controls=0&loop=1&playlist=WDin4yjkhKE'
    )
};

// 3. Inserción en base de datos
insert cameras;

// 4. Feedback
System.debug('Cámaras creadas exitosamente: ' + cameras.size());
for (Camara__c cam : cameras) {
    System.debug('  ' + cam.Name + ' | Zona: ' + cam.Zone__c +
                 ' | Pos: (' + cam.Posicion_X__c + ', ' + cam.Posicion_Y__c + ')');
}
