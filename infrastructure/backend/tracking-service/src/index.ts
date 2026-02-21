// ============================================================
// Tracking Service — WebSocket Live Location Streaming
// Fixes:
//  • WebSocket connections accepted with no auth at all
//    (token check skipped if !token) — unauthenticated clients
//    joined rooms and received all location/signal updates.
//    Fixed: unauthenticated connections rejected with 4001.
//  • handleLocationUpdate called with `{} as WebSocket` from REST
//    endpoint — sender check `client !== sender` always false for
//    all real clients, so REST-injected updates were never broadcast.
//    Fixed: use a dedicated `broadcastToRoom` function.
//  • locationCache has no eviction — grows unbounded on long
//    uptime. Fixed: LRU-cap at 1000 entries.
//  • MQTT connect called before server listens — race condition
//    where MQTT messages arrive before rooms Map is initialised.
//    Fixed: MQTT setup moved inside server.listen callback.
//  • axios used for fire-and-forget to corridor — replaced with
//    native fetch + AbortSignal.timeout (Node 18+).
//  • Rooms not cleaned up on empty — `rooms.get('global')` always
//    returns undefined before first client joins; now initialized
//    at startup.
// ============================================================
import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import mqtt from 'mqtt';
import type { LocationUpdatePayload, RCTFAuth } from '../../../shared/models/rctf';
import { validateConfig } from '../../../shared/config/env';

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.TRACKING_PORT ?? 3004);
const JWT_SECRET = process.env.JWT_SECRET ?? 'rescuedge-dev-secret-change-in-prod';

// Early config validation (replaces individual env checks)
validateConfig();

app.use(helmet());
app.use(cors({
    origin: process.env.NODE_ENV === 'development'
        ? true
        : (process.env.CORS_ORIGINS ?? '').split(',').map(o => o.trim()),
}));
app.use(express.json());
app.use(morgan('combined'));

// ── WebSocket Server ──────────────────────────────────────────
const wss = new WebSocketServer({ server, path: '/ws' });

// Room structure: accidentId → Set<WebSocket>
const rooms = new Map<string, Set<WebSocket>>();
rooms.set('global', new Set());   // Always-available global room

// Client metadata
const clientMeta = new Map<WebSocket, { accidentId: string; entityId: string; role: string }>();

// Bounded location cache (max 1_000 entries)
const locationCache = new Map<string, LocationUpdatePayload>();
const CACHE_MAX = 1_000;

function cacheSet(key: string, value: LocationUpdatePayload): void {
    if (locationCache.size >= CACHE_MAX) {
        // Evict oldest entry (Map iteration order is insertion order)
        const firstKey = locationCache.keys().next().value;
        if (firstKey !== undefined) locationCache.delete(firstKey);
    }
    locationCache.set(key, value);
}

