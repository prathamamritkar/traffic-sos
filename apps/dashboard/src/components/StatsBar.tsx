'use client';
import styles from './StatsBar.module.css';

interface StatsBarProps {
    total: number;
    active: number;
    resolved: number;
    responders: number;
}

export function StatsBar({ total, active, resolved, responders }: StatsBarProps) {
    return (
        <div className={styles.bar}>
            <Stat label="Total" value={total} color="blue" />
            <Stat label="Active" value={active} color="red" pulse />
            <Stat label="Resolved" value={resolved} color="green" />
            <Stat label="Responders" value={responders} color="yellow" />
        </div>
    );
}

function Stat({ label, value, color, pulse }: { label: string; value: number; color: string; pulse?: boolean }) {
    return (
        <div className={styles.stat}>
            <div className={`${styles.dot} ${styles[`dot_${color}`]} ${pulse ? styles.pulse : ''}`} />
            <div>
                <div className={styles.value}>{value}</div>
                <div className={styles.label}>{label}</div>
            </div>
        </div>
    );
}
