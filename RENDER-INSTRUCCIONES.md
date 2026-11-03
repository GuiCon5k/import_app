# Import_app 0.5.5 — operación en Render

El servicio existente es `import-app-guicon`, conectado a `main` con despliegue automático. Preparar/revisar PR antes de fusionar; el merge publica cambios. OAuth ya está implementado: ver [configuración ML](docs/MERCADOLIBRE-RENDER.md).

## Antes de publicar

1. Exportar ofertas/historial de la versión actual ANTES de reiniciar o modificar el servicio. La versión 0.5.4 tiene ofertas en CSV y el historial en `/api/research`; no confundir esos formatos con el respaldo 0.5.5. Si se conservan los JSON originales `products.json` y `research.json`, la nueva versión los lee sin migración de formato. Las referencias manuales previas solo están en la pantalla: descargar su JSON.
2. Para el MVP de una instancia, adjuntar disco persistente en `/var/data`. Requiere un servicio pago y aprobación de costo; no se creó ninguno en esta revisión. Configurar `GUICON_DATA_DIR=/var/data/import-app` y `GUICON_STORAGE_DURABLE=true` solo cuando esa ruta esté dentro del disco real. No basta con crear la carpeta. Mantener una instancia y un proceso Node.
3. Render monta el disco en ejecución, no en build/pre-deploy. Restaurar datos con el servicio detenido y verificar antes de usar. Adjuntar disco reinicia/despliega; conservar respaldo ANTES. No hay despliegue sin interrupción con disco.
4. Mantener `PAID_API_ENABLED=false` y `AUTO_RESEARCH_ENABLED=false`. Conservar credenciales y OAuth existentes; no incluirlas en Git ni en comandos compartidos. Node 20/22, build `npm ci`, start `npm start`.
5. Las rutas están protegidas con Basic Auth sobre HTTPS. Se conserva health check TCP; no configurar `/api/status` como health check público porque exige autenticación.

## Respaldo y restauración 0.5.5

Descargar `/api/backup` desde la sesión autenticada. Incluye ofertas, historial, referencias y contador diario; nunca tokens OAuth. Guardarlo fuera del servicio. `.bak` solo conserva la versión anterior del archivo, en el mismo disco; no sustituye el respaldo externo.

Con la aplicación detenida, restaurar a un directorio NUEVO:

```sh
node scripts/restore-data.js respaldo.json /var/data/import-app-restored
```

El comando rechaza destinos existentes. Revisar el resultado y configurar `GUICON_DATA_DIR` al directorio restaurado al reiniciar. Probar primero con una copia y conservar el respaldo original. No restaurar respaldos de fuentes no confiables. Un archivo corrupto genera error; no se reemplaza silenciosamente por una colección vacía.

## Verificación

```sh
npm test
node scripts/smoke.js
```

Para smoke remoto, definir `SMOKE_BASE_URL`, `EXPECTED_COMMIT`, `APP_USERNAME` y `APP_PASSWORD` en un entorno seguro. No escribir contraseñas en argumentos ni logs. Comprueba versión, commit esperado, pagos bloqueados, UI, demo y lectura de referencias. No ejecuta llamadas ML ni OpenAI.

Validar manualmente importación/exportación con un dato ficticio y, cuando se autorice, guardar → redeploy → recuperar. Las pruebas locales de reinicio no demuestran por sí mismas que Render tenga un disco montado.

Si se necesitan varias instancias, migrar a una base transaccional externa antes de escalar. El bloqueo de OAuth, el diagnóstico y las tareas activas siguen siendo por proceso. El programador en memoria no garantiza ejecución puntual ni finalización tras un reinicio.

Referencias verificadas: [discos](https://render.com/docs/disks), [despliegues](https://render.com/docs/deploys), [health checks](https://render.com/docs/health-checks). Evidencia ML y límites de cálculo: [revisión 0.5.5](docs/REVISION-0.5.5.md).
