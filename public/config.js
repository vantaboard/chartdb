/** Local dev: Vite serves this file; Docker nginx generates /config.js at runtime. */
window.env = {
    OPENAI_API_KEY: '',
    OPENAI_API_ENDPOINT: '',
    LLM_MODEL_NAME: '',
    HIDE_CHARTDB_CLOUD: 'false',
    DISABLE_ANALYTICS: 'false',
    /** Empty = use repo `.env` (DIAGRAM_SYNC_*); set true/false here to override without editing `.env`. */
    DIAGRAM_SYNC_API_ENABLED: '',
    DIAGRAM_SYNC_POLL_MS: '',
    DIAGRAM_SYNC_API_BASE: '',
    DIAGRAM_SYNC_TOKEN: '',
};
