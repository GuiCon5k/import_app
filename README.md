# Import_app 0.5.4 — referencias con fuente y consultas autorizadas

Importación manual/JSON de precios con URL, atribución, fecha y evidencia, exportables sin OAuth ni gasto de OpenAI. Se etiquetan como aportados, sin verificar por API. El buscador acepta URLs de publicaciones; un 403 sigue siendo un rechazo de acceso. No se utiliza scraping ni evasión.

**Revisión, diagnóstico, formato de importación y límites:** [docs/REVISION-0.5.4.md](docs/REVISION-0.5.4.md). Pruebas: `npm test`. Las secciones siguientes conservan notas históricas de versiones anteriores; para Render OAuth consultar la guía actual enlazada abajo.

**Novedad:** sección Mercado Libre con conexión OAuth segura, consultas oficiales por nombre/ID MLA, tokens cifrados en Upstash y renovación automática. Mantiene el bloqueo de gastos de OpenAI por defecto.

**Instrucciones paso a paso:** [docs/MERCADOLIBRE-RENDER.md](docs/MERCADOLIBRE-RENDER.md).

> No publicar `.env`, credenciales de Mercado Libre, tokens de Upstash ni la clave de cifrado en GitHub. El almacenamiento de ofertas e investigaciones sigue siendo temporal en Render Free; solo los tokens OAuth persisten en Upstash.

---

> **Publicación online (Render):** consultar primero [RENDER-INSTRUCCIONES.md](./RENDER-INSTRUCCIONES.md). La autenticación web y las limitaciones de almacenamiento están explicadas allí.

# GUICON AI 0.4 — MARKETPLACES, FABRICANTES Y CONTACTOS

**NOVEDAD:** el agente busca publicaciones de Mercado Libre con ID individual, fichas de fabricantes y mayoristas argentinos y referencias de 1688/Made-in-China. En cada ficha de proveedor muestra **Ver ficha / contactar**; correos o teléfonos encontrados se señalan como no verificados. Los precios de Mercado Libre solamente se etiquetan como confirmados si se dispone de un **token OAuth propio de Mercado Libre** y la consulta oficial `/items/bulk` devuelve el dato. La API de OpenAI por sí sola no confirma precios ni acceso a 1688. Las fuentes no verificadas permanecen como referencias web.

**No se gastaron tus créditos en el desarrollo ni las pruebas:** por defecto `PAID_API_ENABLED=false` y `AUTO_RESEARCH_ENABLED=false`. Hay **18 pruebas automatizadas** que usan datos simulados. La conexión web real de tu clave OpenAI y la conexión real a Mercado Libre todavía **no están probadas**.

**Guía detallada:** `docs/FUENTES-Y-CONTACTOS.md`. Empezá con `npm.cmd test` y `npm.cmd run dev` desde la carpeta `guicon-ai` en PowerShell; abrí `http://localhost:3000/#investigador`. **No compartas `.env`.**

---

# GUICON AI 0.3.2 — MODO SEGURO Y DIAGNÓSTICO VISIBLE

Esta actualización corrige el botón que parecía no responder. Al presionarlo, ahora aparece una comprobación numerada y con horario. También incorpora **«Probar demo sin créditos»**. La demo usa datos ficticios generados localmente: **no investiga en Internet, no carga productos reales y no llama a OpenAI**.

## Antes de usar créditos de API

