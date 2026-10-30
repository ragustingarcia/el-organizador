# Implementación de robustez 1.4.0

30 de octubre de 2026. Actualización local de la propuesta de robustez; no publicada.

## Cambios implementados

- Los trabajos se ejecutan en el service worker. El panel los inicia, consulta su copia y permite reanudar o pausar entre favoritos.
- Cada favorito tiene un registro persistente independiente: preparado antes de escribir, verificado después y revertido al recuperar. Una reanudación compara el árbol con los valores anteriores y esperados antes de repetir una llamada.
- Los identificadores de trabajo son UUID independientes de la fecha. No se mezclan estados de dos trabajos creados en el mismo instante.
- La recuperación procesa los favoritos compatibles y conserva los conflictos. Comprueba cambios posteriores de título, URL, carpeta y posiciones registradas al cierre del trabajo. Una copia anterior de 1.3 sigue siendo recuperable con su tratamiento conservador.
- La intención de resolver o crear carpetas se registra antes de llamar a Chrome y los IDs conocidos se conservan. Si esa fase queda incompleta, se rechaza la reanudación automática; se puede recuperar/archivar el trabajo. Las carpetas se conservan: no se decide su propiedad por coincidencia de nombre.
- Las copias se archivan y pueden volver a abrirse. El panel exporta el árbol completo en JSON. Una acción explícita permite liberar historial conservando las veinte copias más recientes y protegiendo el trabajo activo.
- Los destinos existentes se reconocen por ID y padre. Se evitan categorías anidadas dentro de sí mismas y no se confunden carpetas homónimas de proyectos distintos.
- La clasificación muestra evidencia y motivo; las coincidencias ambiguas o débiles quedan sin seleccionar. La selección automática se limita a favoritos directamente contenidos en el ámbito elegido, salvo regla personal explícita.
- Se pueden guardar y eliminar reglas de dominio exacto a carpeta existente. Los duplicados se agrupan con rutas para elegir el favorito que se conserva y apartar las otras copias.
- La clasificación local sigue disponible cuando falla una consulta web. El acceso HTTP/HTTPS se declara opcional y se pide desde el botón de escaneo si se habilitó una función web.
- Las consultas a un dominio se serializan, una respuesta 429 establece una espera de nuevas consultas al mismo dominio (Retry-After acotado entre uno y sesenta segundos), y la caché retiene hasta 1.000 resultados terminados. No se siguen redirecciones ni se añaden cookies.
- El Vigía guarda sugerencias en claves independientes por marcador, evitando reescribir la cola entera en cada alta. Los formatos anteriores se leen y se migran al modificarlos. El estado de importación se guarda y se reinicia al arrancar el perfil.

## Decisión de almacenamiento

Se mantuvo chrome.storage.local y se separaron los registros por operación, en lugar de introducir IndexedDB en esta iteración. Se conserva la compatibilidad con las copias previas y los fallos de cuota impiden avanzar sin registro. No hay una transacción atómica entre el almacenamiento y chrome.bookmarks. La conciliación cubre la ventana entre una llamada exitosa y el guardado de su confirmación.

El historial y las sugerencias se enumeran con lecturas del almacenamiento. Para historiales grandes, IndexedDB con índices y un ejecutor con cursor persistente por lotes sigue siendo una evolución pendiente. No se declara validada la ejecución de decenas de miles de escrituras en un único trabajo.

## Validación

- 110 pruebas de lógica, componentes y APIs simuladas, incluidas interrupciones después de mover o después de completar una mutación pero antes de guardar su confirmación.
- Casos de recuperación con conflicto independiente, reordenamiento externo, copia antigua, snapshot inválido, colisiones de fecha, protección del trabajo activo y movimientos propios que desplazan índices de operaciones anteriores.
- Prueba del núcleo local con 50.000 favoritos sintéticos, 1.000 URLs distintas y 49.000 duplicados; genera 1.000 movimientos seleccionados sin iniciar ninguna consulta web. El tiempo de una ejecución fue aproximadamente 1,2 segundos; no constituye una garantía para otros equipos ni mide interfaz o escrituras Chrome.
- Lint, TypeScript, compilación del panel/service worker y comprobación de diferencias de Git.
- Prueba real en Edge 156 con seis favoritos ficticios: escanear, aplicar y deshacer, comprobando títulos, carpetas e índices.
- Prueba real adicional: iniciar un trabajo de 100 cambios, cerrar la página que lo inició, comprobar los cien registros verificados y recuperar los favoritos desde una página de extensión reabierta.

El ensayo de navegador usa un perfil temporal y páginas de extensión a ancho de panel. No sustituye la prueba del panel lateral nativo en Chrome. La finalización real del worker entre pasos y el reinicio completo del navegador aún requieren pruebas de integración específicas: las interrupciones de escritura se cubren con inyección de fallos.

## Límites y trabajo restante

1. No se promete ejecución exactamente una vez ni atomicidad frente a Chrome Sync u otras extensiones. Un conflicto conserva la copia y exige revisión.
2. Los estados de operaciones verificadas permiten conciliar y reanudar, pero el ejecutor todavía recorre el trabajo; falta un cursor persistente y límites de lote para volúmenes extremos.
3. Las carpetas nuevas se mantienen al recuperar. La fusión de carpetas y eliminación de vacías no está implementada; requiere un tratamiento propio de propiedad y dependencias.
4. El respaldo JSON puede guardarse fuera de la extensión. No se implementó importación de ese respaldo ni exportación HTML compatible con el importador de Chrome.
5. El guard de URL sigue siendo sintáctico: los permisos opcionales no eliminan DNS rebinding. El modo local evita las consultas.
6. Falta comprobar en Chrome los flujos de conceder, denegar y revocar permisos web; la prueba de Edge cubrió el flujo local sin solicitudes HTTP.
7. Falta CI remoto, revisión del diff completo antes de merge y publicación independiente en Chrome Web Store.

Los archivos de la 1.3 se conservan como entrega anterior. La versión 1.4 es una implementación local para revisar, probar y continuar con los límites anteriores explícitos.
