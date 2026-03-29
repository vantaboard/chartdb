/** Local dev: Vite serves this file; Docker nginx generates /config.js at runtime. */
window.env = {
    OPENAI_API_KEY: '',
    OPENAI_API_ENDPOINT: '',
    LLM_MODEL_NAME: '',
    HIDE_CHARTDB_CLOUD: 'false',
    DISABLE_ANALYTICS: 'false',
    /** Set to 'true' and run sync-server on 8080 (e.g. `node sync-server/server.mjs`) to test diagram sync via Vite's /api/diagram-sync proxy. */
    DIAGRAM_SYNC_API_ENABLED: 'true',
    DIAGRAM_SYNC_POLL_MS: '30000',
    DIAGRAM_SYNC_API_BASE: '/api/diagram-sync',
    DIAGRAM_SYNC_TOKEN: '',
};
