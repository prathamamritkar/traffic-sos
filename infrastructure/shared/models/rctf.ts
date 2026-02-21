// ============================================================
// RescuEdge RCTF (RescuEdge Common Transfer Format) JSON Schema
// Enforced at every data boundary: REST, WebSocket, MQTT, Events
// ============================================================

export type Env = 'development' | 'staging' | 'production';
export type Role = 'USER' | 'RESPONDER' | 'ADMIN';
export type CrashType =
    | 'CONFIRMED_CRASH'
    | 'PHONE_DROP'
    | 'POTHOLE'
    | 'HARD_BRAKE'
    | 'UNKNOWN';
export type CaseStatus =
    | 'DETECTED'
    | 'DISPATCHED'
    | 'EN_ROUTE'
    | 'ARRIVED'
    | 'RESOLVED'
    | 'CANCELLED';
export type SignalState = 'GREEN' | 'RED' | 'YELLOW';
export type UrgencyLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

// ── Meta block ────────────────────────────────────────────────
export interface RCTFMeta {
    requestId: string;       // REQ-<UUID>
    timestamp: string;       // ISO-8601
    env: Env;
    version: '1.0';
}

// ── Auth block ────────────────────────────────────────────────
export interface RCTFAuth {
    userId: string;          // U-<ID>
    role: Role;
    token: string;           // JWT
}

// ── Root envelope ─────────────────────────────────────────────
export interface RCTFEnvelope<T = unknown> {
    meta: RCTFMeta;
    auth: RCTFAuth;
    payload: T;
}

// ── Location ──────────────────────────────────────────────────
export interface GeoPoint {
    lat: number;
    lng: number;
    accuracy?: number;       // metres
    altitude?: number;
    heading?: number;        // degrees
    speed?: number;          // m/s
}

// ── Medical Profile ───────────────────────────────────────────
export interface MedicalProfile {
    bloodGroup: string;
    age: number;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
    allergies: string[];
    medications: string[];
    conditions: string[];
    emergencyContacts: string[];
}

// ── Crash Metrics ─────────────────────────────────────────────
export interface CrashMetrics {
    gForce: number;
    speedBefore: number;     // km/h
    speedAfter: number;      // km/h
    mlConfidence: number;    // 0–1
    crashType: CrashType;
    rolloverDetected: boolean;
    impactDirection?: 'FRONT' | 'REAR' | 'LEFT' | 'RIGHT' | 'ROLLOVER';
}

// ── SOS Payload ───────────────────────────────────────────────
export interface SOSPayload {
    accidentId: string;      // ACC-2026-XXXXXX
    location: GeoPoint;
    metrics: CrashMetrics;
    medicalProfile: MedicalProfile;
    victimUserId: string;
    status: CaseStatus;
    createdAt: string;
}

// ── Responder Payload ─────────────────────────────────────────
export interface ResponderPayload {
    responderId: string;
    accidentId: string;
    location: GeoPoint;
    status: 'ACCEPTED' | 'REJECTED' | 'EN_ROUTE' | 'ARRIVED' | 'RESOLVED';
    eta?: number;            // seconds
    vehicleId?: string;
}

// ── Location Update ───────────────────────────────────────────
export interface LocationUpdatePayload {
    entityId: string;        // userId or vehicleId
    entityType: 'VICTIM' | 'RESPONDER' | 'AMBULANCE';
    accidentId: string;
    location: GeoPoint;
    timestamp: string;
}

// ── Traffic Signal ────────────────────────────────────────────
export interface TrafficSignalPayload {
    signalId: string;
    junctionId: string;
    location: GeoPoint;
    state: SignalState;
    duration: number;        // seconds
    accidentId: string;
    corridor: boolean;
}

// ── Scene Analysis (Bystander Vision AI) ──────────────────────────
export interface SceneAnalysis {
    injurySeverity: 'CRITICAL' | 'MODERATE' | 'MINOR' | 'UNKNOWN';
    victimCount: number;
    visibleHazards: string[];
    urgencyLevel: 'IMMEDIATE' | 'HIGH' | 'NORMAL';
    suggestedActions: string[];
}

// ── Device Info ───────────────────────────────────────────────
export interface DeviceInfo {
    batteryLevel: number;
    batteryStatus: string;
    networkType?: string;
}

// ── Case History ──────────────────────────────────────────────
export interface CaseRecord {
    accidentId: string;
    victimUserId: string;
    responderId?: string;
    location: GeoPoint;
    status: CaseStatus;
    metrics: CrashMetrics;
    medicalProfile: MedicalProfile;
    deviceInfo?: DeviceInfo;
    sceneAnalysis?: SceneAnalysis;
    createdAt: string;
    resolvedAt?: string;
    notes?: string;
}

// ── Helper: simple UUID v4 (no crypto dependency) ────────────
function _uuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// ── Helper: build RCTF envelope ───────────────────────────────
export function buildEnvelope<T>(
    payload: T,
    auth: RCTFAuth,
    env: Env = 'development'
): RCTFEnvelope<T> {
    return {
        meta: {
            requestId: `REQ-${_uuid()}`,
            timestamp: new Date().toISOString(),
            env,
            version: '1.0',
        },
        auth,
        payload,
    };
}

// ── Helper: generate AccidentID ───────────────────────────────
export function generateAccidentId(): string {
    const year = new Date().getFullYear();
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ACC-${year}-${rand}`;
}

// ── Helper: generate RequestID ────────────────────────────────
export function generateRequestId(): string {
    return `REQ-${_uuid()}`;
}
