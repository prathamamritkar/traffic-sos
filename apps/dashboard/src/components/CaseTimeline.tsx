'use client';
import type { CaseRecord, CaseStatus } from '@/types/rctf';
import styles from './CaseTimeline.module.css';
import { format, isValid } from 'date-fns';

interface CaseTimelineProps {
    caseRecord: CaseRecord;
}

const STEPS: { status: CaseStatus; label: string }[] = [
    { status: 'DETECTED', label: 'Accident Detected' },
    { status: 'DISPATCHED', label: 'Ambulance Dispatched' },
    { status: 'EN_ROUTE', label: 'En Route to Scene' },
    { status: 'ARRIVED', label: 'Arrived at Scene' },
    { status: 'RESOLVED', label: 'Case Resolved' },
];

function safeFormat(dateStr: string): string {
    try {
        const d = new Date(dateStr);
        return isValid(d) ? format(d, 'HH:mm:ss') : '—';
    } catch {
        return '—';
    }
}

export function CaseTimeline({ caseRecord }: CaseTimelineProps) {
    const currentStatus = caseRecord.status;
    const isCancelled = currentStatus === 'CANCELLED';
    const isResolved = currentStatus === 'RESOLVED';

    // CANCELLED is not in the STEPS array — treat it as "stuck at DETECTED"
    const effectiveStatus: CaseStatus = isCancelled ? 'DETECTED' : currentStatus;
    const currentIndex = STEPS.findIndex((s) => s.status === effectiveStatus);
    // findIndex returns -1 only if effectiveStatus doesn't match any STEP,
    // which can't happen now (CANCELLED is remapped to DETECTED above).
    const safeIndex = currentIndex === -1 ? 0 : currentIndex;

    return (
        <div className={styles.timeline}>
            <div className={styles.timelineList}>
                {STEPS.map((step, index) => {
                    const isCompleted = isResolved || index < safeIndex;
                    const isActive = !isResolved && !isCancelled && index === safeIndex;
                    // isPending: future steps when not resolved yet
                    // For cancelled cases everything after DETECTED is pending (greyed out)
                    const isPending = !isCompleted && !isActive;

                    let stepClass = styles.step;
                    if (isCompleted) stepClass += ` ${styles.stepCompleted}`;
                    if (isActive) stepClass += ` ${styles.stepActive}`;
                    if (isPending) stepClass += ` ${styles.stepPending}`;
                    if (isCancelled) stepClass += ` ${styles.stepCancelled ?? ''}`;

                    return (
                        <div key={step.status} className={stepClass}>
                            <div className={styles.stepLine} />
                            <div className={styles.stepIcon}>
                                <span className="material-icons-round" style={{ fontSize: '12px' }}>
                                    {isCompleted ? 'task_alt' : isActive ? 'radio_button_checked' : 'radio_button_unchecked'}
                                </span>
                            </div>
                            <div className={styles.stepContent}>
                                <div className={styles.stepLabel}>{step.label}</div>

                                {isActive && (
                                    <div className={styles.stepTime}>In Progress…</div>
                                )}

                                {/* Show detection time on the first completed step */}
                                {isCompleted && index === 0 && (
                                    <div className={styles.stepTime}>
                                        {safeFormat(caseRecord.createdAt)}
                                    </div>
                                )}

                                {/* Show resolution time on the RESOLVED step */}
                                {isCompleted && step.status === 'RESOLVED' && caseRecord.resolvedAt && (
                                    <div className={styles.stepTime}>
                                        {safeFormat(caseRecord.resolvedAt)}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
