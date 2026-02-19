// ============================================================
// Responder Registry — tracks available responders and FCM tokens
// In production: replace with database query
// ============================================================

export interface ResponderRecord {
    responderId: string;
    userId: string;
    name: string;
    fcmToken: string;
    location: { lat: number; lng: number };
    available: boolean;
    vehicleId?: string;
    hospitalId?: string;
}

// In-memory registry (seeded with demo responders)
const responderRegistry = new Map<string, ResponderRecord>([
    ['RSP-001', {
        responderId: 'RSP-001',
        userId: 'U-RESP-001',
        name: 'Dr. Arjun Sharma',
        fcmToken: '',  // Set via /api/notify/register-responder
        location: { lat: 18.5204, lng: 73.8567 },
        available: true,
        vehicleId: 'AMB-MH12-001',
        hospitalId: 'HOSP-RUBY',
    }],
    ['RSP-002', {
        responderId: 'RSP-002',
        userId: 'U-RESP-002',
        name: 'Paramedic Priya Nair',
        fcmToken: '',
        location: { lat: 18.5074, lng: 73.8077 },
        available: true,
        vehicleId: 'AMB-MH12-002',
        hospitalId: 'HOSP-KEM',
    }],
]);

// Haversine distance
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const R = 6371;
    const φ1 = (a.lat * Math.PI) / 180;
    const φ2 = (b.lat * Math.PI) / 180;
    const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
    const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
    const x = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function findNearestResponders(
    location: { lat: number; lng: number },
    limit = 3
): ResponderRecord[] {
    return Array.from(responderRegistry.values())
        .filter((r) => r.available && r.fcmToken)
        .sort((a, b) => haversineKm(location, a.location) - haversineKm(location, b.location))
        .slice(0, limit);
}

export function registerResponder(record: ResponderRecord): void {
    responderRegistry.set(record.responderId, record);
}

export function updateResponderLocation(
    responderId: string,
    location: { lat: number; lng: number }
): void {
    const record = responderRegistry.get(responderId);
    if (record) {
        record.location = location;
        responderRegistry.set(responderId, record);
    }
}

export function setResponderAvailability(responderId: string, available: boolean): void {
    const record = responderRegistry.get(responderId);
    if (record) {
        record.available = available;
        responderRegistry.set(responderId, record);
    }
}

export function getAllResponders(): ResponderRecord[] {
    return Array.from(responderRegistry.values());
}
