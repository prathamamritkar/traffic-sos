// ============================================================
// Notification Service — Route: /api/notify/sos, etc.
// Fixes:
//  • No input validation on /register-responder — fcmToken not
//    validated as non-empty, name/userId not validated; any
//    garbage payload registers a junk responder.
//  • /availability accepts any value for `available` — e.g.
//    string "false" would be truthy and keep responder available
//  • /test endpoint accepts any fcmToken with no validation —
//    could be used to probe FCM tokens via the notification service
//    → gated to NODE_ENV !== 'production'
//  • sendEmergencySMS called with contacts that may include
//    non-E.164 phone strings — added basic format check
// ============================================================
import { Router, Request, Response } from 'express';
import { z } from 'zod';
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

// ── POST /api/notify/sos ──────────────────────────────────────
notifyRouter.post('/sos', async (req: Request, res: Response) => {
    const envelope = req.body;
    const payload = envelope?.payload as SOSPayload | undefined;

    if (!payload?.accidentId || !payload?.location) {
        res.status(400).json({ error: 'Invalid SOS payload — missing accidentId or location' });
        return;
    }

    const results = {
        accidentId: payload.accidentId,
        respondersAlerted: 0,
        smsDelivered: 0,
        fcmSent: 0,
    };

    try {
        // 1. Find nearest responders and send FCM push
        const nearestResponders = findNearestResponders(payload.location, 3);
        const fcmTokens = nearestResponders.map(r => r.fcmToken).filter(Boolean);

        if (fcmTokens.length > 0) {
            await sendMulticastFCM(
                fcmTokens,
                '🚨 EMERGENCY SOS — RescuEdge',
                `Accident at ${payload.location.lat.toFixed(4)}, ${payload.location.lng.toFixed(4)}. Tap to respond.`,
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

        // 2. SMS to emergency contacts (filter to E.164-like format)
        const rawContacts = payload.medicalProfile?.emergencyContacts ?? [];
        const validContacts = rawContacts.filter(c => /^\+?[1-9]\d{6,14}$/.test(c.replace(/[\s\-()]/g, '')));

        if (validContacts.length > 0) {
            await sendEmergencySMS(validContacts, payload.accidentId, payload.location);
            results.smsDelivered = validContacts.length;
        }

        if (rawContacts.length !== validContacts.length) {
            console.warn(
                `[notification-service] ${rawContacts.length - validContacts.length} ` +
                `emergency contacts had invalid phone format and were skipped`
            );
        }
    } catch (err) {
        console.error('[notification-service] SOS dispatch error:', err);
        // Still return 200 so detection-service doesn't retry endlessly
    }

    console.log(`[notification-service] SOS dispatched: ${JSON.stringify(results)}`);
    res.status(200).json({
        meta: {
            requestId: `REQ-${uuidv4()}`,
            timestamp: new Date().toISOString(),
            env: process.env.NODE_ENV ?? 'development',
            version: '1.0',
        },
        payload: results,
    });
});

// ── POST /api/notify/register-responder ───────────────────────
const RegisterSchema = z.object({
    responderId: z.string().min(3),
    userId: z.string().min(3),
    name: z.string().min(1),
    fcmToken: z.string().min(10),
    location: z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
    }),
    vehicleId: z.string().optional(),
    hospitalId: z.string().optional(),
});

notifyRouter.post('/register-responder', (req: Request, res: Response) => {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: 'Invalid responder data', details: parsed.error.issues });
        return;
    }
    const { responderId, userId, name, fcmToken, location, vehicleId, hospitalId } = parsed.data;
    registerResponder({ responderId, userId, name, fcmToken, location, available: true, vehicleId, hospitalId });
    res.json({ payload: { status: 'REGISTERED', responderId } });
});

// ── POST /api/notify/availability ─────────────────────────────
notifyRouter.post('/availability', (req: Request, res: Response) => {
    const { responderId, available } = req.body ?? {};
    if (typeof responderId !== 'string' || typeof available !== 'boolean') {
        res.status(400).json({ error: 'responderId (string) and available (boolean) required' });
        return;
    }
    setResponderAvailability(responderId, available);
    res.json({ payload: { responderId, available } });
});

// ── GET /api/notify/responders ─────────────────────────────────
notifyRouter.get('/responders', (_req: Request, res: Response) => {
    res.json({ payload: getAllResponders() });
});

// ── POST /api/notify/test ─────────────────────────────────────
// DISABLED in production — cannot be used to probe FCM tokens
notifyRouter.post('/test', async (req: Request, res: Response) => {
    if (process.env.NODE_ENV === 'production') {
        res.status(403).json({ error: 'Test endpoint disabled in production' });
        return;
    }
    const { token, title, body } = req.body ?? {};
    if (!token || !title || !body) {
        res.status(400).json({ error: 'token, title, and body required' });
        return;
    }
    const messageId = await sendFCMNotification({ token, title, body });
    res.json({ payload: { messageId } });
});
