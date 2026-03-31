// src/components/SuggestionCard.tsx

import { useState } from 'react';

export type Suggestion = {
  id: string;
  originalTitle: string;
  originalUrl: string;
  suggestedTitle: string;
  suggestedFolder: string;
  parentId: string;
  timestamp: number;
};

type Props = {
  suggestion: Suggestion;
  onAccept: (id: string, title: string, folder: string) => void;
  onDismiss: () => void;
};

export default function SuggestionCard({ suggestion, onAccept, onDismiss }: Props) {
  const [title, setTitle] = useState(suggestion.suggestedTitle);
  const [folder, setFolder] = useState(suggestion.suggestedFolder);

  return (
    <div className="suggestion-card">
      <div className="suggestion-card__header">
        <span>🔮</span>
        <span>Nuevo favorito detectado</span>
      </div>

      {/* Original info */}
      <div className="suggestion-field">
        <span className="suggestion-field__label">Título original</span>
        <span className="suggestion-field__value">{suggestion.originalTitle}</span>
      </div>

      <div className="suggestion-field">
        <span className="suggestion-field__label">URL</span>
        <span className="suggestion-field__value">{suggestion.originalUrl}</span>
      </div>

      <hr className="divider" />

      {/* Editable suggestions */}
      <div className="suggestion-field">
        <label className="suggestion-field__label" htmlFor="sug-title">
          Nombre sugerido
        </label>
        <input
          id="sug-title"
          className="suggestion-field__input"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="suggestion-field">
        <label className="suggestion-field__label" htmlFor="sug-folder">
          Carpeta sugerida
        </label>
        <input
          id="sug-folder"
          className="suggestion-field__input"
          type="text"
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
        />
      </div>

      {/* Actions */}
      <div className="suggestion-actions">
        <button
          className="btn btn--conjure btn--sm"
          onClick={() => onAccept(suggestion.id, title.trim(), folder.trim())}
          disabled={!title.trim() || !folder.trim()}
        >
          🪄 Aplicar
        </button>
        <button
          className="btn btn--ghost btn--sm"
          onClick={onDismiss}
        >
          Descartar
        </button>
      </div>
    </div>
  );
}
