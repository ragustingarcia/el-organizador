# Política de privacidad — El Organizador

**Última actualización: 30 de octubre de 2026. Versión 1.3.0.**

## Uso de los marcadores

El Organizador lee títulos, URLs, carpetas y posiciones para ofrecer organización y limpieza. Los cambios se aplican después de que el usuario revise la propuesta y confirme. No elimina marcadores.

La clasificación y la detección de duplicados funcionan localmente, sin consultar sitios web, con la configuración inicial. La extensión no usa un servidor propio, analítica, publicidad ni modelos externos.

## Consultas web opcionales

Al habilitar la verificación de enlaces o la consulta de metadatos para clasificar, el navegador envía peticiones HTTP/HTTPS a los sitios guardados. Esos sitios reciben la dirección solicitada (incluidos sus parámetros), la dirección IP del usuario y los datos habituales de una conexión HTTP. Por eso no sería correcto afirmar que la extensión nunca transmite datos.

Estas peticiones omiten cookies y referrer y no incorporan una cuenta o contraseña del usuario. Las URLs con usuario o contraseña incrustados se rechazan. Las redirecciones no se siguen. Un límite de tiempo y lectura restringe los recursos utilizados. El contenido obtenido solo se usa durante el escaneo para verificar la respuesta y extraer texto de título o descripción; no se guarda en un servidor.

No se trata de una navegación autenticada: un sitio que requiere iniciar sesión puede responder 401/403 aunque su contenido no esté disponible para la extensión.

## Almacenamiento local

`chrome.storage.local` conserva:

- La preferencia de activación del Vigía.
- La cola de sugerencias pendientes, que contiene títulos, URLs y carpetas de los favoritos correspondientes.
- Una copia para deshacer la última aplicación, con títulos, URLs, identificadores de carpeta y posiciones anteriores y destinos previstos.

Los datos se guardan en el perfil del navegador. La extensión no los sube a un servidor. La propia sincronización de marcadores de Chrome, si el usuario la tiene habilitada, puede sincronizar las modificaciones realizadas a sus marcadores conforme a su configuración de Google.

La copia de recuperación se borra al completar la recuperación o al elegir “Conservar cambios y descartar copia”. Las sugerencias se retiran al aceptarlas, descartarlas o al recibir el evento de eliminación del marcador. Desactivar el Vigía detiene nuevas sugerencias; no descarta automáticamente las pendientes. Al desinstalar la extensión, el navegador elimina su almacenamiento local; la copia no es un respaldo permanente.

## Permisos

| Permiso | Finalidad |
|---|---|
| `bookmarks` | Leer, mover y renombrar los marcadores seleccionados; crear carpetas y restaurar cambios |
| `sidePanel` | Mostrar la interfaz en el panel lateral |
| `storage` | Mantener preferencias, sugerencias y la copia local de recuperación |
| `http://*/*`, `https://*/*` | Consultar los enlaces guardados cuando el usuario habilita funciones web |

No se utiliza acceso a archivos `file://`, historial de navegación, cookies ni credenciales del navegador. No hay content scripts inyectados en páginas web.

## Límites de protección

Un filtro sintáctico rechaza nombres locales y rangos IP locales/especiales conocidos antes de consultar. No inspecciona la resolución DNS y no constituye una garantía contra DNS rebinding. El modo local evita esas consultas. La política CSP limita scripts al código incluido en la extensión y bloquea objetos embebidos.

## Contacto y cambios

Las actualizaciones de esta política se publican en este documento. Podés consultar o informar un problema en [el repositorio](https://github.com/ragustingarcia/el-organizador/issues).

Desarrollado por [Rodolfo Agustín García](https://ragustingarcia.com/).
