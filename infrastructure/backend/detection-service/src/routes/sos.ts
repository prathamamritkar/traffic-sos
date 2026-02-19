// ============================================================
// SOS Route — Core crash ingestion pipeline
// POST /api/sos          — receive SOS from user-app
// GET  /api/sos/:id      — get case status
// PATCH /api/sos/:id/cancel — cancel SOS (user pressed cancel)
// ============================================================
import { Router, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { mqttClient } from '../services/mqttClient';
import { caseStore } from '../services/caseStore';
import { validateCrash } from '../services/crashValidator';
import type { AuthenticatedRequest } from '../middleware/auth';
import type {
    RCTFEnvelope,
    SOSPayload,
    CaseRecord,
} from '../../../../shared/models/rctf';

export const sosRouter = Router();

// ── Zod schema for incoming SOS body ─────────────────────────
const GeoPointSchema = z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accuracy: z.number().optional(),
    altitude: z.number().optional(),
    heading: z.number().optional(),
    speed: z.number().optional(),
});

const CrashMetricsSchema = z.object({
    gForce: z.number().min(0),
    speedBefore: z.number().min(0),
    speedAfter: z.number().min(0),
    mlConfidence: z.number().min(0).max(1),
    crashType: z.enum(['CONFIRMED_CRASH', 'PHONE_DROP', 'POTHOLE', 'HARD_BRAKE', 'UNKNOWN']),
    rolloverDetected: z.boolean(),
    impactDirection: z.enum(['FRONT', 'REAR', 'LEFT', 'RIGHT', 'ROLLOVER']).optional(),
});

const MedicalProfileSchema = z.object({
    bloodGroup: z.string(),
    age: z.number().int().min(0).max(150),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
    allergies: z.array(z.string()),
    medications: z.array(z.string()),
    conditions: z.array(z.string()),
    emergencyContacts: z.array(z.string()),
});

const SOSBodySchema = z.object({
    meta: z.object({
        requestId: z.string(),
        timestamp: z.string(),
        env: z.enum(['development', 'staging', 'production']),
        version: z.literal('1.0'),
    }),
    auth: z.object({
        userId: z.string(),
        role: z.enum(['USER', 'RESPONDER', 'ADMIN']),
        token: z.string(),
    }),
    payload: z.object({
        location: GeoPointSchema,
        metrics: CrashMetricsSchema,
        medicalProfile: MedicalProfileSchema,
    }),
});

// ── POST /api/sos ─────────────────────────────────────────────
sosRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
    // 1. Validate RCTF envelope
    const parsed = SOSBodySchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: 'Invalid RCTF payload', details: parsed.error.issues });
        return;
    }

    const { payload, auth, meta } = parsed.data;

    // 2. Multi-stage crash validation
    const validationResult = validateCrash(payload.metrics as any);
    if (!validationResult.valid) {
        res.status(422).json({
            error: 'Crash validation failed',
            reason: validationResult.reason,
            stage: validationResult.failedStage,
        });
        return;
    }

    // 3. Generate AccidentID
    const year = new Date().getFullYear();
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    const accidentId = `ACC-${year}-${rand}`;

    // 4. Build case record
    const caseRecord: CaseRecord = {
        accidentId,
        victimUserId: auth.userId,
        location: payload.location as any,
        status: 'DETECTED',
        metrics: payload.metrics as any,
        medicalProfile: payload.medicalProfile as any,
        createdAt: new Date().toISOString(),
    };

    // 5. Store case
    caseStore.set(accidentId, caseRecord);

    // 6. Build RCTF SOS payload
    const sosPayload: SOSPayload = {
        accidentId,
        location: payload.location as any,
        metrics: payload.metrics as any,
        medicalProfile: payload.medicalProfile as any,
        victimUserId: auth.userId,
        status: 'DETECTED',
        createdAt: new Date().toISOString(),
    };

    const rctfEnvelope: RCTFEnvelope<SOSPayload> = {
        meta: {
            requestId: `REQ-${uuidv4()}`,
            timestamp: new Date().toISOString(),
            env: meta.env,
            version: '1.0',
        },
        auth: {
            userId: auth.userId,
            role: auth.role,
            token: auth.token,
        },
        payload: sosPayload,
    };

    // 7. Publish to MQTT event stream
    mqttClient.publish(
        `rescuedge/sos/${accidentId}`,
        JSON.stringify(rctfEnvelope),
        { qos: 1, retain: false }
    );

    // 8. Forward to notification-service (fire-and-forget)
    const notifyUrl = process.env.NOTIFICATION_SERVICE_URL ?? 'http://localhost:3003';
    axios.post(`${notifyUrl}/api/notify/sos`, rctfEnvelope, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000,
    }).catch((err: Error) => {
        console.error('[detection-service] Failed to notify notification-service:', err.message);
    });

    // 9. Forward to corridor-service (fire-and-forget)
    const corridorUrl = process.env.CORRIDOR_SERVICE_URL ?? 'http://localhost:3002';
    axios.post(`${corridorUrl}/api/corridor/init`, rctfEnvelope, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000,
    }).catch((err: Error) => {
        console.error('[detection-service] Failed to init corridor:', err.message);
    });

    console.log(`[detection-service] SOS accepted: ${accidentId} from ${auth.userId}`);

    // 10. Respond with RCTF envelope
    res.status(201).json({
        meta: {
            requestId: `REQ-${uuidv4()}`,
            timestamp: new Date().toISOString(),
            env: meta.env,
            version: '1.0',
        },
        auth: { userId: auth.userId, role: auth.role, token: '' },
        payload: {
            accidentId,
            status: 'DETECTED',
            message: 'SOS received and dispatched',
        },
    });
});

