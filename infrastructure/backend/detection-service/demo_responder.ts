
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'rescuedge-dev-secret-change-in-prod';
const DETECTION_SERVICE_URL = 'http://localhost:3001';
const TRACKING_SERVICE_URL = 'http://localhost:3004';

// Default accidentId from previous simulation
const ACCIDENT_ID = process.argv[2] || 'ACC-2026-55BU79';

async function simulateResponder() {
    console.log(`🚑 Starting Responder Simulation for Case: ${ACCIDENT_ID}`);

    // 1. Generate Responder Auth Token
    const authPayload = {
        userId: 'U-RESPONDER-911',
        role: 'RESPONDER',
    };
    const token = jwt.sign(authPayload, JWT_SECRET, { expiresIn: '1h' });

    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    // ── STEP 1: Dispatch Responder ────────────────────────────
    console.log('🔄 Status Update: DISPATCHED');
    await updateStatus(ACCIDENT_ID, 'DISPATCHED', token);
    await delay(2000);

    // ── STEP 2: En Route ──────────────────────────────────────
    console.log('🔄 Status Update: EN_ROUTE');
    await updateStatus(ACCIDENT_ID, 'EN_ROUTE', token);
    await delay(2000);

    // Move with a slight detour to force OSRM to follow real roads
    const path = [
        { lat: 18.4950, lng: 73.8350 }, // Starting Station
        { lat: 18.5000, lng: 73.8400 },
        { lat: 18.5040, lng: 73.8410 },
        { lat: 18.5080, lng: 73.8420 },
        { lat: 18.5120, lng: 73.8450 },
        { lat: 18.5150, lng: 73.8480 },
        { lat: 18.5170, lng: 73.8500 },
        { lat: 18.5180, lng: 73.8520 },
        { lat: 18.5195, lng: 73.8545 },
        { lat: 18.5204, lng: 73.8567 }, // Destination
    ];

    for (const point of path) {
        console.log(`   [GPS] Lat: ${point.lat.toFixed(4)}, Lng: ${point.lng.toFixed(4)} (Slow Motion)`);

        await sendLocationUpdate({
            entityId: 'AMB-REGION-102',
            entityType: 'AMBULANCE',
            accidentId: ACCIDENT_ID,
            location: {
                lat: point.lat,
                lng: point.lng,
                accuracy: 3.0,
                speed: 8.0, // Slower speed
                heading: 45.0
            },
            timestamp: new Date().toISOString()
        });

        await delay(7000); // 7 seconds per step for observation
    }

    // ── STEP 4: Arrived ───────────────────────────────────────
    console.log('🔄 Status Update: ARRIVED');
    await updateStatus(ACCIDENT_ID, 'ARRIVED', token);
    await delay(5000);

    // ── STEP 5: Resolved ──────────────────────────────────────
    console.log('✅ Status Update: RESOLVED');
    await updateStatus(ACCIDENT_ID, 'RESOLVED', token);

    console.log('🏁 Simulation Complete. Case is now archived on dashboard.');
}

async function updateStatus(accidentId: string, status: string, token: string) {
    try {
        const response = await fetch(`${DETECTION_SERVICE_URL}/api/sos/${accidentId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                payload: { status }
            })
        });
        if (!response.ok) {
            const err = await response.json();
            console.error(`   ❌ Failed to update status to ${status}:`, err);
        }
    } catch (e: any) {
        console.error(`   ❌ Network error updating status:`, e.message);
    }
}

async function sendLocationUpdate(payload: any) {
    try {
        const response = await fetch(`${TRACKING_SERVICE_URL}/api/track/location`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ payload })
        });
        if (!response.ok) {
            console.error('   ❌ Failed to send location update');
        }
    } catch (e: any) {
        console.error('   ❌ Network error sending location:', e.message);
    }
}

simulateResponder();
