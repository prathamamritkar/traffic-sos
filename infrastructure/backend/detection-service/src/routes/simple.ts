import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { mqttClient } from '../services/mqttClient';
import { caseStore } from '../services/caseStore';
import type { 
    CaseRecord, 
    SOSPayload, 
    RCTFEnvelope,
    GeoPoint
} from '../../../../shared/models/rctf';

export const simpleRouter = Router();

// Help Generate a unique ID (matched with the existing logic)
function generateAccidentId(): string {
    const year = new Date().getFullYear();
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ACC-${year}-${rand}`;
}

/**
 * @route   POST /api/simple/sos
 * @desc    Unauthenticated simple SOS for easy integration/testing
 * @body    { lat: number, lng: number }
 */
simpleRouter.post('/sos', async (req: Request, res: Response) => {
    console.log(`[detection-service] 📥 Incoming Simple SOS from ${req.ip}`);
    const { lat, lng } = req.body;

    // 1. Basic Validation
    if (typeof lat !== 'number' || typeof lng !== 'number') {
        res.status(400).json({ 
            error: 'Missing or invalid location', 
            expected: '{ "lat": number, "lng": number }' 
        });
        return;
    }

    const accidentId = generateAccidentId();
    const userId = 'anonymous-user';
    const timestamp = new Date().toISOString();

    const location: GeoPoint = { lat, lng };

    // 2. Build Case Record (internal storage)
    const caseRecord: CaseRecord = {
        accidentId,
        victimUserId: userId,
        location,
        status: 'DETECTED',
        metrics: {
            gForce: 0,
            speedBefore: 0,
            speedAfter: 0,
            mlConfidence: 1.0,
            crashType: 'MANUAL_SOS',
            rolloverDetected: false
        },
        medicalProfile: {
            bloodGroup: 'UNKNOWN',
            age: 0,
            gender: 'OTHER',
            allergies: [],
            medications: [],
            conditions: [],
            emergencyContacts: []
        },
        createdAt: timestamp,
    };

    // 3. Store Case
    caseStore.set(accidentId, caseRecord);

    // 4. Build RCTF Envelope for system-wide broadcast
    // This allows the dashboard and other services to see the incident
    const rctfEnvelope: RCTFEnvelope<SOSPayload> = {
        meta: {
            requestId: `REQ-${uuidv4()}`,
            timestamp,
            env: 'development',
            version: '1.0',
        },
        auth: { 
            userId, 
            role: 'USER', 
            token: 'bypass-auth-simple' 
        },
        payload: {
            accidentId,
            location,
            metrics: caseRecord.metrics,
            medicalProfile: caseRecord.medicalProfile,
            victimUserId: userId,
            status: 'DETECTED',
            createdAt: timestamp
        },
    };

    // 5. Publish to MQTT (So it shows up on the Dashboard instantly)
    mqttClient.publish(
        `rescuedge/sos/${accidentId}`,
        JSON.stringify(rctfEnvelope),
        { qos: 1 }
    );

    console.log(`[detection-service] Simple SOS accepted: ${accidentId} at (${lat}, ${lng})`);

    // 6. Response
    res.status(201).json({
        success: true,
        accidentId,
        message: 'Accident reported successfully',
        location: { lat, lng }
    });
});
