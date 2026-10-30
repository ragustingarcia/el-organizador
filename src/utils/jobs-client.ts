import type { Change } from './change-plan';

export async function runJob(action: 'apply' | 'resume' | 'restore' | 'archive' | 'pause', plan?: Change[]) {
  const response = await chrome.runtime.sendMessage({ type: 'BOOKMARK_JOB', action, plan });
  if (!response || response.error) throw new Error(response?.error ?? 'El trabajo fue interrumpido. Revisá la copia y reanudá desde el panel.');
  return response.result as number | undefined;
}
