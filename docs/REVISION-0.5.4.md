# Revisión 0.5.4 — precios con procedencia y accesos autorizados

## Evidencia y límites

Revisión del 30/10/2026. Base: repositorio `GuiCon5k/import_app`, commit `c1551fc`, versión 0.5.3. Se revisaron servidor/rutas, OAuth, almacenamiento cifrado, investigación, UI, cálculo y documentación/pruebas. No se descargaron secretos de Render/Upstash.

El diagnóstico aportado por el propietario muestra `/users/me`, listado propio y aplicación con HTTP 200; búsqueda general, bulk e ítem individual de referencia con 403. No se reprodujeron esas llamadas autenticadas durante esta revisión: no se extrajeron tokens. Tampoco se confirmó la titularidad ni vigencia del ítem de referencia.

Render confirma servicio `import-app-guicon`, Node, región Oregon, plan free, una instancia, repo correcto y despliegue automático desde `main`, sin previews. Los logs de arranque muestran 0.5.3 y `API de pago: BLOQUEADA`. Esto prueba el estado al arrancar, no todos los permisos actuales de ML. La aplicación anterior no registra un historial detallado de llamadas a ML; no inferir respuestas de ML a partir de logs de arranque. No se modificó configuración ni se desplegó esta revisión.

## Código frente a política

OAuth exitoso prueba identidad, no autorización universal. El código ya utiliza Bearer y el endpoint bulk actual; cambiar credenciales, volver a endpoints antiguos, probar sin token o scrapear no soluciona lícitamente una restricción de acceso.

La documentación oficial [Error 403](https://developers.mercadolibre.com.ar/es_ar/preguntas-y-respuestas/error-403) describe causas posibles: permisos, aplicación, IP, validaciones y titularidad de la información respecto del token. `access_denied` no identifica por sí solo cuál se aplica. El patrón reportado es compatible con acceso limitado a datos autorizados; la causa concreta debe confirmarla Mercado Libre.

[Permisos funcionales](https://developers.mercadolibre.com.ar/permisos-funcionales) vincula Publicación y sincronización con items/prices y muestra PolicyAgent para permisos faltantes. No demuestra autorización para obtener precios de cualquier vendedor. No ampliar escritura solo para intentar conseguir lectura general.

[Ítems y búsquedas](https://developers.mercadolibre.com.ar/es_ar/api-docs-es/items-y-busquedas) documenta migración a `/items/bulk?ids=`, máximo de 20 ítems y `status_code` por elemento. El código 0.5.3 ya estaba migrado. No se cambió a endpoints deprecados. Las páginas directas devolvieron 403 al lector web; se pudo consultar su contenido indexado oficial, sin sortear el bloqueo. Esto no equivale a inspeccionar la configuración privada de Developers.

## Modificaciones explicadas

- `price-import.js`: valida referencias manuales/JSON por lista explícita de campos, fuente, URL HTTPS sin credenciales/parámetros, evidencia, precio ARS y fecha UTC. Nunca visita URLs. Ignora etiquetas de verificación aportadas en el archivo.
- `server.js`: POST protegido `/api/prices/import`, con los controles de autenticación/origen y límite de cuerpo existentes. No persiste datos ni consulta servicios externos.
- `ml-ui.js` e `index.html`: formulario, importación/exportación JSON y fichas con atribución. Los datos quedan en memoria de la pantalla; descargar para conservarlos. Separados de precios oficiales y cálculos de rentabilidad.
- `mercadolibre.js`: acepta URL de publicación y extrae un ID para la API, rechaza fichas de catálogo y dominios engañosos. Conserva el 403 sin reintentos alternativos. Limita rutas oficiales y bloquea redirecciones; el Bearer no se envía a URLs ingresadas. Diagnósticos: una tanda por minuto por instancia aunque cambie el ID. Mensajes sin atribuir el 403 a un permiso específico.
- `diagnostics.js`: informa presencia de OAuth/almacenamiento sin revelar valores ni afirmar conexión remota. Versiones visibles actualizadas a 0.5.4.
- Tests y CI: pruebas HTTP, importación y seguridad, más matriz Node 20/22 en GitHub sin secretos. La ejecución local usa Node 22; la matriz remota requiere PR/push para confirmarse.

## Importación y fuentes alternativas

Usar observaciones manuales permitidas, cotizaciones de fabricantes/mayoristas o archivos suministrados con autorización. Cada registro exige URL y atribución, evidencia de variante/pack/condiciones y fecha de observación. Una fuente enlazada es revisable por el usuario, no prueba de que el servidor haya comprobado su contenido. No se automatizan descargas de proveedores ni Mercado Libre.

Ejemplo **ficticio** de archivo compatible:

```json
{"records":[{"title":"EJEMPLO: perchas x10","url":"https://proveedor.example/producto","sourceName":"Proveedor ficticio","priceArs":12000,"observedAt":"2026-01-01T12:00:00Z","evidence":"Ejemplo, no es una cotización real"}]}
```

API: enviar ese JSON a `/api/prices/import` mediante POST. Se valida todo antes de devolver referencias; un registro inválido rechaza el lote. La respuesta/exportación vuelve a importarse. Máximo 100 referencias, cuerpo HTTP de 60 KB; precios en ARS. No admite CSV en esta versión. La URL no lleva parámetros ni fragmentos para reducir riesgo de guardar enlaces firmados o tokens; conservar el enlace público canónico.

## Revisión antes de producción

Los tests simulan ML/Upstash; no prueban habilitación real a terceros. La UI se prueba con referencias ficticias y pagos bloqueados. No hay cotizaciones reales obtenidas ni ventas/demanda confirmadas. Si el propietario necesita acceso API de terceros, presentar el diagnóstico seguro a soporte y solicitar alcance autorizado; no se envió ningún ticket.

La rama debe revisarse mediante PR. Fusionar a `main` dispara Render automáticamente; requiere aprobación del propietario. Ofertas/historial anteriores siguen en disco efímero; esta revisión no migra almacenamiento ni modifica credenciales.