1. Cerrá el servidor viejo con `Ctrl+C`. Si hay más de una terminal con Guicon, cerralas todas.
2. Descomprimí **guicon-ai-v0.3.2-modo-seguro.zip** en una carpeta **nueva** y abrí la subcarpeta `guicon-ai` con VS Code.
3. Ejecutá `node --version` (Node 20 o superior). Iniciá con `npm.cmd run dev` en PowerShell, o `npm run dev` en otras terminales.
4. Comprobá que la terminal diga **GUICON AI 0.3.2** y **API de pago: BLOQUEADA**.
5. Entrá a **http://localhost:3000/#investigador** (no abras `index.html` con doble clic).
6. Presioná **«Verificar configuración (gratis)»**. Tiene que aparecer `Comprobación gratuita N.º 1`, la versión y el bloqueo de pagos. Si repetís, dirá `N.º 2`.
7. Presioná **«Probar demo sin créditos»**. Deberían mostrarse dos **ejemplos ficticios**. Los consumos de tokens y búsqueda indican cero.
8. Para corroborar el backend, ejecutá `npm.cmd test` y `npm.cmd run doctor`. **Ninguna prueba del paquete usa tu clave ni llama realmente a OpenAI.**

### Si ya tenés créditos y una clave API

Los créditos **no se gastan** al instalar, verificar ni usar la demo. Incluso si `OPENAI_API_KEY` está en `.env`, la app NO realizará llamadas pagas mientras `PAID_API_ENABLED=false` (valor predeterminado en `.env.example`). Tampoco hay programación semanal activada por defecto.

**Solo cuando vos decidas probar la API real:** guardá tu clave privada en `.env` y cambiá `PAID_API_ENABLED=true`. Reiniciá el servidor y usá «Investigar automáticamente». Se pedirá confirmación adicional antes de enviar la solicitud. Esta investigación **puede generar cargos** por tokens y búsqueda. Una demo local no demuestra que una clave, saldo, modelo o conexión real funcionen: esa parte necesita una prueba real aprobada por vos.

Los mensajes «clave detectada» solo significan que existe una cadena con aspecto de clave, **no que la autenticación o el saldo fueron validados online**.

**Si el botón sigue sin responder:** revisá que el navegador muestre v0.3.2, actualizá con `Ctrl+F5`, comprobá `http://localhost:3000/api/research/diagnostics` y copiá el error visible (nunca la clave). Si muestra otra versión, hay un servidor viejo usando el puerto 3000.

## Lenguajes y archivos importantes

- `public/research-ui.js` — JavaScript del navegador: botones, estado y visualización.
- `src/server.js` — JavaScript + Node.js: rutas locales de diagnóstico, demo y operaciones.
- `src/diagnostics.js` — JavaScript + Node.js: verificación de `.env` sin enviar credenciales.
- `src/research.js` — JavaScript + OpenAI Responses API: descubrimiento REAL, solo si autorizaste pago.
- `public/app.js` — JavaScript del navegador: comparador financiero y publicidad.

Para cambiar el presupuesto, mirá `src/finance.js` y `src/research.js`. La publicidad se descuenta en `src/finance.js`. Se comentan solamente las funciones críticas.

---

# GUICON AI 0.3.1 — Corrección del investigador automático

Proyecto local para comparar **fabricantes argentinos, mayoristas argentinos e importación desde China**, teniendo en cuenta el capital disponible de **ARS 3.000.000**, publicidad y rentabilidad estimada.


## IMPORTANTE: si «Investigar automáticamente» no funcionó

**La investigación real requiere una clave OpenAI API con saldo o facturación habilitada. Tu suscripción ChatGPT Plus no incluye uso de la API.** Una clave API nunca debe pegarse en el chat ni en el navegador de Guicon AI.

1. Abrí la carpeta `guicon-ai` de esta versión y **copiá** `.env.example` como `.env` (nombre exacto, no `.env.txt`).
2. En `.env`, reemplazá el campo vacío con `OPENAI_API_KEY=tu_clave_API_real` y dejá `RESEARCH_MODEL=gpt-5-mini`. La clave se crea en `https://platform.openai.com/api-keys`; comprobá que la API tenga crédito o facturación habilitada.
3. Guardá el archivo. Cerrá el servidor con **Ctrl+C** y ejecutá `npm run dev`. En Windows, si PowerShell bloquea npm, usá `npm.cmd run dev` o `node src/server.js`.
4. Entrá a `http://localhost:3000/#investigador`. Tocá **Verificar configuración (gratis)**. Esta comprobación **no cobra** y **no valida la API de forma remota**.
5. Cuando indique que hay clave, tocá **Investigar automáticamente**. Esta llamada **sí puede consumir crédito**. Si falla, el motivo se mostrará en el historial de investigaciones.

