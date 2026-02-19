// ============================================================
// Multi-Stage Crash Validator
// Stage 1: G-force threshold
// Stage 2: ML confidence + crash type
// Stage 3: Speed drop validation
// Stage 4: Rollover check (bonus signal)
// ============================================================
import type { CrashMetrics } from '../../../../shared/models/rctf';

export interface ValidationResult {
    valid: boolean;
    reason?: string;
    failedStage?: number;
    score: number;  // 0–100 confidence score
}

// Thresholds (tuned for real-world crash data)
const G_FORCE_THRESHOLD = 3.0;   // g — minimum to trigger stage 1
const ML_CONFIDENCE_THRESHOLD = 0.75;  // minimum ML confidence
const SPEED_DROP_THRESHOLD = 20;    // km/h — minimum speed drop
const VALID_CRASH_TYPES = ['CONFIRMED_CRASH'];

export function validateCrash(metrics: CrashMetrics): ValidationResult {
    let score = 0;

    // ── Stage 1: G-force threshold ────────────────────────────
    if (metrics.gForce < G_FORCE_THRESHOLD) {
        return {
            valid: false,
            reason: `G-force ${metrics.gForce}g below threshold ${G_FORCE_THRESHOLD}g`,
            failedStage: 1,
            score: 0,
        };
    }
    score += 25;

    // ── Stage 2: ML classifier ────────────────────────────────
    if (metrics.mlConfidence < ML_CONFIDENCE_THRESHOLD) {
        return {
            valid: false,
            reason: `ML confidence ${metrics.mlConfidence} below threshold ${ML_CONFIDENCE_THRESHOLD}`,
            failedStage: 2,
            score,
        };
    }
    if (!VALID_CRASH_TYPES.includes(metrics.crashType)) {
        return {
            valid: false,
            reason: `Crash type '${metrics.crashType}' is not a confirmed crash`,
            failedStage: 2,
            score,
        };
    }
    score += 35;

    // ── Stage 3: Speed drop validation ───────────────────────
    const speedDrop = metrics.speedBefore - metrics.speedAfter;
    if (speedDrop < SPEED_DROP_THRESHOLD) {
        return {
            valid: false,
            reason: `Speed drop ${speedDrop} km/h below threshold ${SPEED_DROP_THRESHOLD} km/h`,
            failedStage: 3,
            score,
        };
    }
    score += 30;

    // ── Stage 4: Rollover (bonus — not required) ──────────────
    if (metrics.rolloverDetected) {
        score += 10;
    }

    return { valid: true, score: Math.min(score, 100) };
}
