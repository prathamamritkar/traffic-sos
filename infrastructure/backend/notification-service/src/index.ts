// ============================================================
// RescuEdge Notification Service — Entry Point
// Fixes:
//  • CORS wildcard '*' — tightened to explicit allowlist.
//  • No graceful shutdown handler.
//  • validateConfig() check missing — if JWT_SECRET is missing,
//    shared services or admin routes might be insecure.
//  • Added PORT parsing with fallback.
// ============================================================
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { notifyRouter } from './routes/notify';
import { healthRouter } from './routes/health';
import { errorHandler } from './middleware/errorHandler';
import { initFirebase } from './services/fcmService';
import { validateConfig } from '../../../shared/config/env';

const app = express();
const PORT = Number(process.env.NOTIFICATION_PORT ?? 3003);

// Initialize early config validation
validateConfig();

// Initialize Firebase Admin SDK
initFirebase();

app.use(helmet());
app.use(cors({
    origin: process.env.NODE_ENV === 'development'
        ? true
        : (process.env.CORS_ORIGINS ?? '').split(',').map(o => o.trim()),
}));
app.use(express.json({ limit: '5mb' }));
app.use(morgan('combined'));

app.use('/health', healthRouter);
app.use('/api/notify', notifyRouter);
app.use(errorHandler);

const httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[notification-service] Running on port ${PORT}`);
});

// ── Graceful Shutdown ─────────────────────────────────────────
function shutdown(signal: string): void {
    console.log(`[notification-service] ${signal} — shutting down`);
    httpServer.close(() => {
        console.log('[notification-service] HTTP server closed');
        process.exit(0);
    });
    // Force exit if shutdown takes too long
    setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
