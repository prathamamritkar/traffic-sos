import { Router } from 'express';
import { mqttClient } from '../services/mqttClient';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
    const isMqttConnected = mqttClient.connected;
    const status = isMqttConnected ? 'healthy' : 'degraded';

    res.status(isMqttConnected ? 200 : 503).json({
        service: 'corridor-service',
        status,
        mqtt: isMqttConnected ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});
