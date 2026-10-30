# Auditoría de eficiencia y seguridad — El Organizador

**Fecha:** 30 de octubre de 2026. **Versión preparada:** 1.3.0.

**Repositorio:** https://github.com/ragustingarcia/el-organizador
**Base revisada:** `c278029eda02cbe80ebaf380fe33ffeec93cdd09` (`main` al descargar).
**Rama local:** `audit/organizacion-segura-1.3`.

## Resultado

La base funcionaba y aprobaba sus 30 pruebas, pero tenía defectos importantes en consultas web, recuperación de cambios y criterio de clasificación. Se preparó una actualización con organización local por defecto, duplicados visibles, vista previa exacta, recuperación persistida y consultas limitadas cuando el usuario las habilita.

La actualización está compilada y probada localmente. **No está subida a GitHub ni publicada en Chrome Web Store.** Las comprobaciones locales no equivalen a aprobación de la tienda ni a CI remoto.

## Hallazgos y correcciones

P1 identifica una corrección prioritaria antes de distribuir; P2, una mejora importante. No se asignó una puntuación CVSS propia a los defectos de la aplicación.

| Prioridad | Hallazgo en la base | Evidencia y consecuencia | Corrección preparada |
|---|---|---|---|
| P1 | Solo se filtraba la primera URL; se seguían redirecciones automáticamente | `scanner.ts:57,70` usa `redirect: follow`. Un destino posterior quedaba fuera del guard. El alcance efectivo sobre redes privadas dependía del destino, DNS y controles del navegador: no se ejecutó un ataque contra una red real. | `manual`: no seguir el salto. Una redirección queda sin verificar y sin movimiento automático. |
| P1 | El límite de 60 KB se aplicaba después de descargar todo | `scanner.ts:84` llama `response.text()` y luego recorta. Un cuerpo grande podía consumir memoria y transferencia completa. Reproducido con una respuesta simulada de 2 MB. | Lectura por stream, hasta 60.000 bytes entregados al analizador; cancelación del cuerpo y descarte de binarios. Solo se conservan hasta 2.001 caracteres de metadatos por URL en la caché. |
| P1 | El plazo terminaba al recibir las cabeceras | `scanner.ts:74` limpia el timeout antes de leer el cuerpo. Una respuesta simulada con cuerpo detenido queda sin ningún temporizador activo. | Ocho segundos para cabeceras y cuerpo, con propagación de cancelación. |
| P1 | Los cambios podían quedar a medias sin recuperación | `App.tsx:243` en adelante modificaba marcadores uno por uno sin journal. Un error posterior no revertía lo anterior. El renombrado también podía quitar contenido útil. | Copia persistida antes de modificar favoritos, restauración de títulos/carpeta/posición y conservación del respaldo ante fallos. El renombrado solo elimina sufijos genéricos y está inicialmente desactivado. |
| P1 | Se podía aplicar un resultado sobre un ámbito cambiado | La configuración seguía habilitada tras escanear, y `App.tsx:249` consultaba el valor actual del selector al aplicar. | Configuración fija hasta volver a escanear; plan explícito y verificación fresca de título, URL y carpeta antes de escribir. Web Locks impide dos aplicaciones simultáneas desde paneles de la extensión. |
| P2 | El guard aceptaba variantes locales | Pruebas sobre la base aceptan `localhost.` y IPv4 local representada como IPv6. | Bloqueo ampliado a variantes locales conocidas, IPv4 normalizada por URL, rangos especiales y credenciales incrustadas. El límite DNS se documenta por separado. |
| P2 | Doce paquetes con avisos de seguridad | `npm audit`: 8 altos y 4 moderados. Se verificó en el lockfile que todos los paquetes afectados eran de desarrollo; no demuestra una explotación del código distribuido. | Actualizaciones compatibles, sin `--force`; auditoría final completa y de producción: cero avisos. CI incorpora `npm audit`. |
| P2 | Se repetían consultas para la misma URL y para errores definitivos | El escáner no compartía resultados entre marcadores. HEAD reintentaba cualquier error distinto de 401/403. | Caché por escaneo de consultas en curso y completadas; GET de reemplazo solo ante 405/501. Los parámetros se mantienen distintos y los fragmentos se omiten solo para HTTP. |
| P2 | Clasificación por subcadenas y carpetas por dominio | `classifier.ts:127,135`. “Reaction” coincidía con “react”; dominios desconocidos generaban carpetas nuevas. | Límites de palabra, puntuación de coincidencias y patrones precompilados. Una sola categoría “Varios”, sin seleccionar automáticamente. |
| P2 | Búsqueda parcial de carpetas y raíz fija | `modifier.ts:20` no comprobaba el título exacto del resultado. Aplicación y Vigía presuponían la raíz `1`. | Coincidencia exacta, una búsqueda por destino, raíces reales y ámbito original del Vigía. Se excluyen elementos administrados y se evitan subcarpetas de categoría repetidas. |
| P2 | El Vigía reemplazaba las sugerencias previas | `background.ts:42` guardaba un único `pendingSuggestion`. Guardar varios favoritos seguidos perdía los anteriores. | Cola serializada, migración del formato anterior y retiro por identificador. Durante importaciones masivas se omiten sugerencias individuales. |
| P2 | Errores de lectura se presentaban como una biblioteca vacía | `bookmarks.ts:39,90` resolvía `[]` ante fallos. El panel podía dar una impresión de limpieza sin haber leído el árbol. | Errores explícitos; no se declara una biblioteca vacía como limpia. Timeouts y redirecciones aparecen como inciertos, no como caídos confirmados. |
| P2 | La política afirmaba que nunca se transmitían datos | La verificación hace peticiones directas a URLs guardadas y el Vigía almacena URLs localmente. `<all_urls>` también excedía los esquemas usados. | Política corregida; opciones web inicialmente apagadas, peticiones sin cookies ni referrer, permisos solo HTTP/HTTPS, almacenamiento restringido a contextos de confianza y CSP más estricta. |

