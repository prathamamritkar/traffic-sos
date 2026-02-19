import { Router, Request, Response } from 'express';
import { corridorEngine } from '../services/corridorEngine';
import { v4 as uuidv4 } from 'uuid';

export const corridorRouter = Router();

// POST /api/corridor/init — called by detection-service when SOS is received
corridorRouter.post('/init', (req: Request, res: Response) => {
    const { payload } = req.body;
    if (!payload?.accidentId || !payload?.location) {
        res.status(400).json({ error: 'Missing accidentId or location' });
        return;
    }
    console.log(`[corridor-service] Corridor initialized for ${payload.accidentId}`);
    res.json({ payload: { accidentId: payload.accidentId, status: 'CORRIDOR_INITIALIZED' } });
});

// POST /api/corridor/location — ambulance location update
corridorRouter.post('/location', (req: Request, res: Response) => {
    corridorEngine.processAmbulanceUpdate(req.body);
    res.json({ payload: { status: 'PROCESSED' } });
});

// GET /api/corridor/signals — get all signal states
corridorRouter.get('/signals', (_req: Request, res: Response) => {
    const signals = corridorEngine.getAllSignals();
    res.json({
        meta: { requestId: `REQ-${uuidv4()}`, timestamp: new Date().toISOString(), env: process.env.NODE_ENV ?? 'development', version: '1.0' },
        payload: { signals, total: signals.length },
    });
});

// GET /api/corridor/signals/:id — get specific signal
corridorRouter.get('/signals/:id', (req: Request, res: Response) => {
    const signal = corridorEngine.getSignal(req.params.id);
    if (!signal) {
        res.status(404).json({ error: 'Signal not found' });
        return;
    }
    res.json({ payload: signal });
});

// GET /api/corridor/active — get active corridors
corridorRouter.get('/active', (_req: Request, res: Response) => {
    res.json({ payload: corridorEngine.getActiveCorridors() });
});
