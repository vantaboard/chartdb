import { describe, expect, it } from 'vitest';
import {
    diagramFromVolumeJSON,
    diagramToVolumeJSON,
} from '../diagram-sync-json';
import { DatabaseType } from '../domain/database-type';

describe('diagram-sync-json', () => {
    it('round-trips a minimal diagram with stable id and ISO dates', () => {
        const diagram = {
            id: 'workspaceabcd1234',
            name: 'Employees',
            databaseType: DatabaseType.POSTGRESQL,
            createdAt: new Date('2024-03-28T12:00:00.000Z'),
            updatedAt: new Date('2024-03-28T15:30:00.000Z'),
        };

        const json = diagramToVolumeJSON(diagram);
        expect(json).toContain('"id": "workspaceabcd1234"');
        expect(json).toContain('2024-03-28T12:00:00.000Z');

        const back = diagramFromVolumeJSON(json);
        expect(back.id).toBe('workspaceabcd1234');
        expect(back.name).toBe('Employees');
        expect(back.databaseType).toBe(DatabaseType.POSTGRESQL);
        expect(back.createdAt.getTime()).toBe(diagram.createdAt.getTime());
        expect(back.updatedAt.getTime()).toBe(diagram.updatedAt.getTime());
    });

    it('parses JSON with ISO date strings from disk', () => {
        const raw = `{
  "id": "x1",
  "name": "From disk",
  "databaseType": "generic",
  "createdAt": "2020-01-01T00:00:00.000Z",
  "updatedAt": "2020-02-01T00:00:00.000Z"
}`;
        const d = diagramFromVolumeJSON(raw);
        expect(d.id).toBe('x1');
        expect(d.updatedAt.getUTCFullYear()).toBe(2020);
    });
});
