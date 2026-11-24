# Jubilacion

Portal público de fútbol en español. Worker ESM con agenda semanal, noticias, fichas y probabilidades.

## Desarrollo

`npm run dev` inicia http://127.0.0.1:4173. `npm run build` genera el Worker. `npm run validate` verifica sintaxis y probabilidades.

## Datos

ESPN proporciona calendario, noticias, alineaciones y resultados recientes de las competiciones disponibles. Football-Data aporta históricos de las cinco ligas europeas principales. Los resultados se combinan evitando duplicados por equipos y fecha. Open-Meteo aporta el pronóstico por ciudad como contexto. Los horarios se muestran en America/El_Salvador.

## Modelo

Poisson con ponderación temporal y corrección Dixon–Coles. Elo ajusta cómo se reparten los goles entre local y visitante. Una muestra corta se complementa con tasas de referencia y se etiqueta en la ficha. Sin resultados anteriores de ninguno de los dos equipos se informa que no hay estimación. La prueba cronológica 80/20 evalúa el modelo base de goles.

Las selecciones se ordenan por probabilidad estimada y muestran una cuota justa para comparar. Primer tiempo, córners y amarillas combinan Poisson, binomial negativa y frecuencia observada. Los pesos se eligen con Brier en validación cronológica 60/20/20, separando fechas completas. FootyStats aporta su muestra oficial 2024/25 para Premier League; se deduplica contra Football-Data. Sus tarjetas se excluyen para no mezclar definiciones. Sofascore se enlaza solo para consulta manual. Las noticias se solicitan en español.

## Agenda privada

La ruta /api/picks usa identidad de Sites y D1. Cada consulta incluye el usuario autenticado. POST es idempotente por UUID y PUT usa revisión optimista. Los resultados se introducen manualmente y los importes se registran en centavos USD. La migración 0001_picks.sql se aplica al publicar.

`node scripts/verify-features.mjs` verifica aislamiento, reintentos, concurrencia y los mercados con datos reales.
