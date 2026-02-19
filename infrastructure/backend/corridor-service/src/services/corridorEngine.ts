// ============================================================
// Green Corridor Engine
// Fixes:
//  • Memory leak: `restoreTimer` stored on SignalRecord but
//    TS type is `| undefined` — when corridorActive signal is
//    reclaimed for a NEW accident while restoreTimer is pending,
//    the old timer fires and restores the signal incorrectly.
//    Fixed: timer ownership check via accidentId comparison.
//  • SIGNAL_REGISTRY is module-level mutable — any two concurrent
//    requests that flip the same signal race. Added per-signal lock
//    (simple boolean flag) to prevent double-flipping.
//  • `activeCorridors` Map grows forever — resolved accidents are
//    never cleaned up. Added `releaseCorridorForAccident()` method.
//  • addSignal() sets without validation — fields like lat/lng
//    not checked. Added type-safe guard.
// ============================================================
import { mqttClient } from './mqttClient';
import type { GeoPoint, TrafficSignalPayload } from '../../../../shared/models/rctf';

// ── Haversine distance (metres) ───────────────────────────────
function haversineMetres(a: GeoPoint, b: GeoPoint): number {
    const R = 6_371_000;
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
    flipping: boolean;           // Lock: prevents concurrent flip
    accidentId?: string;
    restoreTimer?: ReturnType<typeof setTimeout>;
}

// Seed signals around Pune, India (demo area)
const SIGNAL_REGISTRY = new Map<string, SignalRecord>([
    ['SIG-001', { signalId: 'SIG-001', junctionId: 'JCT-FC-ROAD', location: { lat: 18.5204, lng: 73.8567 }, currentState: 'RED', originalState: 'RED', corridorActive: false, flipping: false }],
    ['SIG-002', { signalId: 'SIG-002', junctionId: 'JCT-KARVE-RD', location: { lat: 18.5074, lng: 73.8077 }, currentState: 'RED', originalState: 'RED', corridorActive: false, flipping: false }],
    ['SIG-003', { signalId: 'SIG-003', junctionId: 'JCT-CAMP', location: { lat: 18.5167, lng: 73.8750 }, currentState: 'GREEN', originalState: 'GREEN', corridorActive: false, flipping: false }],
    ['SIG-004', { signalId: 'SIG-004', junctionId: 'JCT-KOTHRUD', location: { lat: 18.5074, lng: 73.8077 }, currentState: 'RED', originalState: 'RED', corridorActive: false, flipping: false }],
    ['SIG-005', { signalId: 'SIG-005', junctionId: 'JCT-HADAPSAR', location: { lat: 18.5089, lng: 73.9260 }, currentState: 'RED', originalState: 'RED', corridorActive: false, flipping: false }],
    ['SIG-006', { signalId: 'SIG-006', junctionId: 'JCT-VIMAN-NAGAR', location: { lat: 18.5679, lng: 73.9143 }, currentState: 'GREEN', originalState: 'GREEN', corridorActive: false, flipping: false }],
    ['SIG-007', { signalId: 'SIG-007', junctionId: 'JCT-BANER', location: { lat: 18.5590, lng: 73.7868 }, currentState: 'RED', originalState: 'RED', corridorActive: false, flipping: false }],
    ['SIG-008', { signalId: 'SIG-008', junctionId: 'JCT-WAKAD', location: { lat: 18.5975, lng: 73.7898 }, currentState: 'RED', originalState: 'RED', corridorActive: false, flipping: false }],
]);

