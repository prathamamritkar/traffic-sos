import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { sendFCMNotification, sendMulticastFCM } from '../services/fcmService';
import { sendEmergencySMS } from '../services/smsService';
import {
    findNearestResponders,
    registerResponder,
    setResponderAvailability,
    getAllResponders,
} from '../services/responderRegistry';
import type { SOSPayload } from '../../../../shared/models/rctf';

export const notifyRouter = Router();

// POST /api/notify/sos — called by detection-service
notifyRouter.post('/sos', async (req: Request, res: Response) => {
    const envelope = req.body;
    const payload = envelope?.payload as SOSPayload;

    if (!payload?.accidentId || !payload?.location) {
        res.status(400).json({ error: 'Invalid SOS payload' });
        return;
    }

    const results = {
        accidentId: payload.accidentId,
        respondersAlerted: 0,
        smsDelivered: 0,
        fcmSent: 0,
    };

    // 1. Find nearest responders and send FCM
    const nearestResponders = findNearestResponders(payload.location, 3);
    const fcmTokens = nearestResponders.map((r) => r.fcmToken).filter(Boolean);

    if (fcmTokens.length > 0) {
        await sendMulticastFCM(
            fcmTokens,
            '🚨 EMERGENCY SOS — RescuEdge',
            `Accident detected at ${payload.location.lat.toFixed(4)}, ${payload.location.lng.toFixed(4)}. Tap to respond.`,
            {
                accidentId: payload.accidentId,
                lat: String(payload.location.lat),
                lng: String(payload.location.lng),
                bloodGroup: payload.medicalProfile?.bloodGroup ?? '',
                type: 'SOS_ALERT',
            }
        );
        results.fcmSent = fcmTokens.length;
        results.respondersAlerted = nearestResponders.length;
    }

    // 2. SMS to emergency contacts
    const contacts = payload.medicalProfile?.emergencyContacts ?? [];
    if (contacts.length > 0) {
        await sendEmergencySMS(contacts, payload.accidentId, payload.location);
        results.smsDelivered = contacts.length;
    }

    console.log(`[notification-service] SOS dispatched: ${JSON.stringify(results)}`);
    res.status(200).json({
        meta: { requestId: `REQ-${uuidv4()}`, timestamp: new Date().toISOString(), env: process.env.NODE_ENV ?? 'development', version: '1.0' },
        payload: results,
    });
});

// POST /api/notify/register-responder — register FCM token for responder
notifyRouter.post('/register-responder', (req: Request, res: Response) => {
    const { responderId, userId, name, fcmToken, location, vehicleId, hospitalId } = req.body;
    if (!responderId || !fcmToken) {
        res.status(400).json({ error: 'responderId and fcmToken required' });
        return;
    }
    registerResponder({ responderId, userId, name, fcmToken, location, available: true, vehicleId, hospitalId });
    res.json({ payload: { status: 'REGISTERED', responderId } });
});

// POST /api/notify/availability — update responder availability
notifyRouter.post('/availability', (req: Request, res: Response) => {
    const { responderId, available } = req.body;
    setResponderAvailability(responderId, available);
    res.json({ payload: { responderId, available } });
});

// GET /api/notify/responders — list all responders
notifyRouter.get('/responders', (_req: Request, res: Response) => {
    res.json({ payload: getAllResponders() });
});

// POST /api/notify/test — test notification
notifyRouter.post('/test', async (req: Request, res: Response) => {
    const { token, title, body } = req.body;
    const messageId = await sendFCMNotification({ token, title, body });
    res.json({ payload: { messageId } });
});
