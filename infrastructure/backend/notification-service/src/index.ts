// ============================================================
// RescuEdge Notification Service — Entry Point
// Responsibilities:
//   1. Receive SOS events from detection-service
//   2. Find nearest available responders
//   3. Send FCM push to responder app
//   4. Send SMS to victim's emergency contacts via Twilio
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

const app = express();
const PORT = process.env.NOTIFICATION_PORT ?? 3003;

// Initialize Firebase Admin SDK
initFirebase();

app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '5mb' }));
app.use(morgan('combined'));

app.use('/health', healthRouter);
app.use('/api/notify', notifyRouter);
app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`[notification-service] Running on port ${PORT}`);
});

export default app;