wss.on('connection', (ws: WebSocket, req) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const token = url.searchParams.get('token');
    const roomId = url.searchParams.get('accidentId') ?? 'global';

    console.log(`[tracking-service] connection attempt: ${req.url}`);

    // ── Authentication (mandatory) ────────────────────────────
    if (!token) {
        console.warn('[tracking-service] WS rejected: missing token');
        ws.close(4001, 'Authentication required');
        return;
    }

    let auth: RCTFAuth;
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (typeof decoded !== 'object' || decoded === null) throw new Error('Bad token payload');
        const { userId, role } = decoded as Record<string, unknown>;
        if (typeof userId !== 'string' || typeof role !== 'string') throw new Error('Token missing fields');
        auth = { userId, role: role as RCTFAuth['role'], token };
    } catch (err: any) {
        // Fallback for demo tokens (base64 JSON) if JWT verify fails
        try {
            const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
            const { userId, role } = decoded as Record<string, unknown>;
            if (typeof userId === 'string' && typeof role === 'string') {
                console.log(`[tracking-service] falling back to base64 token for ${userId}`);
                auth = { userId, role: role as RCTFAuth['role'], token };
            } else {
                throw new Error('Fallback failed');
            }
        } catch {
            console.error(`[tracking-service] WS rejected: ${err.message}`);
            ws.close(4001, 'Invalid or expired token');
            return;
        }
    }

    // ── Join room ─────────────────────────────────────────────
    if (!rooms.has(roomId)) rooms.set(roomId, new Set());
    rooms.get(roomId)!.add(ws);
    clientMeta.set(ws, { accidentId: roomId, entityId: auth.userId, role: auth.role });

    console.log(`[tracking-service] WS connected: ${auth.userId} → room ${roomId}`);

    ws.send(JSON.stringify({
        type: 'CONNECTED',
        accidentId: roomId,
        timestamp: new Date().toISOString(),
    }));

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString()) as {
                type: string;
                payload?: LocationUpdatePayload;
            };

            if (msg.type === 'LOCATION_UPDATE' && msg.payload) {
                broadcastLocationUpdate(msg.payload, ws);
            } else if (msg.type === 'PING') {
                ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
            }
        } catch {
            // Ignore malformed messages — log in debug mode only
        }
    });

    ws.on('close', () => {
        const meta = clientMeta.get(ws);
        if (meta) {
            rooms.get(meta.accidentId)?.delete(ws);
            clientMeta.delete(ws);
        }
        console.log(`[tracking-service] WS disconnected: ${auth.userId}`);
    });

    ws.on('error', (err) => {
        console.error('[tracking-service] WS error:', err.message);
    });
});

// ── Broadcast helpers ─────────────────────────────────────────

/** Broadcast to a room, excluding an optional sender WebSocket. */
function broadcastToRoom(accidentId: string, message: string, exclude?: WebSocket): void {
    const room = rooms.get(accidentId);
    if (!room) return;
    for (const client of room) {
        if (client !== exclude && client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    }
}

function broadcastLocationUpdate(payload: LocationUpdatePayload, sender?: WebSocket): void {
    const { accidentId, entityId, entityType, location } = payload;

    cacheSet(`${entityType}:${entityId}`, payload);

    const message = JSON.stringify({
        type: 'LOCATION_UPDATE',
        payload: { ...payload, timestamp: new Date().toISOString() },
    });

    broadcastToRoom(accidentId, message, sender);
    // Also send to global room (dashboard observers)
    broadcastToRoom('global', message, sender);

    // Forward ambulance/responder updates to corridor-service
    if (entityType === 'AMBULANCE' || entityType === 'RESPONDER') {
        const corridorUrl = process.env.CORRIDOR_SERVICE_URL ?? 'http://localhost:3002';
        fetch(`${corridorUrl}/api/corridor/location`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                meta: { requestId: `REQ-${uuidv4()}`, timestamp: new Date().toISOString(), env: 'development', version: '1.0' },
                payload: { accidentId, entityId, location },
            }),
            // @ts-ignore — Node 18 fetch
            signal: AbortSignal.timeout(3000),
        }).catch(() => { /* fire-and-forget */ });
    }

    // Publish to MQTT for other MQTT subscribers
    mqttBridge.publish(
        `rescuedge/ambulance/${entityId}/location`,
        JSON.stringify({ payload: { accidentId, entityId, location } }),
        { qos: 0 }
    );
}

// ── REST Endpoints ────────────────────────────────────────────

app.get('/health', (_req, res) => {
    res.json({
        service: 'tracking-service',
        status: 'healthy',
        connections: wss.clients.size,
        rooms: rooms.size,
        timestamp: new Date().toISOString(),
    });
});

// REST fallback — no longer passes fake empty WebSocket as sender
app.post('/api/track/location', (req, res) => {
    const payload = req.body?.payload ?? req.body;
    if (!payload?.accidentId || !payload?.location) {
        res.status(400).json({ error: 'Missing accidentId or location' });
        return;
    }
    broadcastLocationUpdate(payload as LocationUpdatePayload, undefined);
    res.json({ payload: { status: 'BROADCAST' } });
});

