// ============================================================
// Green Corridor Engine
// Core logic:
//   - Maintain a registry of traffic signals (seeded + dynamic)
//   - On ambulance location update: find signals within 500m
//   - Flip those signals GREEN via MQTT
//   - Restore after ambulance passes (stateful timeout)
// ============================================================
import { mqttClient } from './mqttClient';
import type { GeoPoint, TrafficSignalPayload } from '../../../../shared/models/rctf';

// ── Haversine distance (metres) ───────────────────────────────
function haversineMetres(a: GeoPoint, b: GeoPoint): number {
    const R = 6371000; // Earth radius in metres
    const φ1 = (a.lat * Math.PI) / 180;
    const φ2 = (b.lat * Math.PI) / 180;
    const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
    const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
    const x = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// ── Traffic Signal Registry ───────────────────────────────────
export interface SignalRecord {
    signalId: string;
    junctionId: string;
    location: GeoPoint;
    currentState: 'GREEN' | 'RED' | 'YELLOW';
    originalState: 'GREEN' | 'RED' | 'YELLOW';
    corridorActive: boolean;
    accidentId?: string;
    restoreTimer?: ReturnType<typeof setTimeout>;
}

// Seed signals around Pune, India (demo area — expand as needed)
const SIGNAL_REGISTRY = new Map<string, SignalRecord>([
    ['SIG-001', { signalId: 'SIG-001', junctionId: 'JCT-FC-ROAD', location: { lat: 18.5204, lng: 73.8567 }, currentState: 'RED', originalState: 'RED', corridorActive: false }],
    ['SIG-002', { signalId: 'SIG-002', junctionId: 'JCT-KARVE-RD', location: { lat: 18.5074, lng: 73.8077 }, currentState: 'RED', originalState: 'RED', corridorActive: false }],
    ['SIG-003', { signalId: 'SIG-003', junctionId: 'JCT-CAMP', location: { lat: 18.5167, lng: 73.8750 }, currentState: 'GREEN', originalState: 'GREEN', corridorActive: false }],
    ['SIG-004', { signalId: 'SIG-004', junctionId: 'JCT-KOTHRUD', location: { lat: 18.5074, lng: 73.8077 }, currentState: 'RED', originalState: 'RED', corridorActive: false }],
    ['SIG-005', { signalId: 'SIG-005', junctionId: 'JCT-HADAPSAR', location: { lat: 18.5089, lng: 73.9260 }, currentState: 'RED', originalState: 'RED', corridorActive: false }],
    ['SIG-006', { signalId: 'SIG-006', junctionId: 'JCT-VIMAN-NAGAR', location: { lat: 18.5679, lng: 73.9143 }, currentState: 'GREEN', originalState: 'GREEN', corridorActive: false }],
    ['SIG-007', { signalId: 'SIG-007', junctionId: 'JCT-BANER', location: { lat: 18.5590, lng: 73.7868 }, currentState: 'RED', originalState: 'RED', corridorActive: false }],
    ['SIG-008', { signalId: 'SIG-008', junctionId: 'JCT-WAKAD', location: { lat: 18.5975, lng: 73.7898 }, currentState: 'RED', originalState: 'RED', corridorActive: false }],
]);

const CORRIDOR_RADIUS_METRES = 500;
const GREEN_DURATION_SECONDS = 60;

class CorridorEngine {
    // Track which signals are active per accident
    private activeCorridors = new Map<string, Set<string>>();

    processAmbulanceUpdate(data: {
        payload?: { accidentId?: string; location?: GeoPoint; entityId?: string };
        accidentId?: string;
        location?: GeoPoint;
    }): void {
        const accidentId = data.payload?.accidentId ?? data.accidentId;
        const location = data.payload?.location ?? data.location;

        if (!accidentId || !location) return;

        // Find signals within 500m
        const nearbySignals = this.findSignalsWithinRadius(location, CORRIDOR_RADIUS_METRES);

        for (const signal of nearbySignals) {
            this.flipGreen(signal, accidentId);
        }

        // Check if ambulance has passed any previously flipped signals
        this.checkAndRestorePassedSignals(accidentId, location);
    }

    private findSignalsWithinRadius(center: GeoPoint, radiusMetres: number): SignalRecord[] {
        const result: SignalRecord[] = [];
        for (const signal of SIGNAL_REGISTRY.values()) {
            const dist = haversineMetres(center, signal.location);
            if (dist <= radiusMetres) {
                result.push(signal);
            }
        }
        return result;
    }

    private flipGreen(signal: SignalRecord, accidentId: string): void {
        if (signal.corridorActive && signal.accidentId === accidentId) {
            // Already green for this accident — reset timer
            if (signal.restoreTimer) clearTimeout(signal.restoreTimer);
        } else {
            signal.originalState = signal.currentState;
            signal.corridorActive = true;
            signal.accidentId = accidentId;
        }

        signal.currentState = 'GREEN';

        // Track active corridor
        if (!this.activeCorridors.has(accidentId)) {
            this.activeCorridors.set(accidentId, new Set());
        }
        this.activeCorridors.get(accidentId)!.add(signal.signalId);

        // Publish MQTT command
        const payload: TrafficSignalPayload = {
            signalId: signal.signalId,
            junctionId: signal.junctionId,
            location: signal.location,
            state: 'GREEN',
            duration: GREEN_DURATION_SECONDS,
            accidentId,
            corridor: true,
        };

        mqttClient.publish(
            `rescuedge/signal/${signal.signalId}/command`,
            JSON.stringify(payload),
            { qos: 1 }
        );

        // Also publish to dashboard topic
        mqttClient.publish(
            `rescuedge/corridor/${accidentId}/signal`,
            JSON.stringify(payload),
            { qos: 1 }
        );

        console.log(`[corridor-service] Signal ${signal.signalId} (${signal.junctionId}) → GREEN for ${accidentId}`);

        // Schedule restore
        signal.restoreTimer = setTimeout(() => {
            this.restoreSignal(signal, accidentId);
        }, GREEN_DURATION_SECONDS * 1000);
    }

    private restoreSignal(signal: SignalRecord, accidentId: string): void {
        signal.currentState = signal.originalState;
        signal.corridorActive = false;
        signal.accidentId = undefined;
        signal.restoreTimer = undefined;

        const payload: TrafficSignalPayload = {
            signalId: signal.signalId,
            junctionId: signal.junctionId,
            location: signal.location,
            state: signal.originalState,
            duration: 0,
            accidentId,
            corridor: false,
        };

        mqttClient.publish(
            `rescuedge/signal/${signal.signalId}/command`,
            JSON.stringify(payload),
            { qos: 1 }
        );

        mqttClient.publish(
            `rescuedge/corridor/${accidentId}/signal`,
            JSON.stringify(payload),
            { qos: 1 }
        );

        console.log(`[corridor-service] Signal ${signal.signalId} restored to ${signal.originalState}`);
    }

    private checkAndRestorePassedSignals(accidentId: string, currentLocation: GeoPoint): void {
        const activeSignals = this.activeCorridors.get(accidentId);
        if (!activeSignals) return;

        for (const signalId of activeSignals) {
            const signal = SIGNAL_REGISTRY.get(signalId);
            if (!signal || !signal.corridorActive) continue;

            const dist = haversineMetres(currentLocation, signal.location);
            // If ambulance is more than 600m past the signal, restore it
            if (dist > 600) {
                if (signal.restoreTimer) clearTimeout(signal.restoreTimer);
                this.restoreSignal(signal, accidentId);
                activeSignals.delete(signalId);
            }
        }
    }

    getAllSignals(): SignalRecord[] {
        return Array.from(SIGNAL_REGISTRY.values());
    }

    getSignal(signalId: string): SignalRecord | undefined {
        return SIGNAL_REGISTRY.get(signalId);
    }

    addSignal(signal: SignalRecord): void {
        SIGNAL_REGISTRY.set(signal.signalId, signal);
    }

    getActiveCorridors(): Record<string, string[]> {
        const result: Record<string, string[]> = {};
        for (const [accidentId, signals] of this.activeCorridors.entries()) {
            result[accidentId] = Array.from(signals);
        }
        return result;
    }
}

export const corridorEngine = new CorridorEngine();
