# Registro de cambios

## 1.4.0 — preparación de robustez (30 de octubre de 2026)

- Ejecución en service worker, journal individual, verificación y reanudación por conciliación del árbol real.
- Recuperación selectiva, detección de reordenamientos verificados, pausa entre favoritos, historial y exportación JSON.
- Compatibilidad con copias anteriores; validación de registros e identidades de trabajos independientes.
- Reglas personales de dominio exacto a carpeta existente, motivos y evidencia de clasificación, conservación de estructuras y revisión agrupada de duplicados.
- Permisos web opcionales, consultas serializadas por dominio, espera ante 429 y caché limitada.
- Sugerencias del Vigía almacenadas por identificador; migración de datos anteriores al modificarlos.
- Pruebas de fallos de checkpoint, conflictos independientes, carga local de 50.000 favoritos y trabajo real de 100 cambios que sobrevive al cierre de la página iniciadora.


## 1.3.0 — preparación de actualización (30 de octubre de 2026)

- Organización local por defecto; metadatos y verificación web opcionales.
- Duplicados exactos visibles con selección manual para revisión, sin borrar favoritos.
- Vista previa de cambios, ámbito fijo y recuperación local persistida antes de modificar.
- Rechazo de resultados obsoletos y bloqueo de aplicaciones concurrentes entre paneles.
- Raíces obtenidas del árbol real; reutilización de carpetas con título exacto y exclusión de carpetas administradas.
- Renombrado conservador y desactivado por defecto. Clasificación por palabras y puntuación, sin multiplicar carpetas por dominios desconocidos.
- Consultas compartidas por URL, cuerpo HTML limitado, timeout completo, cancelación y redirecciones sin seguimiento.
- Peticiones sin cookies ni referrer; guard de URL ampliado y permisos solo HTTP/HTTPS.
- Cola del Vigía, eliminación por identificador e importaciones masivas sin generar sugerencias individuales.
- Listas paginadas y dependencias corregidas; CI con auditoría de dependencias.
- Política de privacidad actualizada para describir las consultas web y la copia local.

La versión de la tienda se actualiza por separado de esta rama y sus paquetes.
