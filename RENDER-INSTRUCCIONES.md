# Import_app — publicar en Render

> Guía histórica de 0.4.1: OAuth ya está implementado. Usar [Mercado Libre/Render](docs/MERCADOLIBRE-RENDER.md) y [revisión 0.5.4](docs/REVISION-0.5.4.md). El servicio actual despliega automáticamente desde `main`; preparar PR y obtener aprobación antes de fusionar.

## Qué incluye esta versión

- Node.js 20+, servidor HTML/JavaScript sin frameworks externos (versión 0.4.1).
- En Render escucha en `0.0.0.0` y usa el puerto asignado en `PORT`.
- En producción pide usuario y contraseña antes de mostrar **cualquier** contenido o API.
- El gasto de OpenAI y el investigador programado quedan desactivados de fábrica.
- **La persistencia sigue en archivos JSON locales:** Render Free los borra al reiniciar, suspenderse o publicar cambios. No cargues información importante hasta conectar una base de datos persistente.
- **OAuth de Mercado Libre aún no está implementado.** No registres una Redirect URI imaginaria: primero necesitaremos implementar el callback.

## Paso 1 — GitHub

1. Crear repositorio **privado** `import-app`.
2. Subir el CONTENIDO de esta carpeta a la raíz de ese repo, de modo que `package.json`, `src/` y `public/` queden en la raíz.
3. No subir `.env`: está excluido por `.gitignore`.

## Paso 2 — Render

En https://dashboard.render.com/ elegir **New > Web Service > Git Provider > GitHub**, y seleccionar `import-app`.

| Campo | Valor |
|---|---|
| Name | `import-app` (o similar si está ocupado) |
| Language / Runtime | `Node` |
| Branch | `main` |
| Region | La más próxima disponible (por ejemplo Oregon si no ofrece otra próxima) |
| Root Directory | Vacío, si `package.json` está en la raíz |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance Type | `Free` para ensayar |

En **Environment** agregar **una variable por fila**:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `APP_USERNAME` | Un usuario elegido por vos (ej. `guicon-admin`) |
| `APP_PASSWORD` | Contraseña **única y larga**, al menos 16 caracteres |
| `PAID_API_ENABLED` | `false` |
| `AUTO_RESEARCH_ENABLED` | `false` |
| `MAX_RESEARCH_RUNS_PER_DAY` | `1` |
| `RESEARCH_MODEL` | `gpt-5-mini` |
| `OPENAI_API_KEY` | Opcional ahora; agregar después de probar acceso. Nunca en GitHub. |
| `ML_ACCESS_TOKEN` | Dejar sin configurar por ahora. |

No hace falta configurar `PORT`; Render lo aporta.

Clic en **Create Web Service** y esperar a que diga **Live**. Abrir URL `https://...onrender.com` que Render muestre. El navegador pedirá usuario y contraseña.

## Paso 3 — Pruebas sin gastar créditos

- Debe pedir usuario y contraseña al abrir el enlace.
- Con tus credenciales debe mostrar el panel.
- Ir a `/#investigador`, usar «Verificar configuración (gratis)» y «Probar demo sin créditos».
- «Investigar automáticamente» DEBE permanecer bloqueado con `PAID_API_ENABLED=false`.
- Si algo falla, mirar **Logs** del servicio en Render; compartir solo el error, nunca las claves.

## Advertencias antes de utilizarla de verdad

- En Render Free el disco NO es persistente, y el servicio se suspende después de 15 minutos de inactividad; trabajos programados no son confiables allí.
- Guardamos historial y ofertas en archivos locales: **se perderán** con reinicios o redeploys. Próxima mejora: Postgres persistente.
- Solo se implementó un acceso simple para un propietario. La autenticación Basic se usa exclusivamente mediante HTTPS de Render, ideal para pruebas privadas; antes de varios usuarios, implementar login con sesiones y controles más completos.
- Mercado Libre OAuth requiere ruta de callback HTTPS y manejo seguro de `state`, tokens y renovaciones. No existe aún en esta versión.
