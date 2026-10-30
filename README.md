# 🧙‍♂️ El Organizador

![El Organizador — tu mago de favoritos](./public/assets/og-image.png)

**Tu mago de favoritos.** Organiza los marcadores de Chrome desde un panel lateral: clasificación local, detección de duplicados y cambios revisables con recuperación.

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/laaakmnbceahaobdmgjdcgefhijimiae?label=Chrome%20Web%20Store&logo=googlechrome&logoColor=white&color=4285F4)](https://chromewebstore.google.com/detail/el-organizador/laaakmnbceahaobdmgjdcgefhijimiae)
[![CI](https://github.com/ragustingarcia/el-organizador/actions/workflows/ci.yml/badge.svg)](https://github.com/ragustingarcia/el-organizador/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

## Instalación

La versión publicada está en [Chrome Web Store](https://chromewebstore.google.com/detail/el-organizador/laaakmnbceahaobdmgjdcgefhijimiae). El código de esta rama prepara la versión **1.4.0**; su presencia en GitHub no implica que esa versión ya esté publicada en la tienda.

Para desarrollo (Node 22 actualizado):

```bash
npm ci
npm test
npm run lint
npm run build
```

En Chrome 114 o posterior, abrí `chrome://extensions/`, activá el modo de desarrollador y cargá la carpeta `dist/` como extensión sin empaquetar.

## Trabajos recuperables en 1.4

Los cambios se ejecutan en el service worker y siguen un registro persistente por favorito. Cerrar el panel no cancela el trabajo. Si el navegador o worker termina, se puede reanudar desde el panel: primero se compara el estado real con el esperado para evitar repetir cambios ya aplicados.

El panel ofrece pausa entre favoritos, recuperación de los elementos compatibles, historial de copias archivadas y exportación JSON del árbol. Los conflictos conservan su copia. El historial puede liberarse manualmente conservando las veinte copias más recientes; el trabajo activo se protege. Las carpetas nuevas se conservan, incluso si una interrupción deja ambiguo el resultado de crearlas.

## Organización y limpieza

1. Elegí una carpeta o todo el árbol. Por defecto, la clasificación usa solamente títulos y URLs locales.
2. Revisá las sugerencias. Las categorías desconocidas quedan en “Varios”, sin seleccionar; no se crea una carpeta por cada dominio. Las carpetas temáticas existentes se reutilizan y los favoritos ya clasificados no generan subcarpetas iguales.
3. Los duplicados se detectan por URL normalizada, conservando parámetros y fragmentos. Podés mover las copias que selecciones a “📥 Revisión Manual”. **No se elimina ningún marcador.**
4. El renombrado está desactivado por defecto. Si lo activás, solo quita espacios sobrantes y sufijos genéricos como “Home”, “Inicio” o “Sitio oficial”. Conserva segmentos descriptivos como “AWS | Services - S3”.
5. El detalle previo muestra los nombres y destinos que se aplicarán. La configuración queda fija hasta volver a escanear.
6. Antes de modificar favoritos se guarda una copia local. Podés deshacer la última limpieza, incluso si quedó incompleta. Para iniciar otra aplicación, primero deshacé la anterior o elegí conservar sus cambios y descartar esa copia.

Al escanear todo el árbol se conserva la raíz real de cada marcador (incluidas las raíces locales o de cuenta); no se presupone el identificador `1`. En una carpeta seleccionada, las nuevas categorías se crean dentro de ese ámbito. Las carpetas administradas no se editan. La recuperación conserva las carpetas nuevas vacías.

Las listas muestran 50 filas por página para mantener manejables bibliotecas grandes.

## Comprobación de enlaces opcional

“Verificar que los enlaces sigan vivos” y “Consultar metadatos web” contactan directamente los sitios guardados. Están desactivados por defecto. No se envían cookies ni referrer. Los metadatos solo se consultan al habilitar esa opción junto con la organización.

- Se comparten consultas por URL HTTP con una caché acotada a 1.000 resultados por escaneo; los fragmentos no se envían al servidor.
- HEAD se utiliza cuando no hacen falta metadatos. GET solo lo reemplaza si HEAD no es compatible (405/501).
- La lectura de HTML se limita a 60.000 bytes entregados al analizador y se cancela al alcanzar el límite o cerrar `head`. No se leen archivos binarios para clasificar.
- El plazo de ocho segundos cubre tanto cabeceras como cuerpo. El usuario puede cancelar.
- Las redirecciones no se siguen: su destino no se verifica y quedan para revisión. Un timeout o una redirección no se presentan como un enlace caído confirmado.
- Ningún resultado problemático se selecciona automáticamente para mover.

Las sugerencias muestran su evidencia y motivo. Solo se seleccionan automáticamente coincidencias fuertes sobre favoritos directamente contenidos en el ámbito elegido; se conservan las carpetas internas de proyectos. Las reglas personales de dominio exacto permiten elegir una carpeta existente por su identificador. Los duplicados se presentan agrupados para elegir cuál conservar y apartar las otras copias.

Las consultas a un mismo dominio se serializan; un 429 respeta una espera acotada derivada de Retry-After. La clasificación local se conserva aunque falle una consulta web.

## Vigía Mágico

Es opcional y clasifica localmente los favoritos nuevos. Las sugerencias se guardan como registros independientes por marcador, se muestran de a una y solo se retira la sugerencia aceptada o descartada. Durante una importación masiva se omiten sugerencias individuales; los importados se pueden revisar con un escaneo.

El botón de la extensión abre el panel. El Vigía no intenta abrirlo automáticamente sin un gesto del usuario.

## Seguridad y privacidad

Los permisos obligatorios son `bookmarks`, `sidePanel`, `storage` y el acceso HTTP/HTTPS se solicita como permiso opcional al activar consultas web. No hay servidor propio, analítica ni código remoto. React y React DOM se incluyen en el paquete; no se cargan desde una CDN.

El guard de URLs rechaza esquemas ajenos a HTTP/HTTPS, credenciales incrustadas, nombres locales y rangos IP locales/especiales conocidos. **El filtro no resuelve DNS ni garantiza bloquear DNS rebinding.** La opción local permite organizar sin consultar sitios web.

Las escrituras se serializan entre paneles con Web Locks, comprueban errores de Chrome y rechazan marcadores que cambiaron desde el escaneo. La recuperación aparta los conflictos en título, URL o carpeta y conserva la copia de los conflictos. Las APIs de Chrome no ofrecen una transacción atómica frente a cambios externos o sincronización concurrente.

Consultá la [implementación y límites de 1.4](./docs/ROBUSTEZ-1.4.md), la [política de privacidad](./PRIVACY_POLICY.md), el [informe de auditoría](./docs/AUDITORIA-1.4.0.md) y el [registro de cambios](./CHANGELOG.md).

## Arquitectura

- `src/App.tsx`: configuración, selección, vista previa y recuperación.
- `src/background.ts`: panel lateral y cola del Vigía.
- `src/utils/scanner.ts`: consultas limitadas, cancelación y caché de un escaneo.
- `src/utils/classifier.ts`: categorías con reglas locales y límites de palabra.
- `src/utils/change-plan.ts`: duplicados y plan explícito de cambios.
- `src/utils/recovery.ts`: validación, aplicación y recuperación persistida.
- `src/utils/bookmarks.ts`: lectura del árbol y exclusión de contenido administrado.
- `src/components/PagedList.tsx`: presentación paginada.

## Licencia y autor

[MIT](./LICENSE). **Rodolfo Agustín García** ([@ragustingarcia](https://github.com/ragustingarcia)) — [ragustingarcia.com](https://ragustingarcia.com/).
