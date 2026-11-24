# Parleysjubiladores — versión inicial para Cloudflare Workers

Subir los archivos de esta carpeta (no la carpeta contenedora) a la rama main del repositorio Analisis-deportivo. El Worker existente debe usar directorio raíz /, sin comando de compilación y comando de despliegue `npx wrangler deploy`. El archivo wrangler.jsonc conserva el nombre del Worker existente: analisis-deportivo.

La agenda privada queda deshabilitada hasta implementar autenticación de Supabase y políticas RLS. No se confía en cabeceras de identidad aportadas por el navegador. Las cuotas requieren configurar ODDS_API_KEY como secreto en Cloudflare. Las fuentes deportivas no han sido verificadas en producción. No subir claves privadas al repositorio.

Prueba local: `npm test` (Node 22). La prueba no contacta proveedores externos.
