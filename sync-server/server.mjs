import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT ?? 8080);
const DATA_DIR = process.env.DATA_DIR ?? '/data/diagrams';
const SYNC_API_TOKEN = process.env.SYNC_API_TOKEN?.trim() || '';

/** @param {string} id */
function isSafeDiagramId(id) {
    return (
        typeof id === 'string' &&
        id.length > 0 &&
        id.length <= 128 &&
        // Filename stems / URL segments: alphanumerics plus hyphen and underscore (no `.` or `/`).
        /^[0-9a-zA-Z_-]+$/.test(id)
    );
}

function sendJson(res, status, body) {
    const data = JSON.stringify(body);
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(data),
    });
    res.end(data);
}

function sendText(res, status, text, contentType = 'text/plain; charset=utf-8') {
    res.writeHead(status, { 'Content-Type': contentType });
    res.end(text);
}

function checkAuth(req, res) {
    if (!SYNC_API_TOKEN) return true;
    const auth = req.headers.authorization;
    const expected = `Bearer ${SYNC_API_TOKEN}`;
    if (auth !== expected) {
        sendJson(res, 401, { error: 'Unauthorized' });
        return false;
    }
    return true;
}

/**
 * @param {string} pathname
 * @returns {{ type: 'list' } | { type: 'one', id: string } | { type: 'invalid' }}
 */
function parsePath(pathname) {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length === 1 && parts[0] === 'diagrams') {
        return { type: 'list' };
    }
    if (parts.length === 2 && parts[0] === 'diagrams') {
        const id = decodeURIComponent(parts[1]);
        if (!isSafeDiagramId(id)) return { type: 'invalid' };
        return { type: 'one', id };
    }
    return { type: 'invalid' };
}

/** @param {string} id */
function filePathForId(id) {
    return path.join(DATA_DIR, `${id}.json`);
}

async function ensureDataDir() {
    await fs.mkdir(DATA_DIR, { recursive: true });
}

/**
 * @returns {Promise<Array<{ id: string, name: string, updatedAt: string }>>}
 */
async function listDiagramsMeta() {
    await ensureDataDir();
    const names = await fs.readdir(DATA_DIR);
    const jsonFiles = names.filter((n) => n.endsWith('.json'));
    const out = [];
    for (const name of jsonFiles) {
        const id = name.slice(0, -'.json'.length);
        if (!isSafeDiagramId(id)) continue;
        try {
            const raw = await fs.readFile(path.join(DATA_DIR, name), 'utf8');
            const doc = JSON.parse(raw);
            if (doc && typeof doc.id === 'string' && typeof doc.name === 'string') {
                const updatedAt =
                    doc.updatedAt != null
                        ? new Date(doc.updatedAt).toISOString()
                        : new Date(0).toISOString();
                // Canonical API id is the filename stem so GET/PUT paths match on-disk files
                // even when JSON body.id differs (e.g. share export id "0" in mismatch.json).
                out.push({ id, name: doc.name, updatedAt });
            }
        } catch {
            // skip corrupt files
        }
    }
    return out;
}

/**
 * @param {import('node:http').IncomingMessage} req
 */
function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}

/**
 * @param {string} filePath
 * @param {string} body
 */
async function writeAtomic(filePath, body) {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, body, 'utf8');
    await fs.rename(tmp, filePath);
}

const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Expect-Updated-At',
        });
        res.end();
        return;
    }

    const url = new URL(req.url ?? '/', `http://127.0.0.1`);
    if (url.pathname === '/health' && req.method === 'GET') {
        sendJson(res, 200, { ok: true });
        return;
    }

    const route = parsePath(url.pathname);
    if (route.type === 'invalid') {
        sendJson(res, 404, { error: 'Not found' });
        return;
    }

    if (!checkAuth(req, res)) return;

    try {
        if (route.type === 'list') {
            if (req.method !== 'GET') {
                sendJson(res, 405, { error: 'Method not allowed' });
                return;
            }
            const diagrams = await listDiagramsMeta();
            sendJson(res, 200, { diagrams });
            return;
        }

        const { id } = route;
        const fp = filePathForId(id);

        if (req.method === 'GET') {
            try {
                const body = await fs.readFile(fp, 'utf8');
                res.writeHead(200, {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Content-Length': Buffer.byteLength(body),
                });
                res.end(body);
            } catch (e) {
                if (/** @type {NodeJS.ErrnoException} */ (e).code === 'ENOENT') {
                    sendJson(res, 404, { error: 'Not found' });
                } else {
                    throw e;
                }
            }
            return;
        }

        if (req.method === 'PUT') {
            const rawBody = await readBody(req);
            let doc;
            try {
                doc = JSON.parse(rawBody);
            } catch {
                sendJson(res, 400, { error: 'Invalid JSON' });
                return;
            }
            if (!doc || typeof doc !== 'object' || doc.id !== id) {
                sendJson(res, 400, { error: 'Body id must match URL id' });
                return;
            }
            const expect = req.headers['x-expect-updated-at'];
            if (expect && typeof expect === 'string') {
                try {
                    const existing = await fs.readFile(fp, 'utf8');
                    const prev = JSON.parse(existing);
                    const prevIso = new Date(prev.updatedAt).toISOString();
                    if (prevIso !== new Date(expect).toISOString()) {
                        sendJson(res, 409, {
                            error: 'Conflict',
                            serverUpdatedAt: prevIso,
                        });
                        return;
                    }
                } catch (e) {
                    if (/** @type {NodeJS.ErrnoException} */ (e).code !== 'ENOENT') {
                        throw e;
                    }
                }
            }
            await writeAtomic(fp, JSON.stringify(doc, null, 2));
            sendJson(res, 200, { ok: true });
            return;
        }

        if (req.method === 'DELETE') {
            try {
                await fs.unlink(fp);
            } catch (e) {
                if (/** @type {NodeJS.ErrnoException} */ (e).code !== 'ENOENT') {
                    throw e;
                }
            }
            res.writeHead(204);
            res.end();
            return;
        }

        sendJson(res, 405, { error: 'Method not allowed' });
    } catch (err) {
        console.error(err);
        sendJson(res, 500, { error: 'Internal server error' });
    }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    await ensureDataDir();
    server.listen(PORT, () => {
        console.log(`chartdb-diagram-sync listening on ${PORT}, DATA_DIR=${DATA_DIR}`);
    });
}

export { server, parsePath, isSafeDiagramId };
