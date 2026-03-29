import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverEntry = path.join(root, 'server.mjs');

let child;
let baseUrl;
let tmpDir;

before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'chartdb-sync-'));
    const port = 19000 + Math.floor(Math.random() * 1000);
    baseUrl = `http://127.0.0.1:${port}`;
    child = spawn(process.execPath, [serverEntry], {
        env: { ...process.env, PORT: String(port), DATA_DIR: tmpDir },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('server start timeout')), 5000);
        const onData = (d) => {
            const s = d.toString();
            if (s.includes('listening')) {
                clearTimeout(t);
                resolve(undefined);
            }
        };
        child.stdout.on('data', onData);
        child.stderr.on('data', onData);
        child.on('error', reject);
        child.on('exit', (code) => {
            if (code !== 0 && code !== null) {
                clearTimeout(t);
                reject(new Error(`exit ${code}`));
            }
        });
    });
});

after(async () => {
    if (child) {
        child.kill('SIGTERM');
        await new Promise((r) => child.on('exit', r));
    }
    await fs.rm(tmpDir, { recursive: true, force: true });
});

test('GET /health', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const j = await res.json();
    assert.equal(j.ok, true);
});

test('list, put, get, delete diagram', async () => {
    const listEmpty = await fetch(`${baseUrl}/diagrams`);
    assert.equal(listEmpty.status, 200);
    const empty = await listEmpty.json();
    assert.ok(Array.isArray(empty.diagrams));
    assert.equal(empty.diagrams.length, 0);

    const doc = {
        id: 'abc123',
        name: 'Test',
        databaseType: 'generic',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
    };

    const put = await fetch(`${baseUrl}/diagrams/abc123`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc),
    });
    assert.equal(put.status, 200);

    const list = await fetch(`${baseUrl}/diagrams`);
    const { diagrams } = await list.json();
    assert.equal(diagrams.length, 1);
    assert.equal(diagrams[0].id, 'abc123');

    const get = await fetch(`${baseUrl}/diagrams/abc123`);
    assert.equal(get.status, 200);
    const got = await get.json();
    assert.equal(got.name, 'Test');

    const del = await fetch(`${baseUrl}/diagrams/abc123`, { method: 'DELETE' });
    assert.equal(del.status, 204);

    const get404 = await fetch(`${baseUrl}/diagrams/abc123`);
    assert.equal(get404.status, 404);
});

test('PUT id mismatch returns 400', async () => {
    const res = await fetch(`${baseUrl}/diagrams/xyz`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'wrong', name: 'n', databaseType: 'generic' }),
    });
    assert.equal(res.status, 400);
});

test('list includes hyphenated filename stems', async () => {
    const body = {
        id: 'school-pathways-slim',
        name: 'School pathways',
        databaseType: 'generic',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
    };
    await fs.writeFile(
        path.join(tmpDir, 'school-pathways-slim.json'),
        JSON.stringify(body)
    );

    const list = await fetch(`${baseUrl}/diagrams`);
    assert.equal(list.status, 200);
    const { diagrams } = await list.json();
    const entry = diagrams.find((d) => d.id === 'school-pathways-slim');
    assert.ok(entry, 'hyphenated stem should appear in manifest');
    assert.equal(entry.name, 'School pathways');
});

test('list uses filename stem when body id differs; GET uses stem', async () => {
    const body = {
        id: '0',
        name: 'Mismatch body',
        databaseType: 'generic',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
    };
    await fs.writeFile(path.join(tmpDir, 'mismatch.json'), JSON.stringify(body));

    const list = await fetch(`${baseUrl}/diagrams`);
    assert.equal(list.status, 200);
    const { diagrams } = await list.json();
    const entry = diagrams.find((d) => d.id === 'mismatch');
    assert.ok(entry, 'manifest id should be filename stem');
    assert.equal(entry.name, 'Mismatch body');

    const get = await fetch(`${baseUrl}/diagrams/mismatch`);
    assert.equal(get.status, 200);
    const got = await get.json();
    assert.equal(got.id, '0');
    assert.equal(got.name, 'Mismatch body');
});