Las referencias de línea anteriores corresponden al commit base, no a los archivos reorganizados de 1.3.0.

## Qué mejora la organización

- Los duplicados se detectan con URLs normalizadas, manteniendo parámetros y fragmentos para no mezclar recursos diferentes. Se conservan todos los favoritos: el usuario puede apartar las copias seleccionadas a “Revisión Manual”.
- Las categorías inciertas, los duplicados y los resultados problemáticos no se seleccionan automáticamente para mover. Los enlaces previamente apartados a revisión tampoco se reorganizan automáticamente.
- Se reutilizan carpetas con título exacto dentro del ámbito elegido. Los favoritos ya situados en su categoría no generan otra categoría debajo.
- Al organizar todo el árbol se conserva la raíz real de cada favorito. Al elegir una carpeta, las categorías nuevas pertenecen a ese ámbito.
- Se conservan partes descriptivas de los nombres. Por ejemplo, “AWS | Services - S3” deja de convertirse en “AWS”; “Example - Home” sí puede convertirse en “Example”.
- La vista previa muestra cada cambio de nombre y destino. Las listas y el detalle se presentan en páginas de 50 filas.

No se implementó eliminación automática de duplicados o carpetas vacías. La actualización favorece una limpieza revisable y recuperable.

## Comprobaciones realizadas

| Comprobación | Resultado |
|---|---|
| Base sin modificar | 30 pruebas aprobadas; lint y compilación aprobados |
| Pruebas investigativas contra el código base | 5 pruebas confirman los comportamientos descritos: guard, redirects, lectura completa, timeout prematuro y clasificación/renombrado |
| Suite de 1.3.0 | 96 pruebas aprobadas, 0 fallidas |
| Lint, TypeScript y compilación de panel y service worker | Aprobados |
| Diferencias de Git | Sin errores de whitespace en `git diff --check` |
| Dependencias | Auditoría completa: 0; auditoría solo producción: 0 |
| Flujos de error con APIs simuladas | Fallo de almacenamiento impide modificar favoritos; detección de resultados obsoletos; movimiento exitoso seguido de fallo de renombrado recuperable; conflicto con edición posterior; exclusión entre paneles |
| Extensión real en navegador | Edge `156.0.4314.50`, perfil separado, extensión cargada y página de la extensión a 480 px, con seis favoritos ficticios en un ámbito de prueba |
| Flujo de interfaz | Escanear → seleccionar duplicado → revisar → aplicar → deshacer. Se verificaron títulos, carpetas e índices originales de los seis favoritos |
| Red y ejecución del flujo local | 0 peticiones HTTP/HTTPS observadas durante el flujo; 0 excepciones de runtime observadas |
| Búsqueda acotada de secretos | Sin coincidencias en archivos actuales versionados para formatos conocidos de tokens GitHub, claves AWS, privadas PEM/OpenSSH y claves Stripe live. No es un análisis completo del historial ni de todos los formatos de secreto |

