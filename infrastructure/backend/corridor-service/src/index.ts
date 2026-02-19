// ============================================================
// RescuEdge Corridor Service — Entry Point
// Responsibilities:
//   1. Receive ambulance GPS updates
//   2. Geospatial lookup of traffic signals within 500m
//   3. Publish MQTT signal flip commands (GREEN)
//   4. Restore signals after ambulance passes
//   5. Broadcast corridor state to dashboard
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

const app = express();
const PORT = process.env.CORRIDOR_PORT ?? 3002;

app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '5mb' }));
app.use(morgan('combined'));

app.use('/health', healthRouter);
app.use('/api/corridor', corridorRouter);
app.use(errorHandler);

// Subscribe to ambulance location updates via MQTT
mqttClient.subscribe('rescuedge/ambulance/+/location', { qos: 1 }, (err) => {
    if (err) console.error('[corridor-service] MQTT subscribe error:', err.message);
    else console.log('[corridor-service] Subscribed to ambulance location topics');
});

mqttClient.on('message', (topic: string, message: Buffer) => {
    if (topic.startsWith('rescuedge/ambulance/') && topic.endsWith('/location')) {
        try {
            const data = JSON.parse(message.toString());
            corridorEngine.processAmbulanceUpdate(data);
        } catch (e) {
            console.error('[corridor-service] Failed to parse MQTT message:', e);
        }
    }
});

app.listen(PORT, () => {
    console.log(`[corridor-service] Running on port ${PORT}`);
});

export default app;
