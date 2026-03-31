# Política de Privacidad — El Organizador

**Última actualización:** 31 de marzo de 2026

## Resumen

El Organizador es una extensión de Chrome que audita, limpia y reorganiza los marcadores del usuario. **No recolecta, almacena ni transmite datos personales.**

## Datos que accede la extensión

La extensión accede exclusivamente a:

- **Marcadores del navegador** (vía `chrome.bookmarks`): para leer títulos y URLs, mover marcadores entre carpetas, y renombrar títulos. Estos datos nunca salen del navegador del usuario.
- **Contenido web de las URLs guardadas** (vía `fetch`): para verificar si los enlaces siguen activos y extraer metadatos de la página (título y descripción) con fines de clasificación. Estas peticiones HTTP se realizan directamente desde el navegador del usuario hacia los sitios web correspondientes, sin pasar por ningún servidor intermediario.
- **Almacenamiento local** (vía `chrome.storage.local`): para guardar la preferencia del modo "Vigía Mágico" (activado/desactivado) y sugerencias temporales para nuevos marcadores. Estos datos se almacenan exclusivamente en el dispositivo del usuario.

## Datos que NO recolecta la extensión

- No recolecta información personal identificable.
- No recolecta historial de navegación.
- No recolecta credenciales, contraseñas ni datos financieros.
- No utiliza cookies ni tecnologías de rastreo.
- No transmite datos a servidores externos, servicios de terceros ni plataformas de análisis.
- No contiene publicidad.

## Permisos y su justificación

| Permiso | Uso |
|---|---|
| `bookmarks` | Leer, mover y renombrar los marcadores del usuario |
| `sidePanel` | Mostrar la interfaz de la extensión en el panel lateral de Chrome |
| `storage` | Guardar localmente la preferencia del Vigía Mágico |
| `<all_urls>` (host) | Realizar peticiones HTTP a las URLs almacenadas en los marcadores para verificar su estado |

## Seguridad

- La extensión bloquea automáticamente peticiones a URLs con esquemas no seguros (`file://`, `chrome://`, `data://`), direcciones IP privadas y localhost.
- Incluye una Content Security Policy explícita que restringe la ejecución de scripts al código propio de la extensión.

## Cambios a esta política

Si se realizan cambios a esta política de privacidad, se actualizará este documento con la nueva fecha. La extensión no tiene mecanismo de notificación de cambios; se recomienda revisar esta página periódicamente.

## Contacto

Para consultas sobre privacidad, podés abrir un issue en el repositorio:
https://github.com/ragustingarcia/el-organizador/issues
