'use client';
import { formatDistanceToNow, isValid } from 'date-fns';
import type { CaseRecord } from '@/types/rctf';
import styles from './SOSFeed.module.css';

interface SOSFeedProps {
    cases: CaseRecord[];
    selectedId?: string;
    onSelect: (c: CaseRecord) => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
    DETECTED: { label: 'Detected', color: 'red', emoji: '🚨' },
    DISPATCHED: { label: 'Dispatched', color: 'yellow', emoji: '📡' },
    EN_ROUTE: { label: 'En Route', color: 'blue', emoji: '🚑' },
    ARRIVED: { label: 'Arrived', color: 'green', emoji: '✅' },
    RESOLVED: { label: 'Resolved', color: 'green', emoji: '✔️' },
    CANCELLED: { label: 'Cancelled', color: 'yellow', emoji: '❌' },
};

// Fallback config for unknown status values (forward-compat)
const FALLBACK_STATUS = { label: 'Unknown', color: 'yellow', emoji: '❓' };

/** Safe date-distance formatter — never throws on malformed timestamps */
function safeTimeAgo(dateStr: string): string {
    try {
        const d = new Date(dateStr);
        return isValid(d) ? formatDistanceToNow(d, { addSuffix: true }) : 'unknown time';
    } catch {
        return 'unknown time';
    }
}

export function SOSFeed({ cases, selectedId, onSelect }: SOSFeedProps) {
    const sorted = [...cases].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const activeCount = cases.filter(
        (c) => c.status !== 'RESOLVED' && c.status !== 'CANCELLED'
    ).length;

    return (
        <div className={styles.feed}>
            <div className={styles.header}>
                <span className={styles.headerTitle}>SOS Feed</span>
                <span className="badge badge-red">{activeCount} Active</span>
            </div>

            <div className={styles.list}>
                {sorted.length === 0 ? (
                    <div className={styles.empty}>
                        <span>🟢</span>
                        <p>No active incidents</p>
                    </div>
                ) : (
                    sorted.map((c) => (
                        <CaseCard
                            key={c.accidentId}
                            caseRecord={c}
                            selected={c.accidentId === selectedId}
                            onClick={() => onSelect(c)}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

function CaseCard({
    caseRecord,
    selected,
    onClick,
}: {
    caseRecord: CaseRecord;
    selected: boolean;
    onClick: () => void;
}) {
    const cfg = STATUS_CONFIG[caseRecord.status] ?? FALLBACK_STATUS;
    const timeAgo = safeTimeAgo(caseRecord.createdAt);

    return (
        <button
            id={`case-${caseRecord.accidentId}`}
            className={`${styles.card} ${selected ? styles.selected : ''}`}
            onClick={onClick}
            aria-pressed={selected}
            aria-label={`Case ${caseRecord.accidentId}, status ${cfg.label}, ${timeAgo}`}
        >
            <div className={styles.cardTop}>
                <div className={styles.cardLeft}>
                    <span className={styles.emoji} aria-hidden="true">{cfg.emoji}</span>
                    <div>
                        <div className={styles.accidentId}>{caseRecord.accidentId}</div>
                        <div className={styles.location}>
                            {caseRecord.location.lat.toFixed(4)},{' '}
                            {caseRecord.location.lng.toFixed(4)}
                        </div>
                    </div>
                </div>
                <span className={`badge badge-${cfg.color}`}>{cfg.label}</span>
            </div>

            <div className={styles.cardBottom}>
                <div className={styles.metrics}>
                    <span className={styles.metric}>
                        <span className={styles.metricLabel}>G</span>
                        {caseRecord.metrics.gForce.toFixed(1)}g
                    </span>
                    <span className={styles.metric}>
                        <span className={styles.metricLabel}>ML</span>
                        {(caseRecord.metrics.mlConfidence * 100).toFixed(0)}%
                    </span>
                    <span className={styles.metric}>
                        <span className={styles.metricLabel}>BG</span>
                        {caseRecord.medicalProfile.bloodGroup}
                    </span>
                </div>
                <span className={styles.time}>{timeAgo}</span>
            </div>

            {caseRecord.responderId && (
                <div className={styles.responderInfo}>
                    <span>🚑 {caseRecord.responderId} assigned</span>
                </div>
            )}
        </button>
    );
}
