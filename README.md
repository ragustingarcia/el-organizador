# 🧙‍♂️ El Organizador

**Tu mago de favoritos.** Audita, limpia y reorganiza tus marcadores de Chrome desde un side panel con estética mágica.

Convierte una pila caótica de bookmarks en una biblioteca organizada y mantenida.

---

## Funcionalidades

### 🔮 Escaneo profundo
Seleccioná una carpeta (o todo el árbol) y el mago analiza cada marcador:
- **Validación de enlaces** — Verifica que cada URL siga viva con fallback HEAD → GET. Detecta redirects comparando la URL final. Marca como "dudoso" lo que no puede confirmar (nunca borra por error).
- **Limpieza de títulos** — Acorta títulos con separadores comunes (" - ", " | ", " : ") quedándose con el segmento más significativo.
- **Organización inteligente** — Clasifica cada bookmark por su URL, título y metadatos de la página (title + meta description) en carpetas temáticas. Las sugerencias son editables antes de aplicar.

### 📥 Revisión manual
Los enlaces rotos, con timeout o dudosos se agrupan para que decidas qué hacer. Podés moverlos a una carpeta "📥 Revisión Manual" con un clic.

### 👁️ Vigía Mágico
Modo opcional que mantiene al mago "despierto". Cada vez que guardás un nuevo favorito:
1. El service worker detecta el evento `bookmarks.onCreated`
2. Clasifica la URL y sugiere un nombre corto + carpeta destino
3. Te muestra la sugerencia en el side panel para que la aceptes, edites o descartes

### 🪄 Aplicación asistida
Nada se ejecuta sin tu confirmación. Revisás los resultados, ajustás lo que quieras, y recién ahí "conjurás" los cambios.

---

## Instalación (desarrollo local)

```bash
git clone https://github.com/ragustingarcia/el-organizador.git
cd el-organizador
npm install
npm run build
```

Luego en Chrome:
1. Abrí `chrome://extensions/`
2. Activá **Modo de desarrollador** (toggle arriba a la derecha)
3. Clic en **Cargar extensión sin empaquetar**
4. Seleccioná la carpeta `dist/`

Para desarrollo con hot reload: `npm run dev` y cargá la carpeta raíz del proyecto (apuntando al `index.html` de desarrollo).

---

## Arquitectura

```
public/
├── manifest.json              # Manifest V3 con permisos bookmarks, sidePanel, storage
├── background.js              # Service worker: side panel + Vigía Mágico
└── icons/                     # Iconos 16, 48, 128px

src/
├── App.tsx                    # Orquestador con state machine + integración Vigía
├── main.tsx                   # Entry point React
├── components/
│   ├── ScanConfig.tsx         # Selector de carpeta + opciones de conjuros
│   ├── ProgressBar.tsx        # Barra de progreso con gradiente mágico
│   ├── ResultsPanel.tsx       # Panel de resultados (compone Review + Organize)
│   ├── ReviewList.tsx         # Lista de enlaces problemáticos
│   ├── OrganizeList.tsx       # Sugerencias de carpetas editables
│   └── SuggestionCard.tsx     # Card del Vigía para nuevos favoritos
├── utils/
│   ├── bookmarks.ts           # Chrome Bookmarks API (getSubTree para filtrado por ID)
│   ├── scanner.ts             # Fetch unificado: salud + clasificación en 1 request
│   ├── classifier.ts          # Reglas genéricas de clasificación por keywords
│   ├── modifier.ts            # CRUD de bookmarks (move, rename, create folder)
│   ├── pool.ts                # Pool de concurrencia con cancelación via AbortController
│   └── url-guard.ts           # Sanitización de URLs (bloquea IPs privadas, chrome://)
└── styles/
    └── app.css                # Tema mago: púrpura + dorado, dark/light mode
```

---

## Stack técnico

- **React 19** + **TypeScript 5.9** + **Vite 8**
- **Chrome Extension Manifest V3** (side panel API)
- **chrome.storage.local** para persistir estado del Vigía
- Sin dependencias externas de runtime (0 libs adicionales)

---

## Permisos y seguridad

| Permiso | Justificación |
|---|---|
| `bookmarks` | Leer, mover y renombrar marcadores |
| `sidePanel` | Interfaz principal de la extensión |
| `storage` | Persistir estado del Vigía Mágico entre sesiones |
| `<all_urls>` (host) | Verificar el estado HTTP de cualquier URL guardada en los marcadores del usuario |

### Medidas de seguridad
- **URL guard** (`url-guard.ts`): bloquea fetch a `file://`, `chrome://`, `chrome-extension://`, localhost, y rangos de IP privada (127.x, 10.x, 192.168.x, 172.16-31.x) antes de cualquier request.
- **CSP explícito** en el manifest: `script-src 'self'; object-src 'self'`.
- **Todas las llamadas** a `chrome.bookmarks.*` verifican `chrome.runtime.lastError`.
- **Exclusión mutua** entre "mover a revisión" y "mover a carpeta sugerida" — nunca se ejecutan ambos sobre el mismo bookmark.
- **Sin keywords personales** en el clasificador — solo reglas genéricas aptas para cualquier usuario.

---

## Publicación en Chrome Web Store

### Requisitos previos
1. Cuenta de desarrollador configurada (one-time fee de USD 5)
2. **Privacy policy** publicada en una URL pública (requerida por `<all_urls>`)
3. Al menos **1 screenshot** de 1280x800 o 640x400
4. **Ícono del store** de 128x128 (ya incluido en `public/icons/`)

### Pasos
1. `npm run build`
2. Comprimir la carpeta `dist/` como ZIP
3. En el [Developer Dashboard](https://chrome.google.com/webstore/devconsole), ir a **Elementos** → **Nuevo elemento**
4. Subir el ZIP
5. Completar la ficha: nombre, descripción, categoría (Productividad), screenshots
6. En la sección de permisos, justificar `host_permissions` con:
   > "La extensión necesita realizar peticiones HTTP (HEAD/GET) a las URLs almacenadas en los marcadores del usuario para verificar si los enlaces siguen activos. No se recolectan ni transmiten datos del usuario."
7. Enviar a revisión

---

## Licencia

MIT

---

## Autor

**ragustingarcia** — [Chrome Web Store Developer](https://chrome.google.com/webstore/devconsole)