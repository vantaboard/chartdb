import { z } from 'zod';
import { DatabaseEdition } from './domain/database-edition';
import { DatabaseType } from './domain/database-type';
import { dbDependencySchema } from './domain/db-dependency';
import { dbRelationshipSchema } from './domain/db-relationship';
import { dbTableSchema } from './domain/db-table';
import { areaSchema } from './domain/area';
import { dbCustomTypeSchema } from './domain/db-custom-type';
import { noteSchema } from './domain/note';
import type { Diagram } from './domain/diagram';

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
