// ─── File System Access API — shkrim automatik në skedar lokal ───────────────
// Chrome e suporton. User zgjedh skedarin një herë, pastaj shkruhet automatikisht.

const FS_HANDLE_KEY = 'intal_fs_handle';

let _fileHandle: FileSystemFileHandle | null = null;
let _writeTimer: ReturnType<typeof setTimeout> | null = null;
let _pendingData: string | null = null;

// Kontrollo nëse File System Access API ekziston
export const fsApiSupported = typeof window !== 'undefined' && 'showSaveFilePicker' in window;

// Ngarko handle-in e ruajtur nga sesioni i kaluar (nga IDB)
export async function loadSavedFileHandle(): Promise<boolean> {
  if (!fsApiSupported) return false;
  try {
    const { get } = await import('idb-keyval');
    const handle = await get(FS_HANDLE_KEY) as FileSystemFileHandle | undefined;
    if (!handle) return false;
    // Verifiko që kemi leje akoma
    const perm = await handle.queryPermission({ mode: 'readwrite' });
    if (perm === 'granted') { _fileHandle = handle; return true; }
    // Kërko leje sërisht (kur hapet app-i)
    const req = await handle.requestPermission({ mode: 'readwrite' });
    if (req === 'granted') { _fileHandle = handle; return true; }
    return false;
  } catch { return false; }
}

// Hap dialog për zgjedhjen e skedarit (hera e parë)
export async function pickSaveFile(): Promise<boolean> {
  if (!fsApiSupported) return false;
  try {
    const handle = await (window as any).showSaveFilePicker({
      suggestedName: 'intal-backup.json',
      types: [{ description: 'JSON Backup', accept: { 'application/json': ['.json'] } }],
    });
    _fileHandle = handle;
    // Ruaj handle-in në IDB për sesionet e ardhshme
    const { set } = await import('idb-keyval');
    await set(FS_HANDLE_KEY, handle);
    return true;
  } catch { return false; } // user anuloi
}

// Hiq lidhjen me skedarin
export async function clearFileHandle(): Promise<void> {
  _fileHandle = null;
  try {
    const { del } = await import('idb-keyval');
    await del(FS_HANDLE_KEY);
  } catch { /* */ }
}

export function hasFileHandle(): boolean {
  return _fileHandle !== null;
}

// Shkruaj të dhënat në skedar (debounce 500ms)
export function writeToFile(data: string): void {
  if (!_fileHandle) return;
  _pendingData = data;
  if (_writeTimer) clearTimeout(_writeTimer);
  _writeTimer = setTimeout(async () => {
    if (!_fileHandle || !_pendingData) return;
    try {
      const writable = await _fileHandle.createWritable();
      await writable.write(_pendingData);
      await writable.close();
    } catch (e) {
      console.warn('[fileSync] write error:', e);
    }
  }, 500);
}