// ── GET /api/sos/:id ──────────────────────────────────────────
sosRouter.get('/:id', (req: AuthenticatedRequest, res: Response) => {
    const caseRecord = caseStore.get(req.params.id);
    if (!caseRecord) {
        res.status(404).json({ error: 'Case not found' });
        return;
    }
    res.json({
        meta: {
            requestId: `REQ-${uuidv4()}`,
            timestamp: new Date().toISOString(),
            env: process.env.NODE_ENV ?? 'development',
            version: '1.0',
        },
        auth: req.rctfAuth,
        payload: caseRecord,
    });
});

// ── PATCH /api/sos/:id/cancel ─────────────────────────────────
sosRouter.patch('/:id/cancel', (req: AuthenticatedRequest, res: Response) => {
    const caseRecord = caseStore.get(req.params.id);
    if (!caseRecord) {
        res.status(404).json({ error: 'Case not found' });
        return;
    }

    if (caseRecord.status !== 'DETECTED') {
        res.status(409).json({ error: 'Cannot cancel — case already dispatched' });
        return;
    }

    caseRecord.status = 'CANCELLED';
    caseStore.set(req.params.id, caseRecord);

    mqttClient.publish(
        `rescuedge/sos/${req.params.id}/cancel`,
        JSON.stringify({ accidentId: req.params.id, status: 'CANCELLED' }),
        { qos: 1 }
    );

    console.log(`[detection-service] SOS cancelled: ${req.params.id}`);
    res.json({ payload: { accidentId: req.params.id, status: 'CANCELLED' } });
});

// ── PATCH /api/sos/:id/status ─────────────────────────────────
sosRouter.patch('/:id/status', (req: AuthenticatedRequest, res: Response) => {
    const { status } = req.body?.payload ?? req.body;
    const caseRecord = caseStore.get(req.params.id);
    if (!caseRecord) {
        res.status(404).json({ error: 'Case not found' });
        return;
    }

    caseRecord.status = status;
    if (status === 'RESOLVED') {
        caseRecord.resolvedAt = new Date().toISOString();
    }
    caseStore.set(req.params.id, caseRecord);

    mqttClient.publish(
        `rescuedge/case/${req.params.id}/status`,
        JSON.stringify({ accidentId: req.params.id, status }),
        { qos: 1 }
    );

    res.json({ payload: { accidentId: req.params.id, status } });
});

// ── GET /api/sos (list all active cases) ─────────────────────
sosRouter.get('/', (_req: AuthenticatedRequest, res: Response) => {
    const cases = Array.from(caseStore.values());
    res.json({
        meta: {
            requestId: `REQ-${uuidv4()}`,
            timestamp: new Date().toISOString(),
            env: process.env.NODE_ENV ?? 'development',
            version: '1.0',
        },
        payload: { cases, total: cases.length },
    });
});
