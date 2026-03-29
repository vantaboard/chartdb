import React, {
    useCallback,
    useEffect,
    useRef,
    type PropsWithChildren,
} from 'react';
import { useStorage } from '@/hooks/use-storage';
import { useChartDB } from '@/hooks/use-chartdb';
import {
    diagramToVolumeJSON,
    parseDiagramForVolumePull,
} from '@/lib/diagram-sync-json';
import {
    diagramSyncAuthHeaders,
    getDiagramSyncRuntimeConfig,
} from '@/lib/diagram-sync-config';
import {
    getPendingDiagramSyncServerDeletes,
    setPendingDiagramSyncServerDeletes,
} from '@/lib/diagram-sync-pending-deletes';
import type { Diagram } from '@/lib/domain/diagram';

interface ServerDiagramMeta {
    id: string;
    name: string;
    updatedAt: string;
}

interface ServerListResponse {
    diagrams: ServerDiagramMeta[];
}

const FULL_DIAGRAM_OPTS = {
    includeRelationships: true,
    includeTables: true,
    includeDependencies: true,
    includeAreas: true,
    includeCustomTypes: true,
    includeNotes: true,
} as const;

function updatedAtMs(d: Date | string): number {
    return new Date(d).getTime();
}

export const DiagramSyncProvider: React.FC<PropsWithChildren> = ({
    children,
}) => {
    const storageDB = useStorage();
    const { diagramId: openDiagramId, updateDiagramData } = useChartDB();

    const lastPushedJsonRef = useRef<Record<string, string>>({});
    const runningRef = useRef(false);

    const applyPulledDiagram = useCallback(
        async (diagram: Diagram) => {
            if (diagram.id === openDiagramId) {
                await updateDiagramData(diagram, { forceUpdateStorage: true });
            } else {
                await storageDB.deleteDiagram(diagram.id, {
                    skipDiagramSyncServerDelete: true,
                });
                await storageDB.addDiagram({ diagram });
            }
        },
        [openDiagramId, storageDB, updateDiagramData]
    );

    const runSync = useCallback(async () => {
        if (!getDiagramSyncRuntimeConfig().enabled) return;
        if (runningRef.current) return;
        runningRef.current = true;
        const cfg = getDiagramSyncRuntimeConfig();
        const auth = diagramSyncAuthHeaders(cfg.token);
        const base = cfg.apiBase;

        try {
            const pendingDeletes = getPendingDiagramSyncServerDeletes();
            if (pendingDeletes.length > 0) {
                const failed: string[] = [];
                for (const id of pendingDeletes) {
                    const res = await fetch(
                        `${base}/diagrams/${encodeURIComponent(id)}`,
                        {
                            method: 'DELETE',
                            headers: { ...auth },
                        }
                    );
                    if (res.ok || res.status === 404) {
                        delete lastPushedJsonRef.current[id];
                    } else {
                        failed.push(id);
                    }
                }
                setPendingDiagramSyncServerDeletes(failed);
            }

            let listRes = await fetch(`${base}/diagrams`, {
                headers: { ...auth },
            });
            if (!listRes.ok) return;

            let serverDiagrams = ((await listRes.json()) as ServerListResponse)
                .diagrams;

            let localList = await storageDB.listDiagrams();
            const localMap = new Map(localList.map((d) => [d.id, d] as const));

            for (const remote of serverDiagrams) {
                const local = localMap.get(remote.id);
                const remoteMs = updatedAtMs(remote.updatedAt);
                if (!local || remoteMs > updatedAtMs(local.updatedAt)) {
                    const one = await fetch(
                        `${base}/diagrams/${encodeURIComponent(remote.id)}`,
                        {
                            headers: { ...auth },
                        }
                    );
                    if (!one.ok) continue;
                    const text = await one.text();
                    try {
                        const diagram = parseDiagramForVolumePull(
                            text,
                            remote.id
                        );
                        await applyPulledDiagram(diagram);
                        lastPushedJsonRef.current[remote.id] = text;
                    } catch {
                        /* invalid file on volume */
                    }
                }
            }

            listRes = await fetch(`${base}/diagrams`, {
                headers: { ...auth },
            });
            if (!listRes.ok) return;
            serverDiagrams = ((await listRes.json()) as ServerListResponse)
                .diagrams;
            const serverMap = new Map(
                serverDiagrams.map((d) => [d.id, d] as const)
            );

            localList = await storageDB.listDiagrams();

            for (const local of localList) {
                const full = await storageDB.getDiagram(local.id, {
                    ...FULL_DIAGRAM_OPTS,
                });
                if (!full) continue;

                const json = diagramToVolumeJSON(full);
                const remote = serverMap.get(local.id);
                const localMs = updatedAtMs(full.updatedAt);

                if (remote && updatedAtMs(remote.updatedAt) > localMs) {
                    continue;
                }

                if (lastPushedJsonRef.current[local.id] === json) {
                    continue;
                }

                const headers: Record<string, string> = {
                    ...auth,
                    'Content-Type': 'application/json',
                };
                if (remote) {
                    headers['X-Expect-Updated-At'] = remote.updatedAt;
                }

                const put = await fetch(
                    `${base}/diagrams/${encodeURIComponent(local.id)}`,
                    {
                        method: 'PUT',
                        headers,
                        body: json,
                    }
                );

                if (put.ok) {
                    lastPushedJsonRef.current[local.id] = json;
                } else if (put.status === 409) {
                    delete lastPushedJsonRef.current[local.id];
                }
            }
        } finally {
            runningRef.current = false;
        }
    }, [applyPulledDiagram, storageDB]);

    useEffect(() => {
        const cfg = getDiagramSyncRuntimeConfig();
        if (!cfg.enabled) return;

        const tick = () => {
            void runSync();
        };

        tick();
        const id = window.setInterval(tick, cfg.pollMs);

        const onVis = () => {
            if (document.visibilityState === 'visible') tick();
        };
        document.addEventListener('visibilitychange', onVis);

        return () => {
            window.clearInterval(id);
            document.removeEventListener('visibilitychange', onVis);
        };
    }, [runSync]);

    return <>{children}</>;
};
