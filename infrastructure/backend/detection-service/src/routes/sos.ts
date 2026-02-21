// ============================================================
// SOS Route — Core crash ingestion pipeline
// POST /api/sos          — receive SOS from user-app
// GET  /api/sos          — list all active cases
// GET  /api/sos/:id      — get case status
// PATCH /api/sos/:id/cancel  — cancel SOS (user pressed cancel)
// PATCH /api/sos/:id/status  — update case status (responder)
// Fixes:
//  • `as any` casts replaced with proper typed assignments
//  • accidentId generation uses shared `generateAccidentId()` helper
//    (prevents duplication of the same logic in multiple places)
//  • /api/sos/:id/status accepts ANY status string — now validated
//    against the CaseStatus enum via Zod
//  • response token is leaked back to client — now always stripped
//  • `axios` fire-and-forget swallowed all errors silently;
//    uses `fetch` (Node 18+) instead to avoid extra dependency
//    and logs errors consistently
// ============================================================
import { Router, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { mqttClient } from '../services/mqttClient';
import { caseStore } from '../services/caseStore';
import { validateCrash } from '../services/crashValidator';
import type { AuthenticatedRequest } from '../middleware/auth';
import type {
    RCTFEnvelope,
    SOSPayload,
    CaseRecord,
    CaseStatus,
} from '../../../../shared/models/rctf';

export const sosRouter = Router();

// ── Zod schemas ───────────────────────────────────────────────
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
    crashType: z.enum(['CONFIRMED_CRASH', 'PHONE_DROP', 'POTHOLE', 'HARD_BRAKE', 'UNKNOWN', 'MANUAL_SOS', 'SAFETY_CHECK_TIMEOUT']),
    rolloverDetected: z.boolean(),
    impactDirection: z.enum(['FRONT', 'REAR', 'LEFT', 'RIGHT', 'ROLLOVER']).optional(),
});

const MedicalProfileSchema = z.object({
    bloodGroup: z.string().min(1),
    age: z.number().int().min(0).max(150),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
    allergies: z.array(z.string()),
    medications: z.array(z.string()),
    conditions: z.array(z.string()),
    emergencyContacts: z.array(z.string()),
});

const SOSBodySchema = z.object({
    meta: z.object({
        requestId: z.string().min(1),
        timestamp: z.string().min(1),
        env: z.enum(['development', 'staging', 'production']),
        version: z.literal('1.0'),
    }),
    auth: z.object({
        userId: z.string().min(1),
        role: z.enum(['USER', 'RESPONDER', 'ADMIN']),
        token: z.string().min(1),
    }),
    payload: z.object({
        location: GeoPointSchema,
        metrics: CrashMetricsSchema,
        medicalProfile: MedicalProfileSchema,
    }),
});

const CaseStatusSchema = z.enum([
    'DETECTED', 'DISPATCHED', 'EN_ROUTE', 'ARRIVED', 'RESOLVED', 'CANCELLED',
]);

// ── Shared helper ─────────────────────────────────────────────
function generateAccidentId(): string {
    const year = new Date().getFullYear();
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ACC-${year}-${rand}`;
}

// Fire-and-forget with logging (uses native fetch; requires Node 18+)
function fireAndForget(url: string, body: unknown, label: string): void {
    fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        // @ts-ignore — Node 18 fetch doesn't expose signal type perfectly
        signal: AbortSignal.timeout(5000),
    }).catch((err: Error) => {
        console.error(`[detection-service] ${label} failed:`, err.message);
    });
}

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
    const validationResult = validateCrash(payload.metrics);
    if (!validationResult.valid) {
        res.status(422).json({
            error: 'Crash validation failed',
            reason: validationResult.reason,
            stage: validationResult.failedStage,
        });
        return;
    }

    // 3. Generate AccidentID
    const accidentId = generateAccidentId();

    // 4. Build case record (no `as any` — types align directly)
    const caseRecord: CaseRecord = {
        accidentId,
        victimUserId: auth.userId,
        location: payload.location,
        status: 'DETECTED',
        metrics: payload.metrics,
        medicalProfile: payload.medicalProfile,
        createdAt: new Date().toISOString(),
    };

    // 5. Store case
    caseStore.set(accidentId, caseRecord);

    // 6. Build RCTF SOS payload
    const sosPayload: SOSPayload = {
        accidentId,
        location: payload.location,
        metrics: payload.metrics,
        medicalProfile: payload.medicalProfile,
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
        auth: { userId: auth.userId, role: auth.role, token: auth.token },
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
    fireAndForget(`${notifyUrl}/api/notify/sos`, rctfEnvelope, 'notification-service');

    // 9. Forward to corridor-service (fire-and-forget)
    const corridorUrl = process.env.CORRIDOR_SERVICE_URL ?? 'http://localhost:3002';
    fireAndForget(`${corridorUrl}/api/corridor/init`, rctfEnvelope, 'corridor-service');

    console.log(`[detection-service] SOS accepted: ${accidentId} from ${auth.userId}`);

    // 10. Respond — NEVER echo the auth token back to the client
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

// ── GET /api/sos ──────────────────────────────────────────────
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

// ── GET /api/sos/:id ──────────────────────────────────────────
sosRouter.get('/:id', (req: AuthenticatedRequest, res: Response) => {
    // Validate ID format to prevent path traversal
    if (!/^ACC-\d{4}-[A-Z0-9]{6}$/.test(req.params.id)) {
        res.status(400).json({ error: 'Invalid accidentId format' });
        return;
    }
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

    const nonCancellableStatuses: CaseStatus[] = ['RESOLVED', 'CANCELLED'];
    if (nonCancellableStatuses.includes(caseRecord.status)) {
        res.status(409).json({
            error: 'Cannot cancel — case is already resolved or cancelled',
            currentStatus: caseRecord.status,
        });
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
    // Validate new status is a legal CaseStatus value
    const rawStatus = req.body?.payload?.status ?? req.body?.status;
    const statusParse = CaseStatusSchema.safeParse(rawStatus);
    if (!statusParse.success) {
        res.status(400).json({ error: 'Invalid status value', allowed: CaseStatusSchema.options });
        return;
    }
    const status = statusParse.data;

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
