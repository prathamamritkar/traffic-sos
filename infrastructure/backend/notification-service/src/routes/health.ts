import { Router } from 'express';
export const healthRouter = Router();
healthRouter.get('/', (_req, res) => {
    res.json({ service: 'notification-service', status: 'healthy', timestamp: new Date().toISOString() });
});
