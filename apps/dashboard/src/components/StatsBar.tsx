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
            <div className={styles.stat}>
                <span className="material-icons-round" style={{ fontSize: 18, color: 'var(--text-muted)' }}>analytics</span>
                <span className={`${styles.value} ${styles.total}`}>{total}</span>
                <span className={styles.label}>Total</span>
            </div>
            <div className={styles.stat}>
                <span className="material-icons-round" style={{ fontSize: 18, color: 'var(--indicator-RED)' }}>car_crash</span>
                <span className={`${styles.value} ${styles.active}`}>{active}</span>
                <span className={styles.label}>Active</span>
            </div>
            <div className={styles.stat}>
                <span className="material-icons-round" style={{ fontSize: 18, color: 'var(--indicator-GREEN)' }}>task_alt</span>
                <span className={`${styles.value} ${styles.resolved}`}>{resolved}</span>
                <span className={styles.label}>Resolved</span>
            </div>
            <div className={styles.stat}>
                <span className="material-icons-round" style={{ fontSize: 18, color: 'var(--indicator-BLUE)' }}>emergency</span>
                <span className={`${styles.value} ${styles.responders}`}>{responders}</span>
                <span className={styles.label}>Responders</span>
            </div>
        </div>
    );
}
