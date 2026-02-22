// Shared TypeScript types for dashboard (mirrors shared/models/rctf.ts)
export type CaseStatus = 'DETECTED' | 'DISPATCHED' | 'EN_ROUTE' | 'ARRIVED' | 'RESOLVED' | 'CANCELLED';
export type SignalState = 'GREEN' | 'RED' | 'YELLOW';

export interface GeoPoint {
    lat: number;
    lng: number;
    accuracy?: number;
    heading?: number;
    speed?: number;
}

export interface MedicalProfile {
    bloodGroup: string;
    age: number;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
    allergies: string[];
    medications: string[];
    conditions: string[];
    emergencyContacts: string[];
}

export interface CrashMetrics {
    gForce: number;
    speedBefore: number;
    speedAfter: number;
    mlConfidence: number;
    crashType: string;
    rolloverDetected: boolean;
}

export interface SceneAnalysis {
    injurySeverity: 'CRITICAL' | 'MODERATE' | 'MINOR' | 'UNKNOWN';
    victimCount: number;
    visibleHazards: string[];
    urgencyLevel: 'IMMEDIATE' | 'HIGH' | 'NORMAL';
    suggestedActions: string[];
}


export interface DeviceInfo {
    batteryLevel: number;
    batteryStatus: string;
    networkType?: string;
}

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
}

export interface TrafficSignalPayload {
    signalId: string;
    junctionId: string;
    location: GeoPoint;
    state: SignalState;
    duration: number;
    accidentId?: string;
    corridor: boolean;
    /** Ordering index for corridor path sequencing (0 = start of corridor) */
    corridorOrder?: number;
}

export interface AmbulanceLocation {
    entityId: string;
    accidentId: string;
    location: GeoPoint;
    timestamp: string;
}
