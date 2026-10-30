// src/components/ScanConfig.tsx

import type { BookmarkFolder } from '../utils/bookmarks';

export type ScanActions = {
  validateLinks: boolean;
  renameTitles: boolean;
  enrichMetadata: boolean;
  organize: 'none' | 'suggest_folders';
};

type Props = {
  folders: BookmarkFolder[];
  selectedFolderId: string;
  actions: ScanActions;
  disabled: boolean;
  onFolderChange: (id: string) => void;
  onActionsChange: (actions: ScanActions) => void;
};

export default function ScanConfig({
  folders,
  selectedFolderId,
  actions,
  disabled,
  onFolderChange,
  onActionsChange,
}: Props) {
  return (
    <div className="card">
      <div className="mb-16">
        <label className="label" htmlFor="folder-select">
          ¿Qué territorio exploramos?
        </label>
        <select
          id="folder-select"
          className="select"
          value={selectedFolderId}
          onChange={(e) => onFolderChange(e.target.value)}
          disabled={disabled}
        >
          <option value="all">Todo el árbol de marcadores</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.fullPath}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-col gap-12">
        <span className="label">¿Qué conjuros preparamos?</span>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={actions.validateLinks}
            onChange={(e) =>
              onActionsChange({ ...actions, validateLinks: e.target.checked })
            }
            disabled={disabled}
          />
          Verificar que los enlaces sigan vivos
        </label>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={actions.renameTitles}
            onChange={(e) =>
              onActionsChange({ ...actions, renameTitles: e.target.checked })
            }
            disabled={disabled}
          />
          Acortar títulos largos (ej: quitando "- Home")
        </label>

        <label className="checkbox-row">
          <input type="checkbox" checked={actions.enrichMetadata} disabled={disabled || actions.organize === 'none'}
            onChange={e => onActionsChange({ ...actions, enrichMetadata: e.target.checked })} />
          Consultar metadatos web para clasificar (opcional)
        </label>
        <p className="sub-label">La clasificación usa títulos y URLs en tu dispositivo. Verificar enlaces o consultar metadatos contacta los sitios guardados, sin cookies. Las redirecciones quedan para revisión.</p>
        <div className="sub-option">
          <span className="sub-label">Organización de carpetas:</span>
          <select
            className="select select--sm"
            value={actions.organize}
            onChange={(e) =>
              onActionsChange({
                ...actions,
                organize: e.target.value as ScanActions['organize'],
              })
            }
            disabled={disabled}
          >
            <option value="none">Dejar los enlaces sanos donde están</option>
            <option value="suggest_folders">
              Sugerir y mover a carpetas lógicas
            </option>
          </select>
        </div>
      </div>
    </div>
  );
}
