'use client';
import type { CaseRecord, CaseStatus } from '@/types/rctf';
import styles from './CaseTimeline.module.css';
import { format } from 'date-fns';

interface CaseTimelineProps {
    caseRecord: CaseRecord;
}

const STEPS: { status: CaseStatus; label: string; icon?: string }[] = [
    { status: 'DETECTED', label: 'Accident Detected' },
    { status: 'DISPATCHED', label: 'Ambulance Dispatched' },
    { status: 'EN_ROUTE', label: 'En Route to Scene' },
    { status: 'ARRIVED', label: 'Arrived at Scene' },
    { status: 'RESOLVED', label: 'Case Resolved' },
];

export function CaseTimeline({ caseRecord }: CaseTimelineProps) {
    const currentStatus = caseRecord.status;
    const currentIndex = STEPS.findIndex(s => s.status === currentStatus);

    return (
        <div className={styles.timeline}>
            <div className={styles.timelineTitle}>
                <span>⏳</span> Incident Timeline
            </div>
            <div className={styles.timelineList}>
                {STEPS.map((step, index) => {
                    const isCompleted = index < currentIndex || currentStatus === 'RESOLVED';
                    const isActive = index === currentIndex && currentStatus !== 'RESOLVED';
                    const isPending = index > currentIndex && currentStatus !== 'RESOLVED';

                    let stepClass = styles.step;
                    if (isCompleted) stepClass += ` ${styles.stepCompleted}`;
                    if (isActive) stepClass += ` ${styles.stepActive}`;
                    if (isPending) stepClass += ` ${styles.stepPending}`;

                    return (
                        <div key={step.status} className={stepClass}>
                            <div className={styles.stepLine} />
                            <div className={styles.stepIcon} />
                            <div className={styles.stepContent}>
                                <div className={styles.stepLabel}>{step.label}</div>
                                {isActive && (
                                    <div className={styles.stepTime}>In Progress...</div>
                                )}
                                {isCompleted && index === 0 && (
                                    <div className={styles.stepTime}>
                                        {format(new Date(caseRecord.createdAt), 'HH:mm:ss')}
                                    </div>
                                )}
                                {isCompleted && step.status === 'RESOLVED' && caseRecord.resolvedAt && (
                                    <div className={styles.stepTime}>
                                        {format(new Date(caseRecord.resolvedAt), 'HH:mm:ss')}
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
