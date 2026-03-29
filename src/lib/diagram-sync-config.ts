/** Runtime sync settings from `/config.js` (`window.env`), set at container start. */
export interface DiagramSyncRuntimeConfig {
    enabled: boolean;
    pollMs: number;
    apiBase: string;
    token: string;
}

/** Prefer explicit runtime `window.env`; empty runtime values fall back to `.env` (Vite `define`). */
function triBool(
    runtime: string | undefined,
    fromEnvFile: string | undefined
): boolean {
    const t = runtime?.trim();
    if (t === 'true') return true;
    if (t === 'false') return false;
    return fromEnvFile === 'true';
}

function coalesce(
    runtime: string | undefined,
    fromEnvFile: string | undefined,
    fallback: string
): string {
    const t = runtime?.trim();
    if (t !== undefined && t !== '') return t;
    const v = fromEnvFile?.trim();
    if (v !== undefined && v !== '') return v;
    return fallback;
}

export function getDiagramSyncRuntimeConfig(): DiagramSyncRuntimeConfig {
    const e = typeof window !== 'undefined' ? window.env : undefined;
    const pollRaw = coalesce(
        e?.DIAGRAM_SYNC_POLL_MS,
        import.meta.env.VITE_DIAGRAM_SYNC_POLL_MS,
        '30000'
    );
    const poll = Number(pollRaw);
    return {
        enabled: triBool(
            e?.DIAGRAM_SYNC_API_ENABLED,
            import.meta.env.VITE_DIAGRAM_SYNC_API_ENABLED
        ),
        pollMs: Number.isFinite(poll) && poll >= 3000 ? poll : 30000,
        apiBase: coalesce(
            e?.DIAGRAM_SYNC_API_BASE,
            import.meta.env.VITE_DIAGRAM_SYNC_API_BASE,
            '/api/diagram-sync'
        ).replace(/\/$/, ''),
        token: coalesce(
            e?.DIAGRAM_SYNC_TOKEN,
            import.meta.env.VITE_DIAGRAM_SYNC_TOKEN,
            ''
        ),
    };
}

export function diagramSyncAuthHeaders(token: string): Record<string, string> {
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
}
