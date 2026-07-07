// src/App.tsx

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getBookmarks,
  getBookmarkFolders,
  type AnalyzedBookmark,
  type BookmarkFolder,
} from './utils/bookmarks';
import { scanBookmark, type ScanOptions } from './utils/scanner';
import { poolMap } from './utils/pool';
import {
  findOrCreateFolder,
  moveBookmark,
  updateBookmarkTitle,
  suggestShortTitle,
} from './utils/modifier';
import ScanConfig, { type ScanActions } from './components/ScanConfig';
import ProgressBar from './components/ProgressBar';
import ResultsPanel from './components/ResultsPanel';
import SuggestionCard, { type Suggestion } from './components/SuggestionCard';

const CONCURRENCY = 4;

type Phase = 'idle' | 'scanning' | 'scanned' | 'applying' | 'done';

export default function App() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [folders, setFolders] = useState<BookmarkFolder[]>([]);
  const [bookmarks, setBookmarks] = useState<AnalyzedBookmark[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  const [selectedFolderId, setSelectedFolderId] = useState('all');
  const [actions, setActions] = useState<ScanActions>({
    validateLinks: true,
    renameTitles: true,
    organize: 'suggest_folders',
  });

  const [selectedForReview, setSelectedForReview] = useState<Set<string>>(new Set());
  const [selectedForMove, setSelectedForMove] = useState<Set<string>>(new Set());

  // Vigía state
  const [vigiaEnabled, setVigiaEnabled] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // ---- Init ----

  useEffect(() => {
    getBookmarkFolders().then(setFolders);

    // Load Vigía status
    chrome.runtime.sendMessage({ type: 'GET_VIGIA_STATUS' }, (res) => {
      if (res?.enabled) setVigiaEnabled(true);
    });

    // Check for pending suggestion
    chrome.storage.local.get(['pendingSuggestion'], (data) => {
      if (data.pendingSuggestion) {
        setSuggestion(data.pendingSuggestion as Suggestion);
      }
    });

    // Listen for new suggestions while panel is open
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string,
    ) => {
      if (area === 'local' && changes.pendingSuggestion?.newValue) {
        setSuggestion(changes.pendingSuggestion.newValue as Suggestion);
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  // ---- Vigía toggle ----

  const toggleVigia = useCallback(() => {
    const next = !vigiaEnabled;
    setVigiaEnabled(next);
    chrome.runtime.sendMessage({ type: 'SET_VIGIA_STATUS', enabled: next });
  }, [vigiaEnabled]);

  // ---- Suggestion handlers ----

  const handleAcceptSuggestion = useCallback(
    async (bookmarkId: string, newTitle: string, folderName: string) => {
      try {
        // Rename the bookmark
        if (newTitle) {
          await updateBookmarkTitle(bookmarkId, newTitle);
        }

        // Move to suggested folder (create it under Bookmarks Bar if needed)
        if (folderName) {
          const folderId = await findOrCreateFolder(folderName, '1');
          await moveBookmark(bookmarkId, folderId);
        }

        // Clear suggestion
        chrome.runtime.sendMessage({ type: 'CLEAR_SUGGESTION' });
        setSuggestion(null);

        // Refresh folders
        const updated = await getBookmarkFolders();
        setFolders(updated);
      } catch (err) {
        console.error('[Vigía] Apply error:', err);
      }
    },
    [],
  );

  const handleDismissSuggestion = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'CLEAR_SUGGESTION' });
    setSuggestion(null);
  }, []);

  // ---- Toggle helpers (mutual exclusion) ----

  const toggleReview = useCallback((id: string) => {
    setSelectedForReview((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        setSelectedForMove((m) => {
          if (m.has(id)) { const n = new Set(m); n.delete(id); return n; }
          return m;
        });
      }
      return next;
    });
  }, []);

  const toggleMove = useCallback((id: string) => {
    setSelectedForMove((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        setSelectedForReview((r) => {
          if (r.has(id)) { const n = new Set(r); n.delete(id); return n; }
          return r;
        });
      }
      return next;
    });
  }, []);

  const updateSuggestedFolder = useCallback((id: string, folder: string) => {
    setBookmarks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, suggestedFolder: folder } : b)),
    );
  }, []);

  // ---- Scan ----

  const handleScan = async () => {
    setPhase('scanning');
    setError(null);
    setBookmarks([]);
    setSelectedForReview(new Set());
    setSelectedForMove(new Set());

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const flatList = await getBookmarks(selectedFolderId);
      setProgress({ current: 0, total: flatList.length });

      if (flatList.length === 0) {
        setBookmarks([]);
        setPhase('scanned');
        return;
      }

      const scanOpts: ScanOptions = {
        validateLinks: actions.validateLinks,
        organize: actions.organize === 'suggest_folders',
      };

      const results = await poolMap(
        flatList,
        async (bm) => {
          const result = await scanBookmark(bm, scanOpts, controller.signal);
          return { ...bm, ...result };
        },
        CONCURRENCY,
        (done, total) => setProgress({ current: done, total }),
        controller.signal,
      );

      const reviewSet = new Set<string>();
      const moveSet = new Set<string>();

      // A bookmark only has a trustworthy healthStatus if some fetch actually
      // happened (requested validation, or organize needed the page body).
      // With neither flag on (e.g. only "acortar títulos"), nothing was
      // checked, so nothing should land in "para revisión".
      const wasChecked = scanOpts.validateLinks || scanOpts.organize;

      for (const bm of results) {
        if (wasChecked && ['dead', 'timeout', 'unverified', 'blocked'].includes(bm.healthStatus)) {
          reviewSet.add(bm.id);
        } else if (bm.suggestedFolder) {
          moveSet.add(bm.id);
        }
      }

      setBookmarks(results);
      setSelectedForReview(reviewSet);
      setSelectedForMove(moveSet);
      setPhase('scanned');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setPhase('idle');
        return;
      }
      console.error('[El Organizador] Scan error:', err);
      setError('Error durante el escaneo. Revisá la consola para más detalles.');
      setPhase('idle');
    } finally {
      abortRef.current = null;
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  // ---- Apply ----

  const handleApply = async () => {
    if (!window.confirm('¿Conjurar los cambios sobre tus marcadores?')) return;

    setPhase('applying');
    setError(null);

    try {
      const targetParentId = selectedFolderId === 'all' ? '1' : selectedFolderId;

      let revisionFolderId = '';
      if (selectedForReview.size > 0) {
        revisionFolderId = await findOrCreateFolder(
          '📥 Revisión Manual',
          targetParentId,
        );
      }

      for (const bm of bookmarks) {
        if (selectedForReview.has(bm.id) && revisionFolderId) {
          await moveBookmark(bm.id, revisionFolderId);
          continue;
        }

        if (selectedForMove.has(bm.id) && bm.suggestedFolder) {
          const folderId = await findOrCreateFolder(
            bm.suggestedFolder,
            targetParentId,
          );
          await moveBookmark(bm.id, folderId);
        }

        // Renaming is a local text transform — it doesn't depend on the
        // link's health. Bookmarks sent to manual review already hit the
        // `continue` above, so anything reaching this line is fair game.
        if (actions.renameTitles) {
          const shorter = suggestShortTitle(bm.originalTitle);
          if (shorter !== bm.originalTitle) {
            await updateBookmarkTitle(bm.id, shorter);
          }
        }
      }

      const updatedFolders = await getBookmarkFolders();
      setFolders(updatedFolders);
      setPhase('done');
    } catch (err) {
      console.error('[El Organizador] Apply error:', err);
      setError('Error al conjurar cambios. Algunos marcadores pueden no haberse movido.');
      setPhase('scanned');
    }
  };

  // ---- Derived ----

  const isLocked = phase === 'scanning' || phase === 'applying';
  const hasChanges =
    selectedForReview.size > 0 ||
    selectedForMove.size > 0 ||
    actions.renameTitles;

  // ---- Render ----

  return (
    <div className="app">
      {/* Header */}
      <div className="app-header">
        <span className="app-header__icon">🧙‍♂️</span>
        <h1>El Organizador</h1>
        <p>Tu mago de favoritos</p>
      </div>

      {/* Vigía toggle */}
      <div className={`vigia-row ${vigiaEnabled ? 'vigia-row--active' : ''}`}>
        <div style={{ flex: 1 }}>
          <div className="vigia-row__label">
            <span className="vigia-row__icon">{vigiaEnabled ? '👁️' : '😴'}</span>
            <span>Vigía Mágico</span>
          </div>
          <p style={{
            margin: '4px 0 0',
            fontSize: '11px',
            color: 'var(--text-tertiary)',
            lineHeight: '1.4',
          }}>
            {vigiaEnabled
              ? 'Observando. Cada favorito nuevo recibirá un nombre y carpeta sugeridos.'
              : 'Activalo para que el mago sugiera nombre y destino a cada nuevo favorito.'}
          </p>
        </div>
        <label className="toggle">
          <input
            type="checkbox"
            checked={vigiaEnabled}
            onChange={toggleVigia}
          />
          <span className="toggle__track" />
          <span className="toggle__thumb" />
        </label>
      </div>

      {/* Suggestion from Vigía */}
      {suggestion && (
        <SuggestionCard
          suggestion={suggestion}
          onAccept={handleAcceptSuggestion}
          onDismiss={handleDismissSuggestion}
        />
      )}

      {/* Config */}
      <ScanConfig
        folders={folders}
        selectedFolderId={selectedFolderId}
        actions={actions}
        disabled={isLocked}
        onFolderChange={setSelectedFolderId}
        onActionsChange={setActions}
      />

      {/* Scan / Cancel */}
      {phase === 'scanning' ? (
        <>
          <ProgressBar current={progress.current} total={progress.total} />
          <button className="btn btn--dismiss mb-20" onClick={handleCancel}>
            Cancelar escaneo
          </button>
        </>
      ) : phase !== 'done' ? (
        <button
          className="btn btn--spell mb-20"
          disabled={isLocked}
          onClick={handleScan}
        >
          Escanear 🔮
        </button>
      ) : null}

      {/* Error */}
      {error && (
        <div className="card" style={{ borderTop: '3px solid var(--danger)' }}>
          <p style={{ margin: 0, color: 'var(--danger-text)', fontSize: '13px' }}>
            {error}
          </p>
        </div>
      )}

      {/* Results */}
      {phase === 'scanned' && (
        <>
          <ResultsPanel
            bookmarks={bookmarks}
            showValidation={actions.validateLinks}
            showOrganize={actions.organize === 'suggest_folders'}
            selectedForReview={selectedForReview}
            selectedForMove={selectedForMove}
            onToggleReview={toggleReview}
            onToggleMove={toggleMove}
            onFolderChange={updateSuggestedFolder}
          />

          <div className="card card--gold" style={{ marginBottom: '40px' }}>
            <button
              className="btn btn--conjure"
              disabled={!hasChanges}
              onClick={handleApply}
            >
              🪄 Conjurar cambios
            </button>
            {!hasChanges && (
              <p
                style={{
                  margin: '8px 0 0',
                  fontSize: '12px',
                  color: 'var(--text-tertiary)',
                  textAlign: 'center',
                }}
              >
                Seleccioná al menos un marcador o activá el renombrado.
              </p>
            )}
          </div>
        </>
      )}

      {/* Applying */}
      {phase === 'applying' && (
        <div className="card card--gold">
          <p style={{ margin: 0, textAlign: 'center', color: 'var(--gold-text)', fontSize: '13px' }}>
            ✨ Conjurando cambios...
          </p>
        </div>
      )}

      {/* Done */}
      {phase === 'done' && (
        <div className="card card--success" style={{ textAlign: 'center' }}>
          <h3
            style={{
              margin: '0 0 6px',
              color: 'var(--success-text)',
              fontSize: '16px',
            }}
          >
            ✨ ¡Limpieza completada!
          </h3>
          <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--success-text)' }}>
            La biblioteca fue reorganizada con éxito.
          </p>
          <button
            className="btn btn--spell"
            onClick={() => {
              setPhase('idle');
              setBookmarks([]);
            }}
          >
            Volver a escanear 🔮
          </button>
        </div>
      )}
    </div>
  );
}