La prueba de navegador se limitó al ámbito ficticio seleccionado. No se aplicó una limpieza a los marcadores personales del perfil habitual. El render se abrió como página de extensión con ancho de panel; no valida la interacción del panel lateral nativo en Chrome ni su ficha de tienda.

## Eficiencia: evidencia y límites

Se compararon **1.000 favoritos con 50 URLs HTTP distintas**, usando respuestas HTTP simuladas y cuatro workers:

| Modalidad | Consultas iniciadas |
|---|---:|
| Base, verificar y organizar | 1.000 |
| Actualización, verificar y consultar metadatos | 50 |
| Actualización, organización local | 0 |

La reducción de consultas compartidas es del **95 % en ese conjunto**, no una promesa de aceleración de todo el producto. La latencia real depende de los sitios y de cuántas URLs se repitan. No se midieron servidores de terceros ni se cargó una biblioteca personal completa para esta comparación.

El código del panel crece aproximadamente de 210 KB a 221 KB sin comprimir por la recuperación y las nuevas funciones. A cambio, la compilación deja fuera **325.991 bytes** de imágenes promocionales y archivos SEO que no utiliza la extensión. Esos archivos y la atribución del autor se conservan en el repositorio. La compilación copia explícitamente el manifest y los tres iconos necesarios.

La copia de recuperación se escribe dos veces por aplicación —inicio e intención completa—, en lugar de reescribir una lista creciente tras cada favorito. La resolución de carpetas se comparte por destino. La detección de duplicados y la caché usan mapas; las listas limitan el número de filas renderizadas.

## Límites pendientes antes de una publicación definitiva

1. **DNS:** el guard es sintáctico. Un hostname público puede resolver a una IP privada; no se promete aislamiento completo contra DNS rebinding. El modo local evita consultar sitios. Las funciones web se habilitan explícitamente.
2. **Recuperación:** solo cubre la última aplicación de esta extensión, no todo el perfil ni una desinstalación. Las carpetas creadas que queden vacías se conservan. Los conflictos de título/URL/carpeta detienen la recuperación y mantienen la copia. No se garantiza resolver reordenamientos externos posteriores.
3. **Concurrencia externa:** Chrome no ofrece una transacción de compare-and-swap para todo el árbol. Se comprueba el estado antes de mover y antes de renombrar, pero una edición o sincronización externa puede intercalarse entre llamadas. Web Locks coordina los paneles de la propia extensión.
4. **Salud de enlaces:** un 401/403 indica respuesta con autenticación requerida, no contenido accesible. Una redirección se deja sin verificar. Los estados son una consulta puntual, no una garantía permanente.
5. **Compatibilidad:** faltan la prueba del panel lateral nativo en Chrome, sincronización real entre dispositivos, raíces de cuenta activas y bibliotecas personales grandes. El código usa APIs compatibles con Chrome 114+, pero no se ejecutó esa versión antigua.
6. **Distribución:** falta subir la rama/PR, ejecutar y revisar CI remoto, y tramitar la actualización en Chrome Web Store. No hay publicación de tienda incluida en esta auditoría.

## Próxima decisión de producto

La siguiente ampliación útil sería una selección de duplicados más cómoda y una limpieza de carpetas vacías con vista previa y recuperación propias. También conviene medir categorías incorrectas con un conjunto representativo de favoritos antes de agregar reglas o automatismos. No se recomienda empezar por borrar duplicados o aplanar toda la estructura existente.

## Referencias técnicas

- [API oficial de marcadores de Chrome](https://developer.chrome.com/docs/extensions/reference/api/bookmarks): árbol, elementos administrados y posibles raíces locales/de cuenta.
- [API oficial de panel lateral](https://developer.chrome.com/docs/extensions/reference/api/sidePanel): apertura y contexto de interacción.
- [MDN — redirecciones de Fetch](https://developer.mozilla.org/en-US/docs/Web/API/Request/redirect): modos de seguimiento.
- [MDN — credenciales de Fetch](https://developer.mozilla.org/en-US/docs/Web/API/Request/credentials): opción `omit`.

Los avisos concretos de dependencias y las salidas JSON de las pruebas se entregan en el archivo de evidencias. Las afirmaciones sobre defectos propios provienen del código base y de las comprobaciones descritas, no de las referencias generales.