**Errores habituales**

| Mensaje | Qué hacer |
|---|---|
| Falta `OPENAI_API_KEY` | Creá `.env` dentro de `guicon-ai` y reiniciá la app. |
| Clave inválida (401) | Generá/revisá la clave en OpenAI Platform; no compartas la clave. |
| Sin saldo o límite de facturación (429) | Revisá facturación y créditos de la API, separados de ChatGPT Plus. |
| Modelo no disponible (400) | Probá `RESEARCH_MODEL=gpt-5-mini`; necesitás acceso al modelo. |
| Investigación sin resultados / JSON incompleto | Acotá el foco de búsqueda; el agente no inventa productos. |

También podés ejecutar `npm run doctor` en terminal para hacer un diagnóstico local gratuito.

**Actualización sin perder tus datos:** si venís de v0.2 o v0.3, copiá las carpetas `data/` y el archivo privado `.env` desde la versión anterior a esta, con el servidor cerrado. No copies el `.env.example` encima de tu `.env`.

**Qué está probado:** pruebas automatizadas, endpoints y diagnóstico local. **Qué sigue sin validar:** la ejecución de búsqueda real con tus credenciales, ya que no tengo acceso a ellas.

## Agente investigador automático (versión 0.3.1)

**Ahora no hace falta cargar nombres de productos para descubrir oportunidades.** La pestaña «Agente automático» ofrece un botón de investigación que usa **OpenAI Responses API + web_search** para investigar productos comercializables en Argentina y referencias de fuentes argentinas y chinas.

**Limitaciones importantes:**
- El agente descubre **candidatos con URLs**, pero **no obtiene cotizaciones comerciales confirmadas ni certifica demanda**. Por eso **NO calcula márgenes inventados**. Cuando un proveedor exige login o no publica precios, lo deja pendiente.
- Para realizar búsquedas hay que tener una clave **OPENAI_API_KEY** con crédito API. Las búsquedas web y los tokens **generan costos adicionales**.
- La investigación por Internet no se pudo probar en vivo con tu cuenta sin clave de API. Se hicieron pruebas automatizadas con respuestas simuladas y se verificaron las rutas locales.
- La programación automática solo funciona **mientras Node.js está encendido**. No es una tarea de ChatGPT que siga funcionando con la PC apagada.
- La publicidad **se incluye en los criterios de investigación**; el calculador existente la descuenta en ARS cuando ya tenemos costos válidos.

### Habilitar el agente

1. Duplicá `.env.example` como `.env` (Windows: asegurate de que no termine como `.env.txt`).
2. Copiá tu clave API en `OPENAI_API_KEY=...`, sin compartirla.
3. Mantené el modelo `RESEARCH_MODEL=gpt-5-mini` (o elegí otro con soporte de búsqueda web habilitado en tu cuenta).
4. En `.env`, activá `AUTO_RESEARCH_ENABLED=true` para una búsqueda automática semanal. Si preferís usarlo solo cuando presionás el botón, dejá `false`.
5. Ajustá `MAX_RESEARCH_RUNS_PER_DAY=2` y `RESEARCH_INTERVAL_DAYS=7`.
6. Ejecutá `npm run dev` y entrá a **http://localhost:3000/#investigador**.
7. Pulsá «Investigar automáticamente» o dejá que el programador investigue semanalmente (con servidor encendido).

El historial está en `data/research.json` y las evaluaciones confirmadas en `data/products.json`.

**Privacidad y seguridad:** clave solo del lado servidor; el proyecto escucha en `127.0.0.1`. No está listo para exponerse públicamente ni para usar con múltiples usuarios. Revisá siempre las fuentes web, NCM, tributos, permisos, precios y proveedor antes de comprar.

