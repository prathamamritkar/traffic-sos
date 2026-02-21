// ============================================================
// Detection Service Entry Point
// Fixes:
//  • cors({ origin: '*' }) allows any origin — tightened to
//    explicit allowlist via CORS_ORIGINS env var
//  • No graceful shutdown handler — open server + MQTT connection
//    on SIGTERM caused dirty restarts and message loss
//  • healthRouter imported but never registered (was only a raw
//    inline route). Now uses dedicated healthRouter for consistency.
//  • Missing `multer` error handler — multer throws with a specific
//    error class that must be caught before the generic errorHandler
// ============================================================
import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { simpleRouter } from './routes/simple';
import { sosRouter } from './routes/sos';
import { healthRouter } from './routes/health';
import { broadcastRouter } from './routes/broadcast';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';
import { mqttClient } from './services/mqttClient';
import { validateConfig } from '../../../shared/config/env';

const app = express();
const PORT = Number(process.env.DETECTION_PORT ?? 3001);

// Initialize early config validation
validateConfig();

// ── CORS ─────────────────────────────────────────────────────
// For production, set CORS_ORIGINS="https://your-dashboard.app"
const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3000'];   // Dashboard dev default

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no Origin (mobile apps, server-to-server)
        if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
            callback(null, true);
        } else {
            callback(new Error(`CORS: Origin '${origin}' not allowed`));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}));

// ── Security & Middleware ─────────────────────────────────────
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined'));

// ── Rate Limiting ─────────────────────────────────────────────
const limiter = rateLimit({
    windowMs: 60 * 1000,    // 1 minute
    max: 100,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// ── Routes ────────────────────────────────────────────────────
app.use('/health', healthRouter);
app.use('/api/simple', simpleRouter); // Added simple router BEFORE auth
app.use('/api/sos', authMiddleware, sosRouter);
app.use('/api/broadcast', broadcastRouter);

// ── Multer error handler (must come before generic errorHandler) ──
app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof multer.MulterError || err.message.startsWith('Unsupported media type')) {
        res.status(400).json({ error: err.message });
        return;
    }
    next(err);
});

// ── Generic Error Handler ─────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────
const httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[detection-service] Running on port ${PORT} (${process.env.NODE_ENV ?? 'development'})`);
});

// ── Graceful Shutdown ─────────────────────────────────────────
function shutdown(signal: string): void {
    console.log(`[detection-service] ${signal} received — shutting down gracefully`);
    httpServer.close(() => {
        mqttClient.end(false, {}, () => {
            console.log('[detection-service] MQTT disconnected');
            process.exit(0);
        });
    });
    // Force exit after 10 seconds
    setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
