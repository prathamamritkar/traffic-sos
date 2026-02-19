'use client';
import { useRouter } from 'next/navigation';
import styles from './Navbar.module.css';

interface NavbarProps {
    user: { name: string; role: string; email: string };
    connected: boolean;
}

export function Navbar({ user, connected }: NavbarProps) {
    const router = useRouter();

    const logout = () => {
        localStorage.removeItem('rescuedge_token');
        localStorage.removeItem('rescuedge_user');
        router.push('/');
    };

    return (
        <nav className={styles.nav}>
            <div className={styles.left}>
                <div className={styles.logo}>
                    <span className={styles.logoEmoji}>🚑</span>
                    <span className={styles.logoText}>RescuEdge</span>
                    <span className={styles.logoBadge}>ADGC</span>
                </div>
                <div className={styles.divider} />
                <div className={styles.liveIndicator}>
                    <span className={connected ? 'status-dot status-dot-green' : 'status-dot status-dot-red'} />
                    <span className={styles.liveText}>{connected ? 'LIVE' : 'OFFLINE'}</span>
                </div>
            </div>

            <div className={styles.center}>
                <span className={styles.title}>Command Center</span>
            </div>

            <div className={styles.right}>
                <div className={styles.userInfo}>
                    <div className={styles.userName}>{user.name}</div>
                    <div className={`badge ${user.role === 'ADMIN' ? 'badge-red' : 'badge-blue'}`}>
                        {user.role}
                    </div>
                </div>
                <button id="logout-btn" className={styles.logoutBtn} onClick={logout}>
                    Sign Out
                </button>
            </div>
        </nav>
    );
}
