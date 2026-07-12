// Local persistence and backup utilities for the visa checklist app.
const STORAGE_KEY = 'poland-visa-checklist-state-v1';

export function safeStorage() {
  try {
    return window.localStorage;
  } catch (error) {
    return null;
  }
}

export function loadAppState() {
  const storage = safeStorage();
  if (!storage) return {};
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    return {};
  }
}

export function saveAppState(state) {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    // Gracefully ignore storage write failures.
  }
}

export function exportBackup(state, documents) {
  const payload = {
    exportedAt: new Date().toISOString(),
    version: 1,
    state,
    documents
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'poland-visa-backup.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function importBackup(file) {
  const text = await file.text();
  const payload = JSON.parse(text);
  if (!payload || typeof payload !== 'object') throw new Error('Invalid backup file');
  return payload.state || {};
}
