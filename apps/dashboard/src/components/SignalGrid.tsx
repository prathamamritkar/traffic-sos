'use client';
import type { TrafficSignalPayload } from '@/types/rctf';
import styles from './SignalGrid.module.css';

interface SignalGridProps {
    signals: TrafficSignalPayload[];
}

export function SignalGrid({ signals }: SignalGridProps) {
    return (
        <div className={styles.grid}>
            <div className={styles.header}>
                <span className="material-icons-round" style={{ fontSize: '16px' }}>traffic</span>
                <span className={styles.title}>Traffic Infrastructure</span>
            </div>

            <div className={styles.list}>
                {signals.map((s) => (
                    <div
                        key={s.signalId}
                        className={`${styles.signal} ${s.corridor ? styles.corridor : ''}`}
                    >
                        <div className={styles.signalTop}>
                            <span className={styles.junctionId} title={s.junctionId}>
                                {s.junctionId.split('(')[0].trim()}
                            </span>
                            <div
                                className={styles.indicator}
                                style={{ background: `var(--indicator-${s.state})` }}
                            />
                        </div>
                        <div className={styles.duration}>
                            {s.corridor ? 'CORRIDOR' : `${s.duration}s`}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
