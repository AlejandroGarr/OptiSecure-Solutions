/**
 * @description       : 
 * @author            : ChangeMeIn@UserSettingsUnder.SFDoc
 * @group             : 
 * @last modified on  : 02-25-2026
 * @last modified by  : ChangeMeIn@UserSettingsUnder.SFDoc
**/
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
        Posicion_X__c = 23,
        Posicion_Y__c = 75,
        Activa__c     = true,
        Video_Url__c  = 'https://leena-menopausal-weepily.ngrok-free.dev/video_feed'
    ),
    new Camara__c(
        Name          = 'Jardín',
        Zone__c       = 'Jardín',
        Posicion_X__c = 5,
        Posicion_Y__c = 50,
        Activa__c     = true,
        Video_Url__c  = 'https://leena-menopausal-weepily.ngrok-free.dev/video_feed'
    ),
    new Camara__c(
        Name          = 'Cocina',
        Zone__c       = 'Cocina',
        Posicion_X__c = 51,
        Posicion_Y__c = 15,
        Activa__c     = true,
        Video_Url__c  = 'https://leena-menopausal-weepily.ngrok-free.dev/video_feed'
    ),
    new Camara__c(
        Name          = 'Entrada',
        Zone__c       = 'Entrada',
        Posicion_X__c = 90,
        Posicion_Y__c = 75,
        Activa__c     = true,
        Video_Url__c  = 'https://leena-menopausal-weepily.ngrok-free.dev/video_feed'
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
