# Error 403 en búsquedas Mercado Libre

**Conectado no equivale a autorizado para todos los endpoints.** OAuth puede funcionar y `/sites/MLA/search?q=...` devolver 403.

## Cómo diagnosticar

1. En el panel, buscar una palabra, por ejemplo `perchas`. Si aparece 403, la versión 0.5.1 muestra el endpoint afectado y, si Mercado Libre lo proporciona, su código de bloqueo (por ejemplo `PA_UNAUTHORIZED_RESULT_FROM_POLICIES`). **No muestra tokens ni secretos**.
2. Probar un ID de publicación real: por ejemplo `MLA1418175105` (reemplazar si ya no existe). Esa consulta utiliza `/items/bulk?ids=...`.
3. Si la consulta por ID funciona y por palabra no, la restricción está en el endpoint de búsqueda por palabras. No es un problema de inicio de sesión.
4. Si ambas fallan con 403, revisar en Mercado Libre Developers → aplicación Import_app → Permisos funcionales que `Publicación y sincronización` tenga permiso de `Solo lectura` y que la aplicación esté activa y sin restricciones de IP. La disponibilidad de búsquedas generales no se garantiza por habilitar un permiso.
5. Después de modificar los permisos, volver a Import_app → Mercado Libre → **Volver a autorizar Mercado Libre**. No regenerar el Client Secret.
6. Si sigue fallando, conservar el código HTTP, el endpoint y el código devuelto por Mercado Libre (no los tokens) para abrir un caso de soporte.

La versión 0.5.1 **no elude restricciones de Mercado Libre**. Si la búsqueda por texto no está habilitada para esa aplicación, solo la plataforma puede autorizarla. El enlace de búsqueda manual al sitio no equivale a datos verificados por API.

Referencias oficiales:
- https://developers.mercadolibre.com.ar/permisos-funcionales
- https://developers.mercadolibre.com.ar/es_ar/preguntas-y-respuestas/error-403
- https://developers.mercadolibre.com.ar/es_ar/api-docs-es/items-y-busquedas
