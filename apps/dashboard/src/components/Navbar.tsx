'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import styles from './Navbar.module.css';

interface NavbarProps {
    user: { name: string; role: string; email: string };
    connected: boolean;
    activeIncidents?: number;
}

export function Navbar({ user, connected, activeIncidents = 0 }: NavbarProps) {
    const router = useRouter();
    const [openDropdown, setOpenDropdown] = useState<'notifications' | 'settings' | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            // Cast to Node is safe here because we're in the browser
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setOpenDropdown(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggle = (menu: 'notifications' | 'settings') => {
        setOpenDropdown(openDropdown === menu ? null : menu);
    };

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
                    <div className={styles.navLinks}>
                        <Link
                            href="/dashboard"
                            className={`${styles.navLink} ${usePathname() === '/dashboard' ? styles.navLinkActive : ''}`}
                        >
                            Dashboard
                        </Link>
                        <Link
                            href="/analytics"
                            className={`${styles.navLink} ${usePathname() === '/analytics' ? styles.navLinkActive : ''}`}
                        >
                            Analytics
                        </Link>
                    </div>
                </div>

                {/* ── Right ────────────────────────────────── */}
                <div className={styles.right} ref={wrapperRef}>
                    {/* Notifications */}
                    <div className={styles.dropdownWrapper}>
                        <button
                            id="notifications-btn"
                            className={`btn btn-icon ${openDropdown === 'notifications' ? 'btn-active' : ''}`}
                            aria-label="Notifications"
                            title="Notifications"
                            onClick={() => toggle('notifications')}
                        >
                            <span className="material-icons-round" style={{ fontSize: 20 }}>
                                notifications_none
                            </span>
                        </button>
                        {openDropdown === 'notifications' && (
                            <div className={styles.dropdown}>
                                <div className={styles.dropdownTitle}>Recent Alerts</div>
                                <div className={styles.dropdownItem}>
                                    <div className={styles.notificationIcon}>
                                        <span className="material-icons-round" style={{ fontSize: 16 }}>warning</span>
                                    </div>
                                    <div className={styles.notificationText}>
                                        <span>New Accident Detected</span>
                                        <span className={styles.notificationTime}>2 mins ago · Baner Rd</span>
                                    </div>
                                </div>
                                <div className={styles.dropdownItem}>
                                    <div className={styles.notificationIcon} style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80' }}>
                                        <span className="material-icons-round" style={{ fontSize: 16 }}>check_circle</span>
                                    </div>
                                    <div className={styles.notificationText}>
                                        <span>Ambulance Arrived</span>
                                        <span className={styles.notificationTime}>15 mins ago · FC Rd</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Settings */}
                    <div className={styles.dropdownWrapper}>
                        <button
                            id="settings-btn"
                            className={`btn btn-icon ${openDropdown === 'settings' ? 'btn-active' : ''}`}
                            aria-label="Settings"
                            title="Settings"
                            onClick={() => toggle('settings')}
                        >
                            <span className="material-icons-round" style={{ fontSize: 20 }}>
                                settings
                            </span>
                        </button>
                        {openDropdown === 'settings' && (
                            <div className={styles.dropdown}>
                                <div className={styles.dropdownTitle}>System Settings</div>
                                <div className={styles.dropdownItem} onClick={() => alert('Dark mode is enforced for command center')}>
                                    <span className="material-icons-round" style={{ fontSize: 18 }}>dark_mode</span>
                                    <span>Appearance: Dark</span>
                                </div>
                                <div className={styles.dropdownItem}>
                                    <span className="material-icons-round" style={{ fontSize: 18 }}>notifications_active</span>
                                    <span>Sound Alerts: On</span>
                                </div>
                                <div className={styles.dropdownItem}>
                                    <span className="material-icons-round" style={{ fontSize: 18 }}>dns</span>
                                    <span>Server: Production</span>
                                </div>
                            </div>
                        )}
                    </div>

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
