// src/App.tsx

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getBookmarks,
  getBookmarkFolders,
  type AnalyzedBookmark,
  type BookmarkFolder,
} from './utils/bookmarks';
import { createBookmarkScanner, type ScanOptions } from './utils/scanner';
import { poolMap } from './utils/pool';
import { buildChangePlan, markDuplicates } from './utils/change-plan';
import { loadRecovery, listHistory, type Recovery } from './utils/recovery';
import { runJob } from './utils/jobs-client';
import ScanConfig, { type ScanActions } from './components/ScanConfig';
import DomainRules from './components/DomainRules';
import PagedList from './components/PagedList';
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
    validateLinks: false,
    renameTitles: false,
    enrichMetadata: false,
    organize: 'suggest_folders',
  });

  const [selection, setSelection] = useState({ review: new Set<string>(), move: new Set<string>() });
  const selectedForReview = selection.review;
  const selectedForMove = selection.move;

  // Vigía state
  const [vigiaEnabled, setVigiaEnabled] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);

  const [recovery, setRecovery] = useState<Recovery | null>(null);
  const [history, setHistory] = useState<{ key: string; createdAt: number; count: number }[]>([]);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const refreshRecovery = useCallback(async () => {
    try { setRecovery(await loadRecovery()); setHistory(await listHistory()); setRecoveryReady(true); }
    catch { setRecoveryReady(false); setError('No se pudo leer la copia de recuperación.'); }
  }, []);

  // ---- Init ----

  useEffect(() => {
    getBookmarkFolders().then(setFolders).catch(() => setError('No se pudieron leer las carpetas.'));
    void refreshRecovery();

    // Load Vigía status
    chrome.runtime.sendMessage({ type: 'GET_VIGIA_STATUS' }, (res) => {
      if (chrome.runtime.lastError || res?.error) { setError('No se pudo leer el estado de Vigía.'); return; }
      if (res?.enabled) setVigiaEnabled(true);
    });

    // Check for pending suggestion
    const refreshSuggestion = () => chrome.runtime.sendMessage({ type: 'GET_SUGGESTIONS' }, response => {
      if (chrome.runtime.lastError || response?.error) { setError('No se pudieron leer las sugerencias.'); return; }
      setSuggestion(response?.suggestions?.[0] ?? null);
    });
    refreshSuggestion();

    // Listen for new suggestions while panel is open
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string,
    ) => {
      if (area === 'local' && Object.keys(changes).some(key => key.startsWith('suggestion:') || key.startsWith('pendingSuggestion'))) refreshSuggestion();
      if (area === 'local' && changes.vigiaEnabled) setVigiaEnabled(!!changes.vigiaEnabled.newValue);
      if (area === 'local' && changes.recoverySnapshot) {
        setRecovery((changes.recoverySnapshot.newValue as Recovery | undefined) ?? null);
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => { chrome.storage.onChanged.removeListener(listener); abortRef.current?.abort(); };
  }, [refreshRecovery]);

  // ---- Vigía toggle ----

  const toggleVigia = useCallback(() => {
    const next = !vigiaEnabled;
    chrome.runtime.sendMessage({ type: 'SET_VIGIA_STATUS', enabled: next }, res => {
      if (chrome.runtime.lastError || res?.error) { setError('No se pudo cambiar el estado de Vigía.'); return; }
      setVigiaEnabled(next);
    });
  }, [vigiaEnabled]);

  // ---- Suggestion handlers ----

  const handleAcceptSuggestion = useCallback(
    async (bookmarkId: string, newTitle: string, folderName: string) => {
      if (busyRef.current || !suggestion) return;
      busyRef.current = true;
      setPhase('applying');
      setError(null);
      try {
        const [node] = await chrome.bookmarks.get(bookmarkId);
        if (!node || node.url !== suggestion.originalUrl || node.title !== suggestion.originalTitle || node.parentId !== suggestion.parentId) {
          throw new Error('El favorito cambió. Descartá esta sugerencia y volvé a escanear.');
        }
        await runJob('apply', [{
          bookmark: { id: node.id, originalTitle: node.title, originalUrl: node.url!, originalPath: [], originalParentId: node.parentId, healthStatus: 'pending' },
          title: newTitle || node.title, folder: folderName || undefined, targetParentId: suggestion.parentId,
        }]);
        await chrome.runtime.sendMessage({ type: 'CLEAR_SUGGESTION', id: bookmarkId });
        setBookmarks([]);
        setFolders(await getBookmarkFolders());
        setPhase('done');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo aplicar la sugerencia.');
        setPhase('idle');
      } finally {
        busyRef.current = false;
        await refreshRecovery();
      }
    },
    [suggestion, refreshRecovery],
  );

  const handleDismissSuggestion = useCallback(() => {
    if (!suggestion || busyRef.current) return;
    chrome.runtime.sendMessage({ type: 'CLEAR_SUGGESTION', id: suggestion.id }, res => {
      if (chrome.runtime.lastError || res?.error) setError('No se pudo descartar la sugerencia.');
    });
  }, [suggestion]);

  // ---- Toggle helpers (mutual exclusion) ----

  const toggleReview = useCallback((id: string) => {
    setSelection(previous => {
      const review = new Set(previous.review), move = new Set(previous.move);
      if (review.has(id)) review.delete(id); else { review.add(id); move.delete(id); }
      return { review, move };
    });
  }, []);

  const toggleMove = useCallback((id: string) => {
    setSelection(previous => {
      const review = new Set(previous.review), move = new Set(previous.move);
      if (move.has(id)) move.delete(id); else { move.add(id); review.delete(id); }
      return { review, move };
    });
  }, []);

  const updateSuggestedFolder = useCallback((id: string, folder: string) => {
    setBookmarks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, suggestedFolder: folder, suggestedFolderId: undefined } : b)),
    );
  }, []);

  // ---- Scan ----

  const handleScan = async () => {
    if (busyRef.current) return;
    const permission = actions.validateLinks || (actions.organize === 'suggest_folders' && actions.enrichMetadata)
      ? chrome.permissions.request({ origins: ['http://*/*', 'https://*/*'] }) : Promise.resolve(true);
    busyRef.current = true;
    setPhase('scanning');
    setError(null);
    setBookmarks([]);
    setSelection({ review: new Set(), move: new Set() });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      if (!await permission) throw new Error('Permiso web denegado. Desactivá las consultas web para organizar localmente.');
      const flatList = await getBookmarks(selectedFolderId);
      controller.signal.throwIfAborted();
      setProgress({ current: 0, total: flatList.length });

      if (flatList.length === 0) {
        setBookmarks([]);
        setPhase('scanned');
        return;
      }

      const scanOpts: ScanOptions = {
        validateLinks: actions.validateLinks,
        organize: actions.organize === 'suggest_folders',
        enrichMetadata: actions.enrichMetadata,
      };

      const scan = createBookmarkScanner(scanOpts, controller.signal);
      const scanned = await poolMap(
        flatList,
        async (bm) => {
          const result = await scan(bm);
          return { ...bm, ...result };
        },
        CONCURRENCY,
        (done, total) => setProgress({ current: done, total }),
        controller.signal,
      );

      const { organizationRules = {} } = await chrome.storage.local.get<{ organizationRules?: Record<string, string> }>('organizationRules');
      const results = markDuplicates(scanned.map(bookmark => {
        let host = ''; try { host = new URL(bookmark.originalUrl).hostname; } catch { /* invalid bookmark */ }
        const target = folders.find(folder => folder.id === organizationRules[host]);
        return target ? { ...bookmark, suggestedFolder: target.title, suggestedFolderId: target.id, classificationConfidence: 'high' as const, classificationReason: 'Regla personal para este dominio exacto.' } : bookmark;
      }));
      const reviewSet = new Set<string>();
      const moveSet = new Set<string>();

      // A bookmark only has a trustworthy healthStatus if some fetch actually
      // happened (requested validation, or organize needed the page body).
      // With neither flag on (e.g. only "acortar títulos"), nothing was
      // checked, so nothing should land in "para revisión".
      const wasChecked = scanOpts.validateLinks || (scanOpts.organize && scanOpts.enrichMetadata);

      for (const bm of results) {
        if (wasChecked && ['dead', 'timeout', 'unverified', 'blocked', 'redirected'].includes(bm.healthStatus)) {
          // Uncertain results are shown for review, never selected automatically.
        } else if (bm.suggestedFolder && bm.classificationConfidence === 'high' && (bm.suggestedFolderId || bm.originalParentId === (selectedFolderId === 'all' ? bm.rootId : selectedFolderId)) && bm.suggestedFolder !== '📁 Varios' && !bm.duplicateOf && !bm.originalPath.includes('📥 Revisión Manual')) {
          moveSet.add(bm.id);
        }
      }

      setBookmarks(results);
      setSelection({ review: reviewSet, move: moveSet });
      setPhase('scanned');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setPhase('idle');
        return;
      }
      console.error('[El Organizador] Scan error:', err);
      setError(err instanceof Error ? err.message : 'Error durante el escaneo.');
      setPhase('idle');
    } finally {
      abortRef.current = null;
      busyRef.current = false;
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  // ---- Apply ----

  const plan = buildChangePlan(bookmarks, selectedForReview, selectedForMove, actions.renameTitles, selectedFolderId, folders);

  const handleApply = async () => {
    if (busyRef.current || !plan.length) return;
    if (!window.confirm(`¿Aplicar cambios a ${plan.length} favoritos? Se guardará una copia local para deshacer.`)) return;
    busyRef.current = true;
    setPhase('applying');
    setError(null);
    try {
      await runJob('apply', plan);
      setFolders(await getBookmarkFolders());
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la limpieza.');
      setPhase('scanned');
    } finally {
      busyRef.current = false;
      await refreshRecovery();
    }
  };

  const handleRestore = async () => {
    if (busyRef.current || !window.confirm('¿Deshacer la última limpieza? Se conservarán los cambios posteriores que entren en conflicto.')) return;
    busyRef.current = true;
    setPhase('applying');
    setError(null);
    try {
      await runJob('restore');
      setBookmarks([]);
      setFolders(await getBookmarkFolders());
      setPhase('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la recuperación.');
      setPhase('idle');
    } finally {
      busyRef.current = false;
      await refreshRecovery();
    }
  };

  // ---- Derived ----

  const isLocked = phase === 'scanning' || phase === 'applying';
  const hasChanges = plan.length > 0;

  // ---- Render ----

  return (
    <div className="app">
      {/* Header */}
      <div className="app-header">
        <span className="app-header__icon">🧙‍♂️</span>
        <h1>El Organizador</h1>
        <p>Tu mago de favoritos</p>
      </div>

      <div className="card">
        <button className="btn btn--ghost" onClick={async () => {
          try {
            const tree = await chrome.bookmarks.getTree();
            const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, createdAt: Date.now(), tree }, null, 2)], { type: 'application/json' }));
            const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'el-organizador-respaldo.json'; anchor.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          } catch { setError('No se pudo exportar el respaldo.'); }
        }}>Exportar respaldo de favoritos (JSON)</button>
        {history.length > 20 && <button className="btn btn--ghost" disabled={isLocked} onClick={async () => {
          if (!window.confirm('¿Eliminar las copias archivadas más antiguas y conservar las 20 más recientes? El trabajo activo se conserva.')) return;
          try { const response = await chrome.runtime.sendMessage({ type: 'BOOKMARK_JOB', action: 'prune' }); if (response?.error) throw new Error(response.error); await refreshRecovery(); }
          catch (error) { setError(String(error)); }
        }}>Liberar historial: conservar 20 copias</button>}
        {!recovery && history.length > 0 && <select className="select" aria-label="Historial de limpieza" defaultValue="" disabled={isLocked} onChange={async event => {
          const key = event.target.value; if (!key) return;
          try { const response = await chrome.runtime.sendMessage({ type: 'BOOKMARK_JOB', action: 'reopen', key }); if (response?.error) throw new Error(response.error); await refreshRecovery(); }
          catch (error) { setError(String(error)); }
        }}><option value="">Revisar copia anterior…</option>{history.map(item => <option key={item.key} value={item.key}>{new Date(item.createdAt).toLocaleString()} · {item.count} favoritos</option>)}</select>}
      </div>
      {recovery && (
        <div className="card">
          <p>Hay una copia local de limpieza ({recovery.entries.length} favoritos). Las carpetas nuevas vacías se conservan al deshacer.</p>
          {recovery.journal && <button className="btn btn--ghost" disabled={isLocked} onClick={async () => {
            if (busyRef.current) return;
            busyRef.current = true; setPhase('applying'); setError(null);
            try { await runJob('resume'); setBookmarks([]); setPhase('done'); }
            catch (error) { setError(String(error)); setPhase('idle'); }
            finally { busyRef.current = false; await refreshRecovery(); }
          }}>Reanudar trabajo interrumpido</button>}
          <button className="btn btn--ghost" disabled={isLocked} onClick={handleRestore}>Deshacer última limpieza</button>
          <button className="btn btn--ghost" disabled={isLocked} onClick={async () => {
            if (!window.confirm('¿Conservar los cambios y archivar la copia para deshacer?')) return;
            try { await runJob('archive'); setRecovery(null); } catch { setError('No se pudo descartar la copia.'); }
          }}>Conservar cambios y archivar copia</button>
        </div>
      )}

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
            disabled={isLocked}
            onChange={toggleVigia}
          />
          <span className="toggle__track" />
          <span className="toggle__thumb" />
        </label>
      </div>

      {/* Suggestion from Vigía */}
      {suggestion && (
        <SuggestionCard
          key={suggestion.id}
          disabled={isLocked || !!recovery || !recoveryReady}
          suggestion={suggestion}
          onAccept={handleAcceptSuggestion}
          onDismiss={handleDismissSuggestion}
        />
      )}

      <DomainRules folders={folders} disabled={isLocked} />
      {/* Config */}
      <ScanConfig
        folders={folders}
        selectedFolderId={selectedFolderId}
        actions={actions}
        disabled={isLocked || phase === 'scanned' || phase === 'done'}
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

      {phase === 'scanned' && <button className="btn btn--ghost mb-20" onClick={() => { setBookmarks([]); setPhase('idle'); }}>Cambiar configuración y volver a escanear</button>}

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
            showNetwork={actions.validateLinks || (actions.organize === 'suggest_folders' && actions.enrichMetadata)}
            selectedForReview={selectedForReview}
            selectedForMove={selectedForMove}
            onKeepDuplicate={(ids, keeper) => setSelection(previous => {
              const review = new Set(previous.review), move = new Set(previous.move);
              for (const id of ids) { move.delete(id); if (id === keeper) review.delete(id); else review.add(id); }
              return { review, move };
            })}
            onToggleReview={toggleReview}
            onToggleMove={toggleMove}
            onFolderChange={updateSuggestedFolder}
          />

          <div className="card card--gold" style={{ marginBottom: '40px' }}>
            <p>{plan.length} favoritos con cambios. Revisá el detalle antes de aplicar.</p>
            <PagedList items={plan} renderItem={change => <div className="list-item" key={change.bookmark.id}>
                <p className="list-item__title">{change.bookmark.originalTitle}</p>
                <span className="list-item__url">{change.bookmark.originalUrl}</span>
                {change.title !== change.bookmark.originalTitle && <p>Nombre: {change.title}</p>}
                {change.destinationId && <p>Destino: {folders.find(folder => folder.id === change.destinationId)?.fullPath}</p>}
                {change.folder && <p>Destino: {folders.find(f => f.id === change.targetParentId)?.fullPath} &gt; {change.folder}</p>}
              </div>} />
            <button
              className="btn btn--conjure"
              disabled={!hasChanges || !!recovery || !recoveryReady}
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
                No hay cambios seleccionados para aplicar.
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
            <button className="btn btn--ghost" onClick={() => { void runJob('pause').catch(error => setError(String(error))); }}>Pausar después del favorito actual</button>
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
            Se aplicaron los cambios seleccionados. Podés deshacerlos desde la copia local.
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