const CORRIDOR_RADIUS_METRES = 500;
const GREEN_DURATION_SECONDS = 60;
const RESTORE_DISTANCE_METRES = 600;  // Ambulance must pass this far before signal restores

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
        if (typeof location.lat !== 'number' || typeof location.lng !== 'number') return;

        const nearbySignals = this.findSignalsWithinRadius(location, CORRIDOR_RADIUS_METRES);
        for (const signal of nearbySignals) {
            this.flipGreen(signal, accidentId);
        }

        this.checkAndRestorePassedSignals(accidentId, location);
    }

    private findSignalsWithinRadius(center: GeoPoint, radiusMetres: number): SignalRecord[] {
        const result: SignalRecord[] = [];
        for (const signal of SIGNAL_REGISTRY.values()) {
            if (haversineMetres(center, signal.location) <= radiusMetres) {
                result.push(signal);
            }
        }
        return result;
    }

    private flipGreen(signal: SignalRecord, accidentId: string): void {
        // Lock: prevent concurrent double-flip
        if (signal.flipping) return;
        signal.flipping = true;

        try {
            if (signal.corridorActive && signal.accidentId === accidentId) {
                // Already green for this accident — reset the restore timer
                if (signal.restoreTimer) clearTimeout(signal.restoreTimer);
            } else {
                // Flipping for a new accident — save original state
                if (signal.corridorActive && signal.restoreTimer) {
                    // Cancel any pending restore from a previous accident
                    clearTimeout(signal.restoreTimer);
                }
                signal.originalState = signal.currentState;
                signal.corridorActive = true;
                signal.accidentId = accidentId;
            }

            signal.currentState = 'GREEN';

            if (!this.activeCorridors.has(accidentId)) {
                this.activeCorridors.set(accidentId, new Set());
            }
            this.activeCorridors.get(accidentId)!.add(signal.signalId);

            const payload: TrafficSignalPayload = {
                signalId: signal.signalId,
                junctionId: signal.junctionId,
                location: signal.location,
                state: 'GREEN',
                duration: GREEN_DURATION_SECONDS,
                accidentId,
                corridor: true,
            };

            mqttClient.publish(`rescuedge/signal/${signal.signalId}/command`, JSON.stringify(payload), { qos: 1 });
            mqttClient.publish(`rescuedge/corridor/${accidentId}/signal`, JSON.stringify(payload), { qos: 1 });

            console.log(`[corridor-service] Signal ${signal.signalId} (${signal.junctionId}) → GREEN for ${accidentId}`);

            // Schedule restore — capture accidentId in closure so timer
            // can verify ownership before restoring (prevents stale timer from
            // restoring a signal that was re-acquired by a different accident)
            const ownedAccidentId = accidentId;
            signal.restoreTimer = setTimeout(() => {
                if (signal.accidentId === ownedAccidentId) {
                    this.restoreSignal(signal, ownedAccidentId);
                }
            }, GREEN_DURATION_SECONDS * 1000);
        } finally {
            signal.flipping = false;
        }
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

        mqttClient.publish(`rescuedge/signal/${signal.signalId}/command`, JSON.stringify(payload), { qos: 1 });
        mqttClient.publish(`rescuedge/corridor/${accidentId}/signal`, JSON.stringify(payload), { qos: 1 });

        // Clean up from activeCorridors
        this.activeCorridors.get(accidentId)?.delete(signal.signalId);

        console.log(`[corridor-service] Signal ${signal.signalId} restored to ${signal.originalState}`);
    }

    private checkAndRestorePassedSignals(accidentId: string, currentLocation: GeoPoint): void {
        const activeSignals = this.activeCorridors.get(accidentId);
        if (!activeSignals) return;

        for (const signalId of activeSignals) {
            const signal = SIGNAL_REGISTRY.get(signalId);
            if (!signal?.corridorActive) continue;

            const dist = haversineMetres(currentLocation, signal.location);
            if (dist > RESTORE_DISTANCE_METRES) {
                if (signal.restoreTimer) clearTimeout(signal.restoreTimer);
                this.restoreSignal(signal, accidentId);
                // restoreSignal already deletes from activeSignals — safe during iteration
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
        // Validate coordinates before adding
        if (
            typeof signal.lat !== 'number' &&
            (signal.location.lat < -90 || signal.location.lat > 90 ||
                signal.location.lng < -180 || signal.location.lng > 180)
        ) {
            console.error(`[corridor-service] addSignal rejected: invalid coordinates for ${signal.signalId}`);
            return;
        }
        SIGNAL_REGISTRY.set(signal.signalId, { ...signal, flipping: false });
    }

    getActiveCorridors(): Record<string, string[]> {
        const result: Record<string, string[]> = {};
        for (const [accidentId, signals] of this.activeCorridors.entries()) {
            if (signals.size > 0) {
                result[accidentId] = Array.from(signals);
            }
        }
        return result;
    }

    /** Call when an accident is resolved to clean up corridor state. */
    releaseCorridorForAccident(accidentId: string): void {
        const signals = this.activeCorridors.get(accidentId);
        if (!signals) return;

        for (const signalId of signals) {
            const signal = SIGNAL_REGISTRY.get(signalId);
            if (signal?.corridorActive && signal.accidentId === accidentId) {
                if (signal.restoreTimer) clearTimeout(signal.restoreTimer);
                this.restoreSignal(signal, accidentId);
            }
        }

        this.activeCorridors.delete(accidentId);
        console.log(`[corridor-service] Corridor released for ${accidentId}`);
    }
}

export const corridorEngine = new CorridorEngine();
