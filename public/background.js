// background.js — El Organizador service worker
// Handles: side panel open + Vigía Mágico (new bookmark watcher)

// ---- Side panel ----
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error('[El Organizador] sidePanel:', err));

// ---- Vigía Mágico: New bookmark watcher ----

// Inline classifier rules (must be self-contained in service worker)
const RULES = [
  { folder: '💻 Desarrollo', keywords: ['github','gitlab','bitbucket','stackoverflow','stackexchange','npm','pypi','developer','programming','api docs','documentation','react','angular','vue','svelte','python','javascript','typescript','rust','docker','kubernetes','codepen','codesandbox','replit','devtools','vscode'] },
  { folder: '🎨 Diseño', keywords: ['figma','canva','dribbble','behance','sketch','adobe','design','ui/ux','prototype','mockup','icon','font','typography','color palette','illustration','wireframe'] },
  { folder: '📚 Lectura y Educación', keywords: ['course','curso','tutorial','learn','aprender','udemy','coursera','edx','khan academy','wikipedia','medium','blog','article','artículo','guide','guía','ebook'] },
  { folder: '🛠️ Herramientas', keywords: ['converter','compress','editor','online tool','calculator','generator','formatter','minifier','regex','json','pdf tool','image resize','file convert'] },
  { folder: '📰 Noticias y Medios', keywords: ['news','noticias','bbc','cnn','reuters','podcast','magazine','journal','diario','periódico'] },
  { folder: '🛒 Compras', keywords: ['amazon','ebay','mercadolibre','aliexpress','shop','store','tienda','buy','comprar','price','precio','deal','offer'] },
  { folder: '🎬 Entretenimiento', keywords: ['youtube','netflix','spotify','twitch','disney','hbo','reddit','movie','película','music','música','game','juego','stream','imdb'] },
  { folder: '💼 Trabajo', keywords: ['sharepoint','confluence','jira','asana','trello','slack','teams','notion','monday','project management','dashboard','report','reporte','crm','salesforce','hubspot'] },
  { folder: '☁️ Cloud y Servicios', keywords: ['aws','azure','gcloud','firebase','vercel','netlify','heroku','supabase','digitalocean','cloudflare','hosting','deploy'] },
  { folder: '📱 Social', keywords: ['twitter','x.com','facebook','instagram','linkedin','tiktok','threads','mastodon','bluesky'] },
  { folder: '💰 Finanzas', keywords: ['bank','banco','finance','finanzas','invest','inversión','crypto','trading','stock','bolsa','wallet','payment'] },
];

function classifyUrl(title, url) {
  const text = (title + ' ' + url).toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((kw) => text.includes(kw))) return rule.folder;
  }
  try {
    const domain = new URL(url).hostname.replace('www.', '').split('.')[0];
    if (domain && domain.length > 2 && !['app','docs','drive','mail','web'].includes(domain)) {
      return '📁 ' + domain.charAt(0).toUpperCase() + domain.slice(1);
    }
  } catch (_) { /* ignore */ }
  return '📁 Varios';
}

function suggestShortTitle(title) {
  if (!title) return 'Sin título';
  const separators = [' - ', ' | ', ' : ', ' • ', ' — '];
  let earliest = Infinity;
  let sep = '';
  for (const s of separators) {
    const idx = title.indexOf(s);
    if (idx !== -1 && idx < earliest) { earliest = idx; sep = s; }
  }
  if (sep) {
    const cleaned = title.split(sep)[0].trim();
    if (cleaned.length >= 3) return cleaned;
  }
  return title.trim();
}

// Listen for new bookmarks
chrome.bookmarks.onCreated.addListener((id, bookmark) => {
  // Only act on actual URLs, not folders
  if (!bookmark.url) return;

  chrome.storage.local.get(['vigiaEnabled'], (data) => {
    if (chrome.runtime.lastError || !data.vigiaEnabled) return;

    const suggestedTitle = suggestShortTitle(bookmark.title);
    const suggestedFolder = classifyUrl(bookmark.title, bookmark.url);

    const suggestion = {
      id: id,
      originalTitle: bookmark.title,
      originalUrl: bookmark.url,
      suggestedTitle: suggestedTitle,
      suggestedFolder: suggestedFolder,
      parentId: bookmark.parentId,
      timestamp: Date.now(),
    };

    // Store the suggestion for the side panel to pick up
    chrome.storage.local.set({ pendingSuggestion: suggestion }, () => {
      if (chrome.runtime.lastError) {
        console.error('[Vigía]', chrome.runtime.lastError.message);
        return;
      }
      // Try to open the side panel so the user sees the suggestion
      chrome.sidePanel.open({ windowId: undefined }).catch(() => {
        // Side panel might already be open, that's fine
      });
    });
  });
});

// Respond to messages from the side panel
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_VIGIA_STATUS') {
    chrome.storage.local.get(['vigiaEnabled'], (data) => {
      sendResponse({ enabled: !!data.vigiaEnabled });
    });
    return true; // async response
  }

  if (msg.type === 'SET_VIGIA_STATUS') {
    chrome.storage.local.set({ vigiaEnabled: msg.enabled }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.type === 'CLEAR_SUGGESTION') {
    chrome.storage.local.remove('pendingSuggestion', () => {
      sendResponse({ ok: true });
    });
    return true;
  }
});
