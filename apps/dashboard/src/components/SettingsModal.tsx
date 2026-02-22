'use client';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './SettingsModal.module.css';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    soundEnabled: boolean;
    onToggleSound: () => void;
    user: { name: string; role: string; email: string };
    theme: 'light' | 'dark';
    onToggleTheme: () => void;
}

export function SettingsModal({ isOpen, onClose, soundEnabled, onToggleSound, user, theme, onToggleTheme }: SettingsModalProps) {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className={styles.overlay} onClick={onClose}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className={styles.modal}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className={styles.header}>
                        <div className={styles.title}>System Settings</div>
                        <button className={styles.closeBtn} onClick={onClose}>
                            <span className="material-icons-round">close</span>
                        </button>
                    </div>

                    <div className={styles.content}>
                        <section className={styles.section}>
                            <h3 className={styles.sectionTitle}>Preferences</h3>
                            <div className={styles.settingItem}>
                                <div className={styles.settingInfo}>
                                    <span className={styles.settingLabel}>Audio Alerts</span>
                                    <span className={styles.settingDesc}>Play siren and chime sounds for new incidents</span>
                                </div>
                                <button
                                    className={`${styles.toggle} ${soundEnabled ? styles.toggleOn : ''}`}
                                    onClick={onToggleSound}
                                >
                                    <div className={styles.toggleThumb} />
                                </button>
                            </div>

                            <div className={styles.settingItem}>
                                <div className={styles.settingInfo}>
                                    <span className={styles.settingLabel}>Dark Mode</span>
                                    <span className={styles.settingDesc}>System-wide dark aesthetic for command centers</span>
                                </div>
                                <button
                                    className={`${styles.toggle} ${theme === 'dark' ? styles.toggleOn : ''}`}
                                    onClick={onToggleTheme}
                                >
                                    <div className={styles.toggleThumb} />
                                </button>
                            </div>
                        </section>

                        <section className={styles.section}>
                            <h3 className={styles.sectionTitle}>Account Information</h3>
                            <div className={styles.profileRow}>
                                <div className={styles.avatarLarge}>
                                    {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                                <div className={styles.profileInfo}>
                                    <div className={styles.profileName}>{user.name}</div>
                                    <div className={styles.profileEmail}>{user.email}</div>
                                    <div className={styles.profileRole}>
                                        <span className={`badge ${user.role === 'ADMIN' ? 'badge-red' : 'badge-blue'}`}>
                                            {user.role}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </section>

                    </div>

                    <div className={styles.footer}>
                        <div className={styles.version}>RapidRescue v1.0.4 - Premium Edition</div>
                        <button className="btn btn-primary" onClick={onClose}>Done</button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
