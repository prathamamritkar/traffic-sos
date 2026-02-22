'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import type { AppNotification } from '@/hooks/useLiveData';
import styles from './Navbar.module.css';

interface NavbarProps {
    user: { name: string; role: string; email: string };
    connected: boolean;
    activeIncidents?: number;
    notifications?: AppNotification[];
    onClearNotifications?: () => void;
    onOpenSettings?: () => void;
    onTutorialStep?: () => void;
    tutorialStep?: number;
}

export function Navbar({
    user,
    connected,
    activeIncidents = 0,
    notifications = [],
    onClearNotifications,
    onOpenSettings,
    onTutorialStep,
    tutorialStep = 0
}: NavbarProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [openDropdown, setOpenDropdown] = useState<'notifications' | 'settings' | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        router.prefetch('/dashboard');
        router.prefetch('/analytics');
    }, [router]);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
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

    const formatTime = (iso: string) => {
        const date = new Date(iso);
        const now = new Date();
        const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return date.toLocaleDateString();
    };

    const logout = () => {
        try {
            localStorage.removeItem('rapidrescue_token');
            localStorage.removeItem('rapidrescue_user');
            // Reset theme attribute to prevent theme leakage to login page
            document.documentElement.removeAttribute('data-theme');
        } catch { }
        router.push('/');
    };

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
                    <div className={styles.logo} aria-label="RapidRescue home">
                        <div className={styles.logoMark} aria-hidden="true">
                            <span
                                className="material-icons-round"
                                style={{ fontSize: 18, color: 'var(--md-sys-color-primary)' }}
                            >
                                emergency
                            </span>
                        </div>
                        <span className={styles.logoText}>RapidRescue</span>
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
                            prefetch
                            className={`${styles.navLink} ${pathname === '/dashboard' ? styles.navLinkActive : ''}`}
                        >
                            Dashboard
                        </Link>
                        <Link
                            href="/analytics"
                            prefetch
                            className={`${styles.navLink} ${pathname === '/analytics' ? styles.navLinkActive : ''}`}
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
                                {notifications.length > 0 ? 'notifications_active' : 'notifications_none'}
                            </span>
                            {notifications.length > 0 && <span className={styles.badgeCount}>{notifications.length}</span>}
                        </button>
                        {openDropdown === 'notifications' && (
                            <div className={styles.dropdown}>
                                <div className={styles.dropdownHeader}>
                                    <div className={styles.dropdownTitle}>Recent Alerts</div>
                                    <button
                                        className={styles.clearBtn}
                                        onClick={onClearNotifications}
                                        disabled={notifications.length === 0}
                                    >
                                        Clear All
                                    </button>
                                </div>

                                {notifications.length === 0 ? (
                                    <div className={styles.emptyState}>
                                        <span className="material-icons-round">notifications_off</span>
                                        <p>No new notifications</p>
                                    </div>
                                ) : (
                                    notifications.map(notif => (
                                        <div key={notif.id} className={styles.dropdownItem}>
                                            <div
                                                className={styles.notificationIcon}
                                                style={notif.type === 'SOS' ? {
                                                    background: 'var(--md-sys-color-error-container)',
                                                    color: 'var(--md-sys-color-error)'
                                                } : {}}
                                            >
                                                <span className="material-icons-round" style={{ fontSize: 16 }}>{notif.icon}</span>
                                            </div>
                                            <div className={styles.notificationText}>
                                                <span>{notif.title}</span>
                                                <span className={styles.notificationDesc}>{notif.message}</span>
                                                <span className={styles.notificationTime}>{formatTime(notif.time)}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    {/* Tutorial */}
                    {onTutorialStep && (
                        <button
                            id="tutorial-btn"
                            className="btn btn-icon"
                            aria-label="Run tutorial step"
                            title={`Tutorial Step ${tutorialStep}/5 — Click to advance`}
                            onClick={onTutorialStep}
                        >
                            <span className="material-icons-round" style={{ fontSize: 20 }}>
                                model_training
                            </span>
                        </button>
                    )}

                    {/* Settings */}
                    <button
                        id="settings-btn"
                        className="btn btn-icon"
                        aria-label="Settings"
                        title="Settings"
                        onClick={onOpenSettings}
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
