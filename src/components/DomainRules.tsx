import { useState } from 'react';
import type { BookmarkFolder } from '../utils/bookmarks';

export default function DomainRules({ folders, disabled }: { folders: BookmarkFolder[]; disabled: boolean }) {
  const [host, setHost] = useState('');
  const [folder, setFolder] = useState('');
  const [message, setMessage] = useState('');
  return <div className="card">
    <p>Regla personal: usar una carpeta existente para un dominio exacto. Se aplicará al próximo escaneo.</p>
    <input className="select" aria-label="Dominio de la regla" placeholder="ejemplo.com" value={host} disabled={disabled} onChange={e => setHost(e.target.value)} />
    <select className="select" aria-label="Carpeta de la regla" value={folder} disabled={disabled} onChange={e => setFolder(e.target.value)}>
      <option value="">Elegí una carpeta…</option>{folders.map(item => <option key={item.id} value={item.id}>{item.fullPath}</option>)}
    </select>
    <button className="btn btn--ghost" disabled={disabled || !host.trim()} onClick={async () => {
      try {
        const parsed = new URL(`https://${host.trim()}`);
        if (parsed.host !== host.trim().toLowerCase() || parsed.pathname !== '/' || parsed.username || parsed.password) throw new Error('Ingresá solamente el dominio.');
        const { organizationRules = {} } = await chrome.storage.local.get<{ organizationRules?: Record<string, string> }>('organizationRules');
        if (folder) organizationRules[parsed.hostname] = folder; else delete organizationRules[parsed.hostname];
        await chrome.storage.local.set({ organizationRules }); setMessage(folder ? 'Regla guardada.' : 'Regla eliminada.');
      } catch (error) { setMessage(String(error)); }
    }}>Guardar regla (sin carpeta: eliminar)</button>
    <p aria-live="polite">{message}</p>
  </div>;
}
