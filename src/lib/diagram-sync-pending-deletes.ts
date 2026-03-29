/** Diagram ids whose removal should be propagated to the sync volume (local user delete). */
const STORAGE_KEY = 'chartdb_diagram_sync_pending_server_deletes_v4';

export function queueDiagramSyncServerDelete(diagramId: string): void {
    if (!diagramId) return;
    try {
        const ids = getPendingDiagramSyncServerDeletes();
        if (!ids.includes(diagramId)) ids.push(diagramId);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
        /* quota / private mode */
    }
}

export function getPendingDiagramSyncServerDeletes(): string[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(
            (x): x is string => typeof x === 'string' && x.length > 0
        );
    } catch {
        return [];
    }
}

export function setPendingDiagramSyncServerDeletes(ids: string[]): void {
    try {
        if (ids.length === 0) localStorage.removeItem(STORAGE_KEY);
        else localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
        /* ignore */
    }
}
