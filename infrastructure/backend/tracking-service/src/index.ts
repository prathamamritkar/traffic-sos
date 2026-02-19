// ============================================================
// RescuEdge Tracking Service — WebSocket Live Location Streaming
// Architecture:
//   - HTTP server for REST endpoints (location updates, health)
//   - WebSocket server for live streaming to dashboard + victim app
//   - MQTT subscriber for ambulance location from corridor-service
//   - Rooms: one per accidentId — all subscribers get updates
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
import axios from 'axios';
import type { LocationUpdatePayload, RCTFAuth } from '../../../shared/models/rctf';

const app = express();
const server = http.createServer(app);
const PORT = process.env.TRACKING_PORT ?? 3004;
const JWT_SECRET = process.env.JWT_SECRET ?? 'rescuedge-dev-secret-change-in-prod';

app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(morgan('combined'));

// ── WebSocket Server ──────────────────────────────────────────
const wss = new WebSocketServer({ server, path: '/ws' });

// Room structure: accidentId → Set<WebSocket>
const rooms = new Map<string, Set<WebSocket>>();
// Client metadata
const clientMeta = new Map<WebSocket, { accidentId: string; entityId: string; role: string }>();

// Fast Location Cache for reconnection recovery
const locationCache = new Map<string, LocationUpdatePayload>();

wss.on('connection', (ws: WebSocket, req) => {
    const url = new URL(req.url ?? '/', `http://localhost`);
    const token = url.searchParams.get('token');
    const roomId = url.searchParams.get('accidentId') ?? 'global';

    // Authenticate
    let auth: RCTFAuth | null = null;
    if (token) {
        try {
            auth = jwt.verify(token, JWT_SECRET) as RCTFAuth;
        } catch {
            ws.close(1008, 'Invalid token');
            return;
        }
    }

    // Join room
    if (!rooms.has(roomId)) rooms.set(roomId, new Set());
    rooms.get(roomId)!.add(ws);
    clientMeta.set(ws, { accidentId: roomId, entityId: auth?.userId ?? 'anonymous', role: auth?.role ?? 'USER' });

    console.log(`[tracking-service] WS connected: ${auth?.userId ?? 'anon'} → room ${roomId}`);

    // Send welcome
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
                handleLocationUpdate(msg.payload, ws);
            } else if (msg.type === 'PING') {
                ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
            }
        } catch {
            // ignore malformed messages
        }
    });

    ws.on('close', () => {
        const meta = clientMeta.get(ws);
        if (meta) {
            rooms.get(meta.accidentId)?.delete(ws);
            clientMeta.delete(ws);
        }
        console.log(`[tracking-service] WS disconnected: ${auth?.userId ?? 'anon'}`);
    });

    ws.on('error', (err) => {
        console.error('[tracking-service] WS error:', err.message);
    });
});

// ── Location Update Handler ───────────────────────────────────
function handleLocationUpdate(payload: LocationUpdatePayload, sender: WebSocket): void {
    const { accidentId, entityId, entityType, location } = payload;

    // Fast Cache store for recovery
    locationCache.set(`${entityType}:${entityId}`, payload);

    // Broadcast to all clients in the room except sender
    const room = rooms.get(accidentId);
    if (!room) return;

    const message = JSON.stringify({
        type: 'LOCATION_UPDATE',
        payload: {
            ...payload,
            timestamp: new Date().toISOString(),
        },
    });

    for (const client of room) {
        if (client !== sender && client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    }

    // Forward ambulance updates to corridor-service
    if (entityType === 'AMBULANCE' || entityType === 'RESPONDER') {
        const corridorUrl = process.env.CORRIDOR_SERVICE_URL ?? 'http://localhost:3002';
        axios.post(`${corridorUrl}/api/corridor/location`, {
            meta: { requestId: `REQ-${uuidv4()}`, timestamp: new Date().toISOString(), env: 'development', version: '1.0' },
            payload: { accidentId, entityId, location },
        }, { timeout: 3000 }).catch(() => {/* fire-and-forget */ });
    }

    // Publish to MQTT for other subscribers
    mqttClient.publish(
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

// POST /api/track/location — REST fallback for location updates
app.post('/api/track/location', (req, res) => {
    const payload = req.body?.payload ?? req.body;
    if (!payload?.accidentId || !payload?.location) {
        res.status(400).json({ error: 'Missing accidentId or location' });
        return;
    }
    handleLocationUpdate(payload, {} as WebSocket);
    res.json({ payload: { status: 'BROADCAST' } });
});

// GET /api/track/rooms — list active rooms
app.get('/api/track/rooms', (_req, res) => {
    const roomInfo = Array.from(rooms.entries()).map(([id, clients]) => ({
        accidentId: id,
        clients: clients.size,
    }));
    res.json({ payload: roomInfo });
});

// GET /api/track/cache — get last known locations
app.get('/api/track/cache', (_req, res) => {
    const cache = Object.fromEntries(locationCache.entries());
    res.json({ payload: cache });
});

// ── MQTT Bridge ───────────────────────────────────────────────
const BROKER_URL = process.env.MQTT_BROKER_URL ?? 'mqtt://broker.hivemq.com:1883';
const mqttClient = mqtt.connect(BROKER_URL, {
    clientId: `rescuedge-tracking-${Math.random().toString(16).slice(2, 8)}`,
    clean: true,
    reconnectPeriod: 3000,
});

mqttClient.on('connect', () => {
    console.log('[tracking-service] MQTT connected');
    // Subscribe to SOS events to create rooms
    mqttClient.subscribe('rescuedge/sos/+', { qos: 1 });
    // Subscribe to corridor signal updates to broadcast to dashboard
    mqttClient.subscribe('rescuedge/corridor/+/signal', { qos: 1 });
});

mqttClient.on('message', (topic: string, message: Buffer) => {
    try {
        const data = JSON.parse(message.toString());

        if (topic.startsWith('rescuedge/sos/')) {
            // New SOS — create room
            const accidentId = data.payload?.accidentId ?? topic.split('/')[2];
            if (accidentId && !rooms.has(accidentId)) {
                rooms.set(accidentId, new Set());
                console.log(`[tracking-service] Room created for ${accidentId}`);
            }
        }

        if (topic.startsWith('rescuedge/corridor/')) {
            // Signal update — broadcast to global room
            const accidentId = topic.split('/')[2];
            const room = rooms.get(accidentId) ?? rooms.get('global');
            if (room) {
                const msg = JSON.stringify({ type: 'SIGNAL_UPDATE', payload: data });
                for (const client of room) {
                    if (client.readyState === WebSocket.OPEN) client.send(msg);
                }
            }
        }
    } catch {/* ignore */ }
});

// ── Start Server ──────────────────────────────────────────────
server.listen(PORT, () => {
    console.log(`[tracking-service] HTTP + WebSocket running on port ${PORT}`);
});

export default app;
