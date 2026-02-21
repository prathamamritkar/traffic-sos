
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const JWT_SECRET = 'rescuedge-dev-secret-change-in-prod';
const DETECTION_SERVICE_URL = 'http://localhost:3001';

async function simulateAccident() {
    console.log('🚀 Starting RescuEdge Accident Simulation...');

    // 1. Generate Demo Auth Token
    const authPayload = {
        userId: 'U-DEMO-DEVICE-001',
        role: 'USER',
    };
    const token = jwt.sign(authPayload, JWT_SECRET, { expiresIn: '1h' });

    // 2. Build RCTF Envelope
    const envelope = {
        meta: {
            requestId: `REQ-${uuidv4()}`,
            timestamp: new Date().toISOString(),
            env: 'development',
            version: '1.0',
        },
        auth: {
            userId: authPayload.userId,
            role: authPayload.role,
            token: token,
        },
        payload: {
            location: {
                lat: 18.5204, // Pune Center
                lng: 73.8567,
                accuracy: 5.0,
                speed: 12.5, // 45 km/h approx
            },
            metrics: {
                gForce: 9.2, // High G-force (auto-confirm)
                speedBefore: 45.0,
                speedAfter: 0.0,
                mlConfidence: 0.98,
                crashType: 'CONFIRMED_CRASH',
                rolloverDetected: true,
                impactDirection: 'FRONT',
            },
            medicalProfile: {
                bloodGroup: 'O+',
                age: 28,
                gender: 'MALE',
                allergies: ['Penicillin'],
                medications: [],
                conditions: ['Asthma'],
                emergencyContacts: ['+91 98765 43210'],
            },
            deviceInfo: {
                batteryLevel: 42,
                batteryStatus: 'discharging',
                networkType: '5G'
            },
            sceneAnalysis: {
                injurySeverity: 'CRITICAL',
                victimCount: 2,
                visibleHazards: ['Fuel Leak', 'Smoke'],
                urgencyLevel: 'IMMEDIATE',
                suggestedActions: ['Deploy Fire suppression', 'Immediate extraction']
            }
        },
    };

    console.log('📦 Dispatching SOS Envelope to Detection Service...');

    try {
        const response = await fetch(`${DETECTION_SERVICE_URL}/api/sos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(envelope),
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('❌ SOS Dispatch Failed:', error);
            return;
        }

        const data = await response.json();
        const accidentId = data.payload.accidentId;

        console.log('✅ SOS Accepted!');
        console.log('🆔 Accident ID:', accidentId);
        console.log('📡 Dashboard should now reflect this situation.');
        console.log('🔗 View live feed at: http://localhost:3000/dashboard');
        console.log('🔑 Login: admin@rescuedge.app / rescuedge2026');

    } catch (err: any) {
        console.error('❌ Network Error:', err.message);
    }
}

simulateAccident();
