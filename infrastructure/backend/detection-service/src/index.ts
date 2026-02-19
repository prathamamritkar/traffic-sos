// ============================================================
// RescuEdge Detection Service — Entry Point
// Responsibilities:
//   1. Receive SOS POST from user-app
//   2. Validate crash metrics (multi-stage)
//   3. Generate AccidentID
//   4. Publish to MQTT event stream
//   5. Forward to notification-service & corridor-service
// ============================================================
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { sosRouter } from './routes/sos';
import { healthRouter } from './routes/health';
import { broadcastRouter } from './routes/broadcast';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';

const app = express();
const PORT = process.env.DETECTION_PORT ?? 3001;

// ── Security & Middleware ─────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'PATCH'] }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined'));

// ── Rate Limiting ─────────────────────────────────────────────
const limiter = rateLimit({
    windowMs: 60 * 1000,   // 1 minute
    max: 100,
    message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

// ── Routes ────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'detection-service' }));
app.use('/api/sos', authMiddleware, sosRouter);
app.use('/api/broadcast', broadcastRouter);

// ── Error Handler ─────────────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`[detection-service] Running on port ${PORT} (${process.env.NODE_ENV ?? 'development'})`);
});

export default app;
