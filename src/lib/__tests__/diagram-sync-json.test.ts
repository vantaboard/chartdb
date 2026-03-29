import { describe, expect, it } from 'vitest';
import {
    diagramFromVolumeJSON,
    diagramToVolumeJSON,
    parseDiagramForVolumePull,
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

    it('parseDiagramForVolumePull coerces top-level id to canonical filename stem', () => {
        const raw = {
            id: '0',
            name: 'From share export',
            databaseType: DatabaseType.GENERIC,
            createdAt: '2020-01-01T00:00:00.000Z',
            updatedAt: '2020-02-01T00:00:00.000Z',
        };
        const json = JSON.stringify(raw);
        const d = parseDiagramForVolumePull(json, 'employees');
        expect(d.id).toBe('employees');
        expect(d.name).toBe('From share export');
    });

    it('parseDiagramForVolumePull leaves id unchanged when it matches canonical', () => {
        const diagram = {
            id: 'sameid',
            name: 'N',
            databaseType: DatabaseType.GENERIC,
            createdAt: new Date('2020-01-01T00:00:00.000Z'),
            updatedAt: new Date('2020-02-01T00:00:00.000Z'),
        };
        const json = diagramToVolumeJSON(diagram);
        const d = parseDiagramForVolumePull(json, 'sameid');
        expect(d.id).toBe('sameid');
    });

    it('parseDiagramForVolumePull falls back when volume rejects null tables', () => {
        const json = JSON.stringify({
            id: '0',
            name: 'HandEdit',
            databaseType: 'generic',
            createdAt: '2020-01-01T00:00:00.000Z',
            updatedAt: '2020-02-01T00:00:00.000Z',
            tables: null,
        });
        expect(() => diagramFromVolumeJSON(json)).toThrow();
        const d = parseDiagramForVolumePull(json, 'handedit');
        expect(d.id).toBe('handedit');
        expect(d.name).toBe('HandEdit');
        expect(d.tables).toEqual([]);
    });
});
