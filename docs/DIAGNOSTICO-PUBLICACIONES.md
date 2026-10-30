# Diagnóstico de búsquedas de Mercado Libre (Import_app 0.5.2)

- **Cuenta conectada** indica que OAuth fue exitoso, no que cualquier búsqueda esté permitida.
- **Búsqueda por palabras** (`/sites/MLA/search`): si Mercado Libre devuelve HTTP 403, revisá el código del error y el estado/permisos de la aplicación con soporte de Mercado Libre.
- **Consulta de IDs** (`/items/bulk`): una respuesta general 200 puede incluir un `status_code` distinto por publicación. Esta versión muestra el detalle por cada ID rechazado, inactivo, sin precio o ausente de la respuesta.
- **0 publicaciones verificadas** no significa que no existan publicaciones ni que la API esté autorizada para todos los recursos.
- Para probar, copiá el ID **actual** de una publicación activa que puedas abrir en Mercado Libre; un ID viejo puede haber sido retirado.
- **Publicación y sincronización: Lectura** no garantiza habilitación para búsquedas generales de terceros.
- No pegues en chats ni logs las credenciales, tokens de OAuth ni las URL completas que contengan `code=`.

Fuentes oficiales:
- https://developers.mercadolibre.com.ar/es_ar/api-docs-es/items-y-busquedas
- https://developers.mercadolibre.com.ar/es_ar/preguntas-y-respuestas/error-403
