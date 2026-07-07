# 🧙‍♂️ El Organizador

**Tu mago de favoritos.** Audita, limpia y reorganiza tus marcadores de Chrome desde un side panel con estética mágica.

Convierte una pila caótica de bookmarks en una biblioteca organizada y mantenida.

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/laaakmnbceahaobdmgjdcgefhijimiae?label=Chrome%20Web%20Store&logo=googlechrome&logoColor=white&color=4285F4)](https://chromewebstore.google.com/detail/el-organizador/laaakmnbceahaobdmgjdcgefhijimiae)
[![Rating](https://img.shields.io/chrome-web-store/rating/laaakmnbceahaobdmgjdcgefhijimiae?label=Rating&logo=googlechrome&logoColor=white&color=d4a843)](https://chromewebstore.google.com/detail/el-organizador/laaakmnbceahaobdmgjdcgefhijimiae)
[![CI](https://github.com/ragustingarcia/el-organizador/actions/workflows/ci.yml/badge.svg)](https://github.com/ragustingarcia/el-organizador/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

---

## Instalación

### Desde el Chrome Web Store (recomendado)

👉 [**Instalar El Organizador**](https://chromewebstore.google.com/detail/el-organizador/laaakmnbceahaobdmgjdcgefhijimiae)

### Desarrollo local

```bash
git clone https://github.com/ragustingarcia/el-organizador.git
cd el-organizador
npm install
npm run build
```

Luego en Chrome:
1. Abrí `chrome://extensions/`
2. Activá **Modo de desarrollador**
3. Clic en **Cargar extensión sin empaquetar**
4. Seleccioná la carpeta `dist/`

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

## Arquitectura

```
public/
├── manifest.json              # Manifest V3: bookmarks, sidePanel, storage
└── icons/                     # Iconos 16, 48, 128px

src/
├── App.tsx                    # Orquestador con state machine + integración Vigía
├── main.tsx                   # Entry point React
├── background.ts              # Service worker: side panel + Vigía Mágico
│                               # (bundle IIFE aparte, ver vite.background.config.ts;
│                               #  reusa classifier.ts/modifier.ts, no los duplica)
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

## Stack

- **React 19** + **TypeScript 5.9** + **Vite 8**
- **Chrome Extension Manifest V3** (side panel API)
- **chrome.storage.local** para persistencia del Vigía
- Sin dependencias de runtime (0 libs externas)

---

## Permisos y seguridad

| Permiso | Uso |
|---|---|
| `bookmarks` | Leer, mover y renombrar marcadores |
| `sidePanel` | Interfaz principal de la extensión |
| `storage` | Persistir estado del Vigía Mágico |
| `<all_urls>` (host) | Verificar estado HTTP de las URLs guardadas en marcadores |

### Medidas de seguridad
- **URL guard**: bloquea fetch a `file://`, `chrome://`, localhost, y rangos de IP privada antes de cualquier request.
- **CSP explícito**: `script-src 'self'; object-src 'self'`.
- **`chrome.runtime.lastError`** verificado en todas las llamadas a la API de bookmarks.
- **Exclusión mutua** entre "mover a revisión" y "mover a carpeta sugerida".
- **Sin keywords personales** en el clasificador — solo reglas genéricas.
- **No recolecta ni transmite datos del usuario.**

---

## Licencia

[MIT](./LICENSE)

---

## Autor

**Rodolfo Agustín García** ([@ragustingarcia](https://github.com/ragustingarcia)) — [ragustingarcia.com](https://ragustingarcia.com/)

🧙 [El Organizador en la Chrome Web Store](https://chromewebstore.google.com/detail/el-organizador/laaakmnbceahaobdmgjdcgefhijimiae)