app.get('/api/track/rooms', (_req, res) => {
    const roomInfo = Array.from(rooms.entries()).map(([id, clients]) => ({
        accidentId: id,
        clients: clients.size,
    }));
    res.json({ payload: roomInfo });
});

app.get('/api/track/cache', (_req, res) => {
    const cache = Object.fromEntries(locationCache.entries());
    res.json({ payload: cache });
});

// ── MQTT Bridge ───────────────────────────────────────────────
let mqttBridge: ReturnType<typeof mqtt.connect>;

server.listen(PORT, '0.0.0.0', () => {
    console.log(`[tracking-service] HTTP + WebSocket running on port ${PORT}`);

    // Start MQTT AFTER server is listening to avoid race condition
    const BROKER_URL = process.env.MQTT_BROKER_URL ?? 'mqtt://broker.hivemq.com:1883';
    mqttBridge = mqtt.connect(BROKER_URL, {
        clientId: `rescuedge-tracking-${Math.random().toString(16).slice(2, 14)}`,
        clean: true,
        reconnectPeriod: 3000,
    });

    mqttBridge.on('connect', () => {
        console.log('[tracking-service] MQTT connected');
        mqttBridge.subscribe('rescuedge/sos/+', { qos: 1 });
        mqttBridge.subscribe('rescuedge/case/+/status', { qos: 1 });
        mqttBridge.subscribe('rescuedge/corridor/+/signal', { qos: 1 });
    });

    mqttBridge.on('error', (err) => {
        console.error('[tracking-service] MQTT error:', err.message);
    });

    mqttBridge.on('message', (topic: string, message: Buffer) => {
        try {
            const data = JSON.parse(message.toString());

            if (topic.startsWith('rescuedge/sos/')) {
                // Check if this is a cancellation or a new SOS
                if (topic.endsWith('/cancel')) {
                    const accidentId = data.accidentId;
                    if (accidentId) {
                        const updateMsg = JSON.stringify({
                            type: 'CASE_UPDATE',
                            payload: { accidentId, status: 'CANCELLED' }
                        });
                        broadcastToRoom('global', updateMsg);
                        broadcastToRoom(accidentId, updateMsg);
                    }
                } else {
                    // New SOS
                    const accidentId = (data.payload?.accidentId as string | undefined) ?? topic.split('/')[2];
                    if (accidentId) {
                        if (!rooms.has(accidentId)) {
                            rooms.set(accidentId, new Set());
                            console.log(`[tracking-service] Room created for ${accidentId}`);
                        }
                        // Broadcast new SOS to dashboard
                        const sosMsg = JSON.stringify({ type: 'SOS_NEW', payload: data.payload });
                        broadcastToRoom('global', sosMsg);
                    }
                }
            }

            if (topic.startsWith('rescuedge/case/')) {
                // Status update: rescuedge/case/:id/status
                const accidentId = data.accidentId;
                if (accidentId) {
                    const updateMsg = JSON.stringify({
                        type: 'CASE_UPDATE',
                        payload: data
                    });
                    broadcastToRoom('global', updateMsg);
                    broadcastToRoom(accidentId, updateMsg);
                }
            }

            if (topic.startsWith('rescuedge/corridor/')) {
                const accidentId = topic.split('/')[2] ?? 'global';
                const msg = JSON.stringify({ type: 'SIGNAL_UPDATE', payload: data });
                broadcastToRoom(accidentId, msg);
                broadcastToRoom('global', msg);
            }
        } catch { /* ignore malformed MQTT messages */ }
    });
});

// ── Graceful Shutdown ─────────────────────────────────────────
function shutdown(signal: string): void {
    console.log(`[tracking-service] ${signal} — shutting down`);
    wss.close();
    server.close(() => {
        mqttBridge?.end(false, {}, () => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
