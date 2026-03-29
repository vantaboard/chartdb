/** Runtime sync settings from `/config.js` (`window.env`), set at container start. */
export interface DiagramSyncRuntimeConfig {
    enabled: boolean;
    pollMs: number;
    apiBase: string;
    token: string;
}

export function getDiagramSyncRuntimeConfig(): DiagramSyncRuntimeConfig {
    const e = typeof window !== 'undefined' ? window.env : undefined;
    const pollRaw = e?.DIAGRAM_SYNC_POLL_MS;
    const poll = Number(pollRaw);
    return {
        enabled: e?.DIAGRAM_SYNC_API_ENABLED === 'true',
        pollMs: Number.isFinite(poll) && poll >= 3000 ? poll : 30000,
        apiBase: (e?.DIAGRAM_SYNC_API_BASE || '/api/diagram-sync').replace(
            /\/$/,
            ''
        ),
        token: e?.DIAGRAM_SYNC_TOKEN?.trim() ?? '',
    };
}

export function diagramSyncAuthHeaders(token: string): Record<string, string> {
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
}