## 1. Arrancar en Windows (o macOS/Linux)

1. Instalar **Node.js 20 o superior** si todavía no está instalado.
2. Descomprimir el ZIP y abrir la carpeta `guicon-ai` en VS Code.
3. Abrir **Terminal > Nueva terminal** dentro de la carpeta.
4. Ejecutar:

```bash
npm run dev
```

5. Abrir **http://localhost:3000** en el navegador.

> No requiere `npm install` para la versión 0.3: utiliza únicamente los módulos que ya vienen con Node.js. Para cerrar la aplicación, presionar **Ctrl+C** en la terminal.

## 2. Qué se puede hacer ya

- Guardar evaluaciones de productos por proveedor, desde China o Argentina.
- Comparar varias cotizaciones del mismo producto (escribir exactamente el mismo nombre).
- Elegir moneda ARS o USD y cargar tipo de cambio manual.
- Calcular compra, flete, tributos, gastos fijos prorrateados, packaging y logística local.
- Estimar publicidad **variable** (porcentaje del precio y/o importe por venta) y **fija** (campaña de lanzamiento).
- Calcular utilidad por unidad, margen, capital comprometido y reserva publicitaria.
- Comparar MOQ, plazos de entrega y nivel de evidencia (estimado, cotizado o verificado).
- Editar y eliminar evaluaciones, exportar a CSV, filtrar y ordenar.
- Preservar datos antiguos `data/products.json` de la versión 0.1 mediante migración de lectura.
- Solicitar explicación adicional mediante API de OpenAI, **solo si configurás tu propia clave**.
- Ejecutar pruebas automáticas con `npm test`.

Los datos quedan en `data/products.json`, dentro de la carpeta que ejecutás. **Hacé una copia de ese archivo antes de reemplazar la versión del proyecto.** Los datos NO se sincronizan a la nube.

## 3. Importante: interpretaciones financieras

- `Costo puesto / unidad` = compra + flete + tributos + logística + packaging + otros + gastos fijos de abastecimiento prorrateados.
- `Publicidad variable / unidad` = % del precio de venta + monto fijo por venta.
- `Contribución unitaria` = precio de venta − costo puesto − comisión de venta − publicidad variable.
- `Ganancia total a sellout` = contribución unitaria × cantidad − campaña publicitaria fija de lanzamiento.
- `Margen` = ganancia total a sellout ÷ (precio × cantidad). Solo describe un **escenario en el que se vende el 100% del stock**.
- `Capital inicial estimado` = costo puesto × cantidad + publicidad de lanzamiento.
- `Capital comprometido` = capital inicial estimado + reserva de publicidad variable × cantidad. Se compara con los ARS 3 millones de forma conservadora.

**Atención:** La publicidad de lanzamiento es distinta de la publicidad por venta. Si el mismo gasto está en ambos campos, lo estarías contando dos veces. La calculadora tampoco valida si el producto se venderá, ni incluye automáticamente devoluciones, costo financiero, percepciones recuperables, impuestos sobre los resultados, IIBB, almacenamiento o posibles costos aduaneros omitidos.

Los valores precargados son ficticios y el tipo de cambio `1500` es solo un **ejemplo editable**, NO un valor vigente. No utilices resultados sin verificar NCM, régimen aplicable, factura, tributos efectivos y tratamiento del IVA. Para comparar alternativas es conveniente utilizar igual cantidad y precio de venta; el sistema **no obliga** a hacerlo.

## 4. Activar IA (opcional; puede generar cargos)

1. Duplicar `.env.example` y renombrar la copia `.env`.
2. Completar dentro de `.env`:

```text
OPENAI_API_KEY=tu_clave_privada
OPENAI_MODEL=gpt-5-mini
MAX_AI_REQUESTS_PER_DAY=5
PORT=3000
```

