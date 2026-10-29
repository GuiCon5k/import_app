# Import_app 0.5.0 · Conectar Mercado Libre en Render

Esta versión incorpora OAuth 2.0, un botón para autorizar Import_app y un buscador gratuito de publicaciones argentinas que **no consume créditos de OpenAI**. Se conservan las pantallas de cálculo y el investigador existente.

## 1. Antes de comenzar

- La aplicación de Mercado Libre Developers debe tener la URL de retorno exactamente igual a:
  `https://import-app-guicon.onrender.com/auth/mercadolibre/callback`
- En Render → tu servicio → Environment deben existir `ML_CLIENT_ID`, `ML_CLIENT_SECRET` y `ML_REDIRECT_URI` (misma URL anterior). **No** pegar claves en GitHub.
- Si activaste PKCE en el panel de Mercado Libre, agregar `ML_PKCE_ENABLED=true`. Si no lo activaste, poner `false`. Con `true`, la aplicación envía `code_challenge` S256 y `code_verifier`.
- Mantener `PAID_API_ENABLED=false` y `AUTO_RESEARCH_ENABLED=false` durante las pruebas.

## 2. Crear almacenamiento persistente (Upstash)

Render Free puede perder archivos guardados localmente al reiniciarse. Los tokens OAuth de Mercado Libre deben mantenerse **fuera de ese disco**. Esta versión usa Upstash Redis REST y cifra cada registro con AES-256-GCM antes de guardarlo.

1. Crear una cuenta en https://console.upstash.com/.
2. Ir a Redis → **Create Database**, elegir un nombre como `guicon-tokens`, la región que prefieras y el plan gratuito si está disponible.
3. Abrir la base de datos → sección **Connect** → pestaña REST. Copiar `UPSTASH_REDIS_REST_URL` y el **token estándar** `UPSTASH_REDIS_REST_TOKEN`. Guardarlos en Render → Environment, no en archivos públicos.
4. En la terminal de tu PC, ejecutar este comando **localmente** para generar la clave de cifrado:
   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```
5. Copiar los 64 caracteres generados y guardarlos en Render como `ML_TOKEN_ENCRYPTION_KEY`. **No compartir esta clave ni guardarla en GitHub.**
6. Guardar variables y desplegar nuevamente el servicio.

El backend solo habilita «Conectar Mercado Libre» cuando estas tres variables y las de OAuth están presentes. Una clave de cifrado nueva no puede descifrar los tokens antiguos: si la cambiás, será necesario limpiar el registro y volver a autorizar. **No uses una base de datos compartida con aplicaciones desconocidas.**

## 3. Conectar tu cuenta

1. Abrir https://import-app-guicon.onrender.com/ e iniciar sesión con el usuario y contraseña privados de la aplicación.
2. Ir a **Mercado Libre** (nuevo apartado en el menú lateral).
3. Si dice «Falta Upstash...», revisar el paso 2.
4. Presionar **Conectar Mercado Libre**. El navegador irá al dominio oficial `auth.mercadolibre.com.ar`.
5. Dar permiso a tu propia aplicación. Mercado Libre te devolverá a Import_app.
6. El apartado mostrará «Cuenta conectada»; ahí podés buscar `perchas pantaloneras` o una publicación identificada como `MLA123456789`.

El callback recibe el `code` y el `state` de Mercado Libre. El servidor valida el `state` firmado y su cookie HttpOnly, intercambia el `code` desde Node.js, **no desde el navegador**, y guarda el `access_token` y `refresh_token` cifrados en Upstash. Nunca registra los tokens en logs. Los refresh tokens se renuevan únicamente cuando caduca el acceso. No se ofrece una falsa «conexión exitosa» si no se pudo guardar el token.

## 4. Consultas y limitaciones

- **Búsqueda por nombre:** consulta `/sites/MLA/search` y, si la plataforma lo permite, verifica los resultados por `/items/bulk`. Si Mercado Libre responde 403/401 por políticas o permisos de la app, muestra el error real: la conexión OAuth no garantiza acceso irrestricto al buscador público.
- **Búsqueda por ID MLA:** consulta directamente `/items/bulk`; sirve incluso cuando el buscador general está restringido.
- Los precios confirmados son precios **publicados** en ARS al momento de la consulta. No son ventas comprobadas ni precio neto de comisiones, envío, publicidad o impuestos; no representan por sí solos demanda.
- El investigador de OpenAI, cuando se active expresamente, puede usar el token OAuth persistente para verificar links MLA que encuentre. No se activan llamadas pagas automáticamente.
- Upstash en esta versión guarda **solo los tokens de Mercado Libre**. El historial local de investigaciones y las ofertas continúan siendo temporales en Render Free. Necesitaremos migrar esos datos más adelante.
- Esta implementación está orientada a una instancia de Import_app (Render Free). Una arquitectura con múltiples instancias requiere coordinación distribuida durante refresh y protección de bases de datos.

## 5. Actualizar desde VS Code sin borrar la carpeta .git

1. Descargar y descomprimir el ZIP de la versión 0.5.0.
2. Abrir la carpeta `C:\Users\guille\Desktop\guicon-ai` (la que ya contiene `.git`).
3. Copiar **el contenido** de la carpeta `import-app` del ZIP encima de los archivos existentes. **No reemplazar la carpeta `.git` y no borrar tu `.env`.**
4. Desde la terminal PowerShell de esa carpeta:
   ```powershell
   npm.cmd test
   git status
   git add .
   git commit -m "Import_app 0.5: conectar Mercado Libre OAuth"
   git push
   ```
5. Render publicará la nueva versión si **Auto-Deploy** está habilitado y asociado a `main`. Podés verificarlo en Render → Events.

**No confundir:** `npm.cmd test` son pruebas simuladas locales; pasar los tests no confirma que Mercado Libre haya autorizado tu cuenta en Internet. La autorización real se completa desde el botón después del despliegue.

Documentación oficial:
- https://developers.mercadolibre.com.ar/es_ar/recomendaciones-de-autorizacion-y-token
- https://developers.mercadolibre.com.ar/es_ar/api-docs-es/items-y-busquedas
- https://upstash.com/docs/redis/features/restapi
