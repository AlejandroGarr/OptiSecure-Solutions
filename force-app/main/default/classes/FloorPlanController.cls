/**
 * @description Controlador Apex para la subida y obtención del plano
 *              personalizado de cada usuario / contacto.
 *              Cada cliente del portal puede subir su propio plano que
 *              sustituirá al static resource Plano_Casa_1.
 *
 *              El fichero se almacena como ContentVersion enlazada al
 *              ContactId del usuario (o a su UserId si es un usuario
 *              interno sin contacto, p.ej. admin).
 *
 * @author      OptiSecure Solutions
 * @date        2026-05-14
 */
public without sharing class FloorPlanController {

    // Prefijo del título usado para identificar planos subidos por nuestro
    // componente (no interferir con otros archivos del usuario)
    private static final String FLOOR_PLAN_TITLE_PREFIX = 'OptiSecureFloorPlan';

    // Tamaño máximo permitido (4 MB en bytes)
    private static final Integer MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;

    /**
     * @description Devuelve el Id de la entidad (Contact o User) a la que
     *              hay que enlazar el plano para el usuario actual.
     */
    private static Id getOwnerEntityId() {
        User u = [
            SELECT Id, ContactId
            FROM   User
            WHERE  Id = :UserInfo.getUserId()
            LIMIT  1
        ];
        return u.ContactId != null ? (Id) u.ContactId : (Id) u.Id;
    }

    /**
     * @description Guarda (o reemplaza) el plano del usuario actual.
     * @param       base64Data    Contenido del archivo en Base64.
     * @param       contentType   MIME type (image/png, image/jpeg, ...).
     * @param       fileName      Nombre original del archivo (informativo).
     * @return      ContentVersionId creado.
     * @throws      AuraHandledException si el archivo supera 4 MB o falla el DML.
     */
    @AuraEnabled
    public static Id saveFloorPlan(String base64Data, String contentType, String fileName) {
        try {
            if (String.isBlank(base64Data)) {
                throw new AuraHandledException('No se ha recibido ningún archivo.');
            }

            Blob fileBlob = EncodingUtil.base64Decode(base64Data);
            if (fileBlob.size() > MAX_FILE_SIZE_BYTES) {
                throw new AuraHandledException('El archivo supera el tamaño máximo permitido (4 MB).');
            }

            Id ownerEntityId = getOwnerEntityId();
            String safeContentType = String.isBlank(contentType) ? 'image/png' : contentType;
            String safeFileName    = String.isBlank(fileName)    ? 'plano.png' : fileName;

            // 1) Borrar planos anteriores enlazados a este usuario/contacto
            //    para no acumular versiones.
            List<ContentDocumentLink> oldLinks = [
                SELECT ContentDocumentId
                FROM   ContentDocumentLink
                WHERE  LinkedEntityId = :ownerEntityId
                AND    ContentDocument.Title LIKE :(FLOOR_PLAN_TITLE_PREFIX + '%')
            ];
            if (!oldLinks.isEmpty()) {
                Set<Id> docIds = new Set<Id>();
                for (ContentDocumentLink l : oldLinks) {
                    docIds.add(l.ContentDocumentId);
                }
                List<ContentDocument> oldDocs = [
                    SELECT Id FROM ContentDocument WHERE Id IN :docIds
                ];
                if (!oldDocs.isEmpty()) {
                    delete oldDocs;
                }
            }

            // 2) Crear ContentVersion con el nuevo plano
            ContentVersion cv = new ContentVersion();
            cv.Title         = FLOOR_PLAN_TITLE_PREFIX + '_' + ownerEntityId;
            cv.PathOnClient  = safeFileName;
            cv.VersionData   = fileBlob;
            cv.IsMajorVersion = true;
            insert cv;

            // 3) Recuperar el ContentDocumentId recién creado
            ContentVersion inserted = [
                SELECT Id, ContentDocumentId
                FROM   ContentVersion
                WHERE  Id = :cv.Id
                LIMIT  1
            ];

            // 4) Enlazar el documento al ContactId / UserId del usuario.
            //    Cuando el LinkedEntityId es un User, ShareType debe ser 'I'
            //    (Inferred). Para Contact / otros registros se usa 'V' (Viewer).
            ContentDocumentLink cdl = new ContentDocumentLink();
            cdl.ContentDocumentId = inserted.ContentDocumentId;
            cdl.LinkedEntityId    = ownerEntityId;
            cdl.ShareType         = isUserId(ownerEntityId) ? 'I' : 'V';
            cdl.Visibility        = 'AllUsers';
            insert cdl;

            return inserted.Id;
        } catch (AuraHandledException ahe) {
            throw ahe;
        } catch (Exception e) {
            throw new AuraHandledException('Error al guardar el plano: ' + e.getMessage());
        }
    }

    /**
     * @description Obtiene el plano del usuario actual como data-URI base64
     *              para usarlo directamente en un atributo src de imagen.
     * @return      Cadena "data:<mime>;base64,...." o null si no hay plano.
     */
    @AuraEnabled(cacheable=false)
    public static String getFloorPlanDataUri() {
        try {
            Id ownerEntityId = getOwnerEntityId();

            List<ContentDocumentLink> links = [
                SELECT ContentDocumentId
                FROM   ContentDocumentLink
                WHERE  LinkedEntityId = :ownerEntityId
                AND    ContentDocument.Title LIKE :(FLOOR_PLAN_TITLE_PREFIX + '%')
            ];
            if (links.isEmpty()) {
                return null;
            }

            Set<Id> docIds = new Set<Id>();
            for (ContentDocumentLink l : links) {
                docIds.add(l.ContentDocumentId);
            }

            List<ContentVersion> versions = [
                SELECT Id, VersionData, FileType, FileExtension
                FROM   ContentVersion
                WHERE  ContentDocumentId IN :docIds
                AND    IsLatest = TRUE
                ORDER BY CreatedDate DESC
                LIMIT  1
            ];
            if (versions.isEmpty()) {
                return null;
            }

            ContentVersion cv = versions[0];
            String mime = mapFileTypeToMime(cv.FileType, cv.FileExtension);
            String b64  = EncodingUtil.base64Encode(cv.VersionData);
            return 'data:' + mime + ';base64,' + b64;
        } catch (Exception e) {
            throw new AuraHandledException('Error al obtener el plano: ' + e.getMessage());
        }
    }

    /**
     * @description Elimina el plano personalizado del usuario actual
     *              (vuelve a usarse el plano por defecto).
     */
    @AuraEnabled
    public static Boolean deleteFloorPlan() {
        try {
            Id ownerEntityId = getOwnerEntityId();
            List<ContentDocumentLink> links = [
                SELECT ContentDocumentId
                FROM   ContentDocumentLink
                WHERE  LinkedEntityId = :ownerEntityId
                AND    ContentDocument.Title LIKE :(FLOOR_PLAN_TITLE_PREFIX + '%')
            ];
            if (links.isEmpty()) return false;

            Set<Id> docIds = new Set<Id>();
            for (ContentDocumentLink l : links) {
                docIds.add(l.ContentDocumentId);
            }
            List<ContentDocument> docs = [
                SELECT Id FROM ContentDocument WHERE Id IN :docIds
            ];
            if (!docs.isEmpty()) {
                delete docs;
            }
            return true;
        } catch (Exception e) {
            throw new AuraHandledException('Error al eliminar el plano: ' + e.getMessage());
        }
    }

    /**
     * @description Indica si el Id pertenece al objeto User (key prefix 005).
     */
    private static Boolean isUserId(Id recordId) {
        return recordId != null
            && recordId.getSObjectType() == User.SObjectType;
    }

    /**
     * @description Convierte el FileType/Extension de Salesforce a un
     *              MIME type válido para data-URIs de imagen.
     */
    private static String mapFileTypeToMime(String fileType, String extension) {
        String ext = String.isNotBlank(extension) ? extension.toLowerCase() : '';
        if (ext == 'png')                  return 'image/png';
        if (ext == 'jpg' || ext == 'jpeg') return 'image/jpeg';
        if (ext == 'gif')                  return 'image/gif';
        if (ext == 'webp')                 return 'image/webp';
        if (ext == 'bmp')                  return 'image/bmp';
        if (ext == 'svg')                  return 'image/svg+xml';

        String t = String.isNotBlank(fileType) ? fileType.toLowerCase() : '';
        if (t == 'png')                    return 'image/png';
        if (t == 'jpg' || t == 'jpeg')     return 'image/jpeg';
        if (t == 'gif')                    return 'image/gif';

        return 'image/png';
    }
}
