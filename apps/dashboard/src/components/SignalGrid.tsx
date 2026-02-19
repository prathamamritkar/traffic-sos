'use client';
import type { TrafficSignalPayload } from '@/types/rctf';
import styles from './SignalGrid.module.css';

interface SignalGridProps {
    signals: TrafficSignalPayload[];
}

const STATE_COLOR: Record<string, string> = {
    GREEN: '#22c55e',
    RED: '#ef4444',
    YELLOW: '#eab308',
};

export function SignalGrid({ signals }: SignalGridProps) {
    const corridorSignals = signals.filter((s) => s.corridor);
    const normalSignals = signals.filter((s) => !s.corridor);

    return (
        <div className={styles.grid}>
            <div className={styles.header}>
                <span className={styles.title}>Traffic Signals</span>
                {corridorSignals.length > 0 && (
                    <span className={`badge badge-green`}>🟢 {corridorSignals.length} Corridor</span>
                )}
            </div>

            {corridorSignals.length > 0 && (
                <div className={styles.section}>
                    <div className={styles.sectionLabel}>🚑 Green Corridor Active</div>
                    {corridorSignals.map((s) => (
                        <SignalRow key={s.signalId} signal={s} />
                    ))}
                </div>
            )}

            <div className={styles.section}>
                <div className={styles.sectionLabel}>All Signals</div>
                {signals.slice(0, 8).map((s) => (
                    <SignalRow key={s.signalId} signal={s} />
                ))}
            </div>
        </div>
    );
}

function SignalRow({ signal }: { signal: TrafficSignalPayload }) {
    const color = STATE_COLOR[signal.state] ?? '#94a3b8';

    return (
        <div className={`${styles.row} ${signal.corridor ? styles.corridorRow : ''}`}>
            <div className={styles.light} style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
            <div className={styles.info}>
                <div className={styles.junctionId}>{signal.junctionId}</div>
                <div className={styles.signalId}>{signal.signalId}</div>
            </div>
            <div className={styles.state} style={{ color }}>
                {signal.state}
                {signal.corridor && signal.duration > 0 && (
                    <span className={styles.duration}> {signal.duration}s</span>
                )}
            </div>
        </div>
    );
}
