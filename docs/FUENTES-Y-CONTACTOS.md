# GUICON AI 0.4 — Fuentes comerciales y contactos

## Estado real de las integraciones

- **Mercado Libre:** Guicon busca referencias a publicaciones individuales (ID `MLA...`) mediante búsqueda web de OpenAI, si se autoriza el consumo. **No se deben dar por confirmados sus precios con solo haberlas encontrado en la web.** Si se configura un token OAuth válido de Mercado Libre (`ML_ACCESS_TOKEN`), la app consulta `GET https://api.mercadolibre.com/items/bulk?ids=...` y solamente muestra un importe confirmado cuando esa API devuelve precio, moneda ARS, ID y estado válido. El token de OpenAI **no** funciona para Mercado Libre.
- **1688:** descubrimiento de fichas públicas por búsqueda web; sin una sesión de 1688 conectada no se asegura disponibilidad, precio ni MOQ. No se automatizan accesos a cuentas ni se eluden restricciones de la plataforma.
- **Made-in-China:** se buscan fichas públicas y empresas. Puede requerirse enviar consultas desde la plataforma para recibir una cotización. El enlace a la ficha comercial funciona como vía inicial de contacto.
- **Fabricantes/mayoristas argentinos:** búsqueda web de empresas con presencia pública y enlace hacia su página comercial. Teléfonos y emails solo se presentan como datos encontrados por IA en una fuente citada, todavía sujetos a confirmación humana.

## Evidencia y seguridad

`referencia_web_sin_validar` significa que un enlace fue identificado por el agente, pero no validado por el servicio oficial. Un precio propuesto por el modelo se ignora en los cálculos y se guarda aparte como `claimedPriceArs` para auditoría.

`api_oficial_ml` indica que la aplicación obtuvo el precio de una respuesta simulada en tests o, en uso real, desde la API de Mercado Libre con autorización; se guarda fecha y moneda. No se debe interpretar como evidencia de ventas, rotación o unidades vendidas.

Los enlaces de proveedores requieren una ficha comercial. Si no aparece un correo o teléfono público, aparece **Ver ficha / contactar**. No se inventan medios de contacto ni se envían mensajes automáticamente. Para 1688 y Made-in-China se controlan los dominios para evitar falsos proveedores bajo otras URLs.

## Configuración local y primera prueba

1. Descomprimir la versión 0.4 en una carpeta nueva y copiar **solo** el `.env` privado y `data/` de tu versión anterior si tenés información que conservar. No compartir `.env`.
2. Node.js 20 o superior: `npm.cmd test` y `npm.cmd run dev` en PowerShell.
3. Entrar a `http://localhost:3000/#investigador` y probar **Verificar configuración (gratis)** y **Probar demo sin créditos**.
4. Para la **primera** prueba real, dejar `AUTO_RESEARCH_ENABLED=false` y `MAX_RESEARCH_RUNS_PER_DAY=1`. Cuando decidas habilitar una consulta con posible consumo de API, editar `PAID_API_ENABLED=true`, reiniciar y confirmar en la interfaz. La ejecución se cobra en la cuenta de API, además de herramientas de búsqueda.
5. `ML_ACCESS_TOKEN` es **opcional**. Sin él, podés recibir enlaces web a Mercado Libre, pero no un precio marcado como comprobado vía API. No confundas un token de Mercado Libre con una clave API de OpenAI.
6. Elegí un foco **concreto** en la primera prueba, por ejemplo: `perchas para pantalones antideslizantes`, para facilitar la obtención de fuentes verificables. No realices la compra hasta comprobar cotizaciones, NCM, costos y régimen aduanero aplicable.

## Archivos para modificar (JavaScript)

- `src/research.js`: prompt de búsqueda, normalización de fichas y verificación opcional desde API de Mercado Libre.
- `public/research-ui.js`: tarjetas de publicaciones, proveedores y contactos; HTML se construye con `textContent`.
- `src/diagnostics.js`: verifica `.env` localmente sin tocar tus créditos.
- `src/finance.js`: costos fijos/variables, publicidad, capital, resultados netos.
- `test/`: pruebas de seguridad, verificación de fuentes y cálculos; usan datos simulados, no consumen API.
