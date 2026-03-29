import { z } from 'zod';
import { cloneDiagram } from './clone';
import { DatabaseEdition } from './domain/database-edition';
import { DatabaseType } from './domain/database-type';
import { dbDependencySchema } from './domain/db-dependency';
import { dbRelationshipSchema } from './domain/db-relationship';
import { dbTableSchema } from './domain/db-table';
import { areaSchema } from './domain/area';
import { dbCustomTypeSchema } from './domain/db-custom-type';
import { noteSchema } from './domain/note';
import { diagramSchema, type Diagram } from './domain/diagram';
import { generateId } from './utils';

/** Zod schema for volume/git sync: ISO date strings in JSON coerce to Date. */
export const diagramVolumeSchema = z.object({
    id: z.string(),
    name: z.string(),
    databaseType: z.nativeEnum(DatabaseType),
    databaseEdition: z.nativeEnum(DatabaseEdition).optional(),
    tables: z.array(dbTableSchema).optional(),
    relationships: z.array(dbRelationshipSchema).optional(),
    dependencies: z.array(dbDependencySchema).optional(),
    areas: z.array(areaSchema).optional(),
    customTypes: z.array(dbCustomTypeSchema).optional(),
    notes: z.array(noteSchema).optional(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
});

function dateReplacer(_key: string, value: unknown): unknown {
    if (value instanceof Date) {
        return value.toISOString();
    }
    return value;
}

/**
 * Serialize a diagram for volume/git sync. Preserves entity ids (unlike shareable export).
 */
export function diagramToVolumeJSON(diagram: Diagram): string {
    return JSON.stringify(diagram, dateReplacer, 2);
}

/**
 * Parse volume JSON into a Diagram suitable for IndexedDB upsert (same diagram id).
 */
export function diagramFromVolumeJSON(json: string): Diagram {
    const parsed: unknown = JSON.parse(json);
    return diagramVolumeSchema.parse(parsed);
}

/**
 * Parse JSON from a volume file for pull/sync. Uses filename stem as canonical diagram id.
 * - Valid volume JSON: coerces top-level `id` to `canonicalDiagramId` when it differs from body.
 * - If volume schema fails (e.g. hand-edited file), falls back to share/import shape + new entity ids
 *   (same as Backup import) while forcing the diagram id to `canonicalDiagramId`.
 */
export function parseDiagramForVolumePull(
    json: string,
    canonicalDiagramId: string
): Diagram {
    let volumeError: unknown;
    try {
        const diagram = diagramFromVolumeJSON(json);
        return diagram.id === canonicalDiagramId
            ? diagram
            : { ...diagram, id: canonicalDiagramId };
    } catch (err) {
        volumeError = err;
    }

    try {
        const raw = JSON.parse(json) as Record<string, unknown>;
        for (const key of [
            'tables',
            'relationships',
            'dependencies',
            'areas',
            'customTypes',
            'notes',
        ] as const) {
            if (raw[key] === null) {
                delete raw[key];
            }
        }
        const diagram = diagramSchema.parse({
            ...raw,
            createdAt: new Date(
                raw.createdAt != null ? String(raw.createdAt) : Date.now()
            ),
            updatedAt: new Date(
                raw.updatedAt != null ? String(raw.updatedAt) : Date.now()
            ),
        });
        const { diagram: cloned } = cloneDiagram(diagram, { generateId });
        return { ...cloned, id: canonicalDiagramId };
    } catch {
        throw volumeError;
    }
}
