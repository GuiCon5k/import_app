# 0.5.5 — búsqueda ML, recuperación y calculadora China

## Evidencia de producción (03/11/2026)

Render: `import-app-guicon`, deploy `dep-dbi0rhp5efls739845bg`, commit `a155efe8efc059cd0918b5c4df0a0674cf550e4a`, estado live. Plan free, una instancia y auto-deploy desde main. No se modificó el servicio.

En la interfaz 0.5.4 se probó una búsqueda real de `perchas`: `/sites/MLA/search` respondió HTTP 403, código `forbidden`. El diagnóstico real confirmó identidad, listado propio y aplicación activa con 200; búsqueda general y publicación de referencia con 403 (`access_denied` en la individual). El ID de referencia de la versión anterior no demuestra titularidad de terceros ni vigencia. No se extrajeron tokens ni se consumió OpenAI. El código nuevo no concede permisos de ML.

## Cambios

- Búsqueda con alcance explícito: mercado general o publicaciones de la cuenta identificada por `/users/me`. No se transforma una búsqueda general denegada en resultados propios silenciosamente.
- Diagnóstico con ID/URL opcional, sin publicación fija. Capacidades por recurso, con estado no comprobado cuando falta referencia. Sigue limitado a una tanda por minuto por instancia.
- Investigación usa el mismo parser bulk y bloqueo de redirecciones que el buscador; conserva los rechazos por ítem.
- Referencias importadas se guardan en servidor, se recuperan al recargar y se deduplican por sus campos de evidencia. Máximo 100. No adquieren verificación API.
- Almacenamiento JSON para una sola instancia: escritura temporal con fsync y rename, copia anterior `.bak`, error explícito ante corrupción. El disco durable debe montarse externamente; un directorio o variable por sí solos no garantizan durabilidad.
- Cupo diario separado del historial visible; cuenta también tareas interrumpidas. Investigaciones pagas en producción requieren declaración de disco durable. El programador sigue dentro del proceso, no es una cola durable.
- Exportación de respaldo autenticada, sin tokens. Restauración offline solo a un directorio nuevo. No reemplaza datos existentes.
- `/api/status` informa versión, commit de Render y estado declarado del almacenamiento. `scripts/smoke.js` verifica rutas mediante GET sin llamar ML/OpenAI.
- Calculadora China con múltiples productos/bultos, batería, NCM sugerido, FOB, tarifas y alícuotas manuales. Compara flete aéreo por mayor peso real/volumétrico y marítimo por volumen, con mínimos. Total separa mercadería e importación; desglose por unidad y exportación JSON.

## Calculadora: alcance

No copia las tarifas de Argencargo ni consulta su cuenta. Las capturas son referencia de flujo. La página pública del portal solo permitió leer «Cargando».

Modelo de escenario: seguro porcentual sobre FOB; CIF = FOB + flete + seguro; derechos y tasa sobre CIF; IVA sobre CIF + derechos + tasa. El usuario aporta alícuotas, tope de tasa por producto, otros tributos/percepciones y gastos de destino. No se infieren tarifas, clasificación NCM, excepciones, antidumping, regímenes courier ni créditos fiscales. El prorrateo entre productos es por FOB. Un servicio marítimo all-in no debe ingresarse como flete porque duplicaría los tributos.

Fuentes de contraste: [ARCA, algoritmos de bases imponibles](https://biblioteca.arca.gob.ar/search/query/norma.aspx?p=t%3ARAG%7Cn%3A743%7Co%3A3%7Ca%3A1999%7Cf%3A09%2F12%2F1999), [ARCA, tasa estadística](https://biblioteca.arca.gob.ar/dcp/DEC_C_001140_2024_12_30), [ML, ítems y búsquedas](https://developers.mercadolibre.com.ar/es_ar/guia-para-carrito-de-compras/items-y-busquedas). Las tasas se dejan vacías deliberadamente; estos enlaces no constituyen una liquidación aduanera para un producto.

## Validación y siguiente paso

Pruebas locales sin servicios reales: modos de búsqueda, ausencia de ID inventado, rechazos, autenticación, persistencia de referencias, recuperación con otro proceso, restauración, cuota tras interrupción y cálculo/prorrateo. La prueba de producción corresponde a 0.5.4, no a los cambios de esta rama.

Antes de fusionar: descargar los datos actuales, decidir/activar almacenamiento durable y validar la restauración. Un merge dispara Render. Después de desplegar: ejecutar smoke con credenciales locales seguras, comprobar versión/commit y recuperar un registro tras redeploy autorizado. Confirmar acceso de búsqueda general con ML/Developers; no atribuir el 403 a un permiso concreto ni ampliar escritura para intentar conseguir lectura.
