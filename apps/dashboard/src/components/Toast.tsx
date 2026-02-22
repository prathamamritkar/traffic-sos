'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import styles from './Toast.module.css';

interface ToastProps {
    message: string;
    title: string;
    type: 'SOS' | 'UPDATE' | 'SIGNAL';
    onClose: () => void;
}

export function Toast({ message, title, type, onClose }: ToastProps) {
    useEffect(() => {
        const timer = setTimeout(onClose, 5000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const icon = type === 'SOS' ? 'warning' : 'check_circle';
    const toastClass = `${styles.toast} ${type === 'SOS' ? styles.toastSos : styles.toastUpdate}`;

    return (
        <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className={toastClass}
            onClick={onClose}
        >
            <div className={styles.icon}>
                <span className="material-icons-round">{icon}</span>
            </div>
            <div className={styles.content}>
                <div className={styles.title}>{title}</div>
                <div className={styles.message}>{message}</div>
            </div>
            <div className={styles.close}>
                <span className="material-icons-round">close</span>
            </div>
        </motion.div>
    );
}
