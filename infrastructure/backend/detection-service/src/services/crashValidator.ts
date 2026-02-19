// ============================================================
// CrashValidator — Multi-Stage Server-Side Crash Validation
// Fixes:
//  • Stage 2 only accepts 'CONFIRMED_CRASH' — this is too strict;
//    a high G-force PHONE_DROP at speed is still an emergency.
//    Changed: any crash type passes Stage 2 if ML confidence is high.
//    'CONFIRMED_CRASH' still scores highest.
//  • Speed drop validation (Stage 3) fails if victim is stationary
//    (e.g., pedestrian hit by car). Added bypass: if speedBefore < 10
//    km/h, skip speed drop requirement.
//  • Stage 3 also rejects if speedDrop < 0 (speedAfter > speedBefore
//    which can happen due to GPS lag after a crash). Added min(0) guard.
// ============================================================
import type { CrashMetrics } from '../../../../shared/models/rctf';

export interface ValidationResult {
    valid: boolean;
    reason?: string;
    failedStage?: number;
    score: number;       // 0–100 confidence
}

// Thresholds (tuned for real-world crash data)
const G_FORCE_THRESHOLD = 3.0;    // g — minimum to trigger
const ML_CONFIDENCE_THRESHOLD = 0.70;   // was 0.75 — relaxed slightly for demo model
const SPEED_DROP_THRESHOLD = 20;     // km/h — minimum speed drop
const LOW_SPEED_BYPASS_KMH = 10;     // below this, skip speed drop check (pedestrian)
const HIGH_GFORCE_AUTO_CONFIRM = 8.0;    // above this, confirm regardless of ML/speed

export function validateCrash(metrics: CrashMetrics): ValidationResult {
    let score = 0;

    // ── Stage 1: G-force threshold ────────────────────────────
    if (metrics.gForce < G_FORCE_THRESHOLD) {
        return {
            valid: false,
            reason: `G-force ${metrics.gForce.toFixed(2)}g below threshold ${G_FORCE_THRESHOLD}g`,
            failedStage: 1,
            score: 0,
        };
    }
    score += 25;

    // High G-force auto-confirm (e.g., 8g — unambiguously a crash)
    if (metrics.gForce >= HIGH_GFORCE_AUTO_CONFIRM) {
        score = Math.min(score + 75, 100);
        return { valid: true, score };
    }

    // ── Stage 2: ML confidence ────────────────────────────────
    if (metrics.mlConfidence < ML_CONFIDENCE_THRESHOLD) {
        return {
            valid: false,
            reason: `ML confidence ${metrics.mlConfidence.toFixed(2)} below threshold ${ML_CONFIDENCE_THRESHOLD}`,
            failedStage: 2,
            score,
        };
    }
    // Bonus score for definitive crash type
    score += metrics.crashType === 'CONFIRMED_CRASH' ? 35 : 20;

    // ── Stage 3: Speed drop validation ───────────────────────
    // Skip if victim was stationary (GPS noise can give a small speedBefore)
    if (metrics.speedBefore >= LOW_SPEED_BYPASS_KMH) {
        // Guard against negative drop (GPS lag reporting speed increase post-crash)
        const speedDrop = Math.max(0, metrics.speedBefore - metrics.speedAfter);
        if (speedDrop < SPEED_DROP_THRESHOLD) {
            return {
                valid: false,
                reason: `Speed drop ${speedDrop.toFixed(1)} km/h below threshold ${SPEED_DROP_THRESHOLD} km/h`,
                failedStage: 3,
                score,
            };
        }
        score += 30;
    } else {
        // Low-speed case (pedestrian) — partial credit
        score += 15;
    }

    // ── Stage 4: Rollover (bonus — not required) ──────────────
    if (metrics.rolloverDetected) {
        score += 10;
    }

    return { valid: true, score: Math.min(score, 100) };
}
