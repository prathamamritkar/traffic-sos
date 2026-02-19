'use client';
import { useRouter } from 'next/navigation';
import styles from './Navbar.module.css';

interface NavbarProps {
    user: { name: string; role: string; email: string };
    connected: boolean;
    activeIncidents?: number;
}

export function Navbar({ user, connected, activeIncidents = 0 }: NavbarProps) {
    const router = useRouter();

    const logout = () => {
        try {
            localStorage.removeItem('rescuedge_token');
            localStorage.removeItem('rescuedge_user');
        } catch {
            // localStorage may be unavailable in some browser contexts
        }
        router.push('/');
    };

    // Safe initials — filter out empty segments (double-spaces, leading/trailing)
    // and guard against undefined n[0] when a segment is an empty string
    const initials = user.name
        .split(' ')
        .map((n) => n.trim())
        .filter((n) => n.length > 0)
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase() || '??';

    return (
        <header className={styles.header} role="banner">
            <nav className={styles.nav} aria-label="Main navigation">
                {/* ── Left ─────────────────────────────────── */}
                <div className={styles.left}>
                    <div className={styles.logo} aria-label="RescuEdge home">
                        <div className={styles.logoMark} aria-hidden="true">
                            <span
                                className="material-icons-round"
                                style={{ fontSize: 18, color: 'var(--md-sys-color-primary)' }}
                            >
                                local_hospital
                            </span>
                        </div>
                        <span className={styles.logoText}>RescuEdge</span>
                        <span className="badge badge-red" aria-label="ADGC system">ADGC</span>
                    </div>

                    <div className={styles.separator} aria-hidden="true" />

                    {/* Live status */}
                    <div
                        className={styles.liveStatus}
                        aria-label={connected ? 'System live' : 'System offline'}
                        title={connected ? 'Connected to all services' : 'Connection lost — reconnecting…'}
                    >
                        <span
                            className={`status-dot ${connected ? 'status-dot-green' : 'status-dot-red'}`}
                            aria-hidden="true"
                        />
                        <span className={styles.liveText}>
                            {connected ? 'LIVE' : 'OFFLINE'}
                        </span>
                    </div>

                    {/* Active incidents badge */}
                    {activeIncidents > 0 && connected && (
                        <div
                            className={styles.incidentPill}
                            aria-label={`${activeIncidents} active incident${activeIncidents !== 1 ? 's' : ''}`}
                        >
                            <span
                                className="status-dot status-dot-red"
                                style={{ width: 6, height: 6 }}
                                aria-hidden="true"
                            />
                            <span>{activeIncidents} ACTIVE</span>
                        </div>
                    )}
                </div>

                {/* ── Center ───────────────────────────────── */}
                <div className={styles.center} aria-hidden="true">
                    <span className={styles.centerTitle}>Command Center</span>
                </div>

                {/* ── Right ────────────────────────────────── */}
                <div className={styles.right}>
                    {/* Notifications */}
                    <button
                        id="notifications-btn"
                        className="btn btn-icon"
                        aria-label="Notifications"
                        title="Notifications"
                    >
                        <span className="material-icons-round" style={{ fontSize: 20 }}>
                            notifications_none
                        </span>
                    </button>

                    {/* Settings */}
                    <button
                        id="settings-btn"
                        className="btn btn-icon"
                        aria-label="Settings"
                        title="Settings"
                    >
                        <span className="material-icons-round" style={{ fontSize: 20 }}>
                            settings
                        </span>
                    </button>

                    <div className={styles.separator} aria-hidden="true" />

                    {/* User info */}
                    <div className={styles.userChip}>
                        <div
                            className={styles.avatar}
                            aria-hidden="true"
                            data-role={user.role === 'ADMIN' ? 'admin' : 'responder'}
                        >
                            {initials}
                        </div>
                        <div className={styles.userMeta}>
                            <span className={styles.userName}>{user.name}</span>
                            <span
                                className={`badge ${user.role === 'ADMIN' ? 'badge-red' : 'badge-blue'}`}
                                aria-label={`Role: ${user.role}`}
                            >
                                {user.role}
                            </span>
                        </div>
                    </div>

                    {/* Sign out */}
                    <button
                        id="logout-btn"
                        onClick={logout}
                        className={`btn btn-outlined ${styles.logoutBtn}`}
                        title="Sign out"
                        aria-label="Sign out"
                    >
                        <span className="material-icons-round" style={{ fontSize: 16 }}>logout</span>
                        <span className={styles.logoutLabel}>Sign Out</span>
                    </button>
                </div>
            </nav>
        </header>
    );
}
