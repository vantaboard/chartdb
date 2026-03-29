import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';
import UnpluginInjectPreload from 'unplugin-inject-preload/vite';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    const rootEnv = loadEnv(mode, process.cwd(), '');
    const ds = {
        API_ENABLED: rootEnv.DIAGRAM_SYNC_API_ENABLED ?? '',
        POLL_MS: rootEnv.DIAGRAM_SYNC_POLL_MS ?? '',
        API_BASE: rootEnv.DIAGRAM_SYNC_API_BASE ?? '',
        TOKEN: rootEnv.DIAGRAM_SYNC_TOKEN ?? '',
    };

    return {
        server: {
            // Browser calls same origin (e.g. :5173) + DIAGRAM_SYNC_API_BASE; strip prefix for sync-server on 8080.
            proxy: {
                '/api/diagram-sync': {
                    target: 'http://127.0.0.1:8080',
                    changeOrigin: true,
                    rewrite: (p) =>
                        p.replace(/^\/api\/diagram-sync/, '') || '/',
                },
            },
        },
        define: {
            'import.meta.env.VITE_DIAGRAM_SYNC_API_ENABLED': JSON.stringify(
                ds.API_ENABLED
            ),
            'import.meta.env.VITE_DIAGRAM_SYNC_POLL_MS': JSON.stringify(
                ds.POLL_MS
            ),
            'import.meta.env.VITE_DIAGRAM_SYNC_API_BASE': JSON.stringify(
                ds.API_BASE
            ),
            'import.meta.env.VITE_DIAGRAM_SYNC_TOKEN': JSON.stringify(ds.TOKEN),
        },
        plugins: [
            react(),
            visualizer({
                filename: './stats/stats.html',
                open: false,
            }),
            UnpluginInjectPreload({
                files: [
                    {
                        entryMatch: /logo-light.png$/,
                        outputMatch: /logo-light-.*.png$/,
                    },
                    {
                        entryMatch: /logo-dark.png$/,
                        outputMatch: /logo-dark-.*.png$/,
                    },
                ],
            }),
        ],
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
            },
        },
        build: {
            rollupOptions: {
                external: (id) => /__test__/.test(id),
                output: {
                    assetFileNames: (assetInfo) => {
                        if (
                            assetInfo.names &&
                            assetInfo.originalFileNames.some((name) =>
                                name.startsWith('src/assets/templates/')
                            )
                        ) {
                            return 'assets/[name][extname]';
                        }
                        return 'assets/[name]-[hash][extname]';
                    },
                },
            },
        },
    };
});
