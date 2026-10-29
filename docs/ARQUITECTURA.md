# Cómo está organizada la versión 0.2

**Lenguaje principal: JavaScript**, usando Node.js del lado del servidor y JavaScript del navegador para la interfaz.

```text
Navegador: index.html + app.js + styles.css
       │ HTTP /api/...
       ▼
src/server.js  ──►  src/finance.js (cálculos puros)
       │                
       ├───────────────► src/storage.js ──► data/products.json
       │
       └───────────────► src/ai.js ──► API OpenAI (si hay clave)
```

## Recorrido de una evaluación

1. `public/app.js` lee los campos de HTML y prepara un JSON.
2. `src/server.js` recibe el JSON y solicita a `normalizeOffer` que valide los valores.
3. `src/finance.js` calcula costos, anuncios, margen, capital y score.
4. Al guardar, `src/storage.js` escribe en `data/products.json`.
5. La interfaz refresca el ranking y el comparador de proveedores.
6. Opcionalmente, `/api/ai/analyze` manda **datos guardados** a la API de OpenAI y muestra el texto recibido.

## ¿Por qué no React, Express o PostgreSQL todavía?

Para entregar una aplicación local fácil de ejecutar **sin npm install ni configuración de servicios**, se usaron las APIs que vienen con Node.js. La lógica financiera está aislada del frontend: más adelante podemos migrar la pantalla a React y la base a PostgreSQL sin tener que rehacer las fórmulas.

## Advertencia sobre el score

La clasificación asigna puntos por margen, capital, evidencia, plazo y enlace documentado. **No mide demanda real**; una puntuación alta no es una recomendación automática de importación.


## Nuevo en 0.3 — flujo automático

1. El panel solicita `POST /api/research/start` con un foco opcional.
2. `src/research.js` crea un trabajo `running`, controla el cupo diario y llama a OpenAI Responses API con la herramienta `web_search` (hasta tres llamadas por ejecución).
3. Devuelve productos, riesgos, referencias de abastecimiento argentino/chino y URLs. Cada oportunidad queda etiquetada **pendiente_de_cotizacion**; se rechazan enlaces que no sean HTTP/HTTPS.
4. Los trabajos quedan en `data/research.json`, separados de las cotizaciones que alimentan la calculadora (`data/products.json`). Así no se confunden datos hallados con costos confirmados.
5. La pestaña «Agente automático» consulta `GET /api/research`; si hay una tarea activa, actualiza la vista periódicamente.
6. `AUTO_RESEARCH_ENABLED=true` habilita una comprobación cada hora para decidir si corresponde una investigación semanal. Solo funciona cuando el servidor Node.js sigue encendido.

### ¿Cómo modificar el agente?

- Cambiar categorías prioritarias: `src/research.js`, texto de `instructions` y parámetro `focus` enviado desde el panel.
- Cambiar frecuencia: `.env`, `RESEARCH_INTERVAL_DAYS`.
- Reducir consumo: `.env` `MAX_RESEARCH_RUNS_PER_DAY` y en `src/research.js` `max_tool_calls`.
- Cambiar campos del resultado: `parseResearch` en `src/research.js` y `renderJob` en `public/research-ui.js`.

La implementación es un primer agente investigador y NO sustituye scraping permitido ni las cotizaciones formales.
