# Import_app 0.5.3 — Diagnóstico de acceso a la API de Mercado Libre

## Contexto

La autorización OAuth **no implica** que Mercado Libre permita a la aplicación leer
publicaciones de cualquier vendedor. El bloqueo HTTP 403 es una respuesta del
proveedor y no puede eliminarse modificando el mensaje o el token manualmente.

La documentación oficial de Mercado Libre (última actualización septiembre 2026)
indica que `/items/bulk?ids=` sustituye a `/items?ids=` a partir de octubre de 2026.
También documenta rechazos por permisos, restricciones de cuenta, validaciones,
estado de la aplicación o IPs habilitadas.

## Probar en Render, sin compartir secretos

1. Publicar los cambios de esta versión mediante `git push` y esperar que Render
   indique **Live** con `0.5.3` en el estado de la aplicación.
2. Entrar a Import_app con usuario y contraseña.
3. Abrir la sección **Mercado Libre** y pulsar **Diagnosticar acceso API (gratis)**.
4. Se probarán solamente solicitudes GET:
   - `GET /users/me` — identidad del token OAuth.
   - `GET /users/{id}/items/search?limit=1` — publicaciones de tu propia cuenta.
   - `GET /items/bulk?ids=...` — lectura de publicación propia, si existe alguna.
   - `GET /applications/{appId}` — estado de la app, cuando el ID es numérico.
   - `GET /sites/MLA/search?q=perchas&limit=1` — búsqueda de terceros.
   - `GET /items/bulk?ids=...` — ID de publicación de referencia.
   - `GET /items/{id}` — lectura individual de referencia.
5. Pulsar **Copiar diagnóstico**. El reporte contiene rutas, HTTP status y códigos
   de error controlados. **No incluye access tokens, refresh tokens ni Client Secret**.
6. Comparar qué rutas dan HTTP 200 vs HTTP 403.

Las pruebas a Mercado Libre no usan créditos de OpenAI; las pruebas son una tanda
por minuto por ID en esta instancia para limitar llamadas. Nunca pegues el token
ni el Client Secret en una consulta de soporte.

### Qué significa cada resultado

- `/users/me` da 200, pero las consultas de catálogo dan 403: token válido, acceso
  al catálogo restringido. Requiere revisar la habilitación y el código interno
  del error con Mercado Libre.
- `/users/me` da 401 o 403: investigar cuenta, token, autorización y validaciones.
- Publicaciones propias dan 200, las de terceros 403: acceso probablemente limitado
  a datos de la cuenta autorizada.
- `/applications/{id}` devuelve `active: false`: revisar estado en Developers.
- `/sites/MLA/search` da 200 pero `/items/bulk` da 403: la búsqueda podría
  mostrar precios directamente desde su respuesta **sin doble verificación**.
- Todos los recursos dan 403: consultar permisos, validación de cuenta, estado de
  aplicación y soporte oficial, sin probar evasiones de restricciones.

## Limitaciones del diagnóstico

La copia del código proporcionada para esta actualización deriva de Import_app
0.5.2, no de una sincronización autenticada con el repositorio GitHub privado.
Las llamadas de prueba son simuladas localmente; solamente **Render**, con tu
OAuth real, puede mostrar la respuesta real de Mercado Libre. Esta actualización
no garantiza eliminar el 403 y no modifica los permisos de tu aplicación.

Fuentes oficiales:
- https://developers.mercadolibre.com.ar/es_ar/api-docs-es/items-y-busquedas
- https://developers.mercadolibre.com.ar/es_ar/preguntas-y-respuestas/error-403
- https://developers.mercadolibre.com.ar/es_ar/preguntas-y-respuestas/permisos-funcionales
- https://developers.mercadolibre.com.ar/es_ar/gestiona-tus-aplicaciones
