import { Router } from 'express';
import admin from 'firebase-admin';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
    // Check if Firebase app is initialized
    const isFirebaseReady = admin.apps.length > 0;
    const status = isFirebaseReady ? 'healthy' : 'degraded';

    res.status(isFirebaseReady ? 200 : 503).json({
        service: 'notification-service',
        status,
        firebase: isFirebaseReady ? 'initialized' : 'missing_credentials',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});