3. Reiniciar el servidor (`Ctrl+C` y `npm run dev`).
4. En el ranking, pulsar el botón **IA** de una evaluación guardada.

El análisis se envía desde el backend a la **API Responses** de OpenAI. No lo hace desde el navegador; nunca pegues la clave en el formulario ni subas `.env` a GitHub. El modelo configurable tiene que estar habilitado en tu cuenta API, de lo contrario la llamada puede fallar. La API se factura por separado de ChatGPT Plus. El límite diario de la app reduce consumo accidental, pero **no es un límite de facturación garantizado**; también configurá límites y alertas en la consola de OpenAI.

El botón **IA** de cada evaluación se basa únicamente en los datos guardados, **no** busca en Internet. La pestaña **Agente automático** sí utiliza búsqueda web de la API para encontrar fuentes públicas, sin prometer acceso a catálogos privados o protegidos por login. Las tareas semanales se habilitan aparte en `.env`.

## 5. Qué código modificar para aprender

| Archivo | Lenguaje / librería | Para qué sirve |
|---|---|---|
| `src/finance.js` | JavaScript moderno, sin librerías | Fórmulas financieras, datos y criterios del score. |
| `src/server.js` | JavaScript + HTTP nativo de Node.js | Endpoints REST para guardar, editar, exportar y calcular. |
| `src/storage.js` | JavaScript + `fs` de Node.js | Guarda los datos en un JSON local y los migra desde 0.1. |
| `src/research.js` | JavaScript (Node.js) + API Responses con búsqueda web | Descubrimiento autónomo, filtros de fuentes, historial y programación semanal. |
| `public/research-ui.js` | JavaScript del navegador, sin frameworks | Vista del agente, resultados, URLs y estado de investigaciones. |
| `src/ai.js` | JavaScript + `fetch` nativo de Node.js | Consulta opcional a OpenAI y límite diario. |
| `public/app.js` | JavaScript del navegador, sin frameworks | Eventos del formulario, simulación, tabla, comparación. |
| `public/index.html` | HTML5 | Estructura visual de la aplicación. |
| `public/styles.css` | CSS3 | Colores, responsive y diseño. |
| `test/` | JavaScript + `node:test` | Pruebas de finanzas y API, ejecutables con `npm test`. |

### Cambios habituales

- **Capital disponible:** editar `CAPITAL_ARS` en `src/finance.js`.
- **Fórmula o pesos del score:** editar `priorityScore` en `src/finance.js`. No es una estimación de demanda.
- **Valores precargados del formulario:** editar `value="..."` en `public/index.html` y `setOriginDefaults` en `public/app.js`.
- **Modelo de IA:** cambiar `OPENAI_MODEL` en `.env`, si tu cuenta tiene acceso al modelo.
- **Aspecto visual:** editar variables `:root` en `public/styles.css`.

Los comentarios se colocaron **solo en las partes importantes**, evitando repetir línea por línea.

## 6. Probar

```bash
npm test
```

Los tests utilizan una carpeta temporal, no modifican tus cotizaciones.

## 7. Alcance y próximas mejoras

Esta es una versión real del **motor de análisis**, no un agente que ya navegue Internet de manera autónoma. Próximos pasos:

1. Conectores autorizados para recuperar publicaciones y proveedores, guardando URL, fecha y evidencia.
2. Validación del régimen aduanero, NCM y situación fiscal (con revisión humana).
3. Historial de precios por proveedor y comparación de escenarios de volumen.
4. Automatización periódica de las fuentes conectadas con un registro de ejecuciones.
5. Registro de campañas reales: clics, ventas atribuidas, CAC, ACOS y ROAS reales.
6. Autenticación, base de datos SQL y hosting seguro para acceso remoto.

**Seguridad:** esta versión escucha exclusivamente en `127.0.0.1` y no tiene cuentas de usuario. NO la publiques directamente en Internet ni abras el puerto en el router.
