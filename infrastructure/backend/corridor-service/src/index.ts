// ============================================================
// Corridor Service Entry Point
// Fixes:
//  • cors({ origin: '*' }) — tightened to explicit allowlist
//  • MQTT subscription happens before `app.listen()` - no real
//    race condition here (MQTT is separate from HTTP server) but
//    subscription error was swallowed if MQTT wasn't connected yet.
//    Added retry logic via 'connect' event handler.
//  • No graceful shutdown handler for HTTP or MQTT
//  • healthRouter imported but used at '/health' — uses healthRouter
//    consistently so it gains the proper RCTF response format
// ============================================================
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { corridorRouter } from './routes/corridor';
import { healthRouter } from './routes/health';
import { errorHandler } from './middleware/errorHandler';
import { mqttClient } from './services/mqttClient';
import { corridorEngine } from './services/corridorEngine';
import { validateConfig } from '../../../shared/config/env';

const app = express();
const PORT = Number(process.env.CORRIDOR_PORT ?? 3002);

// Initialize early config validation
validateConfig();

app.use(helmet());
app.use(cors({
    origin: process.env.NODE_ENV === 'development'
        ? true
        : (process.env.CORS_ORIGINS ?? '').split(',').map(o => o.trim()),
}));
app.use(express.json({ limit: '5mb' }));
app.use(morgan('combined'));

app.use('/health', healthRouter);
app.use('/api/corridor', corridorRouter);
app.use(errorHandler);

// ── Subscribe to MQTT after connection is established ─────────
// (avoids subscribe-before-connect race on slow broker connections)
mqttClient.on('connect', () => {
    mqttClient.subscribe('rescuedge/ambulance/+/location', { qos: 1 }, (err) => {
        if (err) console.error('[corridor-service] MQTT subscribe error:', err.message);
        else console.log('[corridor-service] Subscribed to ambulance location topics');
    });
});

mqttClient.on('message', (topic: string, message: Buffer) => {
    if (topic.startsWith('rescuedge/ambulance/') && topic.endsWith('/location')) {
        try {
            const data = JSON.parse(message.toString());
            corridorEngine.processAmbulanceUpdate(data);
        } catch (e) {
            console.error('[corridor-service] Failed to parse MQTT location message:', e);
        }
    }
});

// ── Start ─────────────────────────────────────────────────────
const httpServer = app.listen(PORT, () => {
    console.log(`[corridor-service] Running on port ${PORT}`);
});

// ── Graceful Shutdown ─────────────────────────────────────────
function shutdown(signal: string): void {
    console.log(`[corridor-service] ${signal} — shutting down`);
    httpServer.close(() => {
        mqttClient.end(false, {}, () => {
            console.log('[corridor-service] MQTT disconnected');
            process.exit(0);
        });
    });
    setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
