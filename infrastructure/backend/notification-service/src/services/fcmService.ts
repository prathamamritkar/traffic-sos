// ============================================================
// FCM Service — Firebase Cloud Messaging
// Fixes:
//  • sendMulticastFCM returned early after logging the stub message
//    but before returning — the `if (!initialized) {...}` path had
//    a `return` missing after the log/stub, so it fell through to
//    `admin.messaging()` even when not initialized → crash
//  • admin.messaging().sendEachForMulticast() is the correct API
//    for SDK v12+ (was `sendMulticast` in older versions); kept as-is
//    since it's correct, but added version note.
//  • FCM token validation: empty string tokens pass the batch
//    and cause FCM to return per-message errors for every token
//    → filter empty tokens before batching
// ============================================================
import admin from 'firebase-admin';

let initialized = false;

export function initFirebase(): void {
    if (initialized) return;

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
        console.warn('[notification-service] Firebase credentials not configured — FCM disabled (stub mode)');
        return;
    }

    try {
        admin.initializeApp({
            credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
        });
        initialized = true;
        console.log('[notification-service] Firebase Admin SDK initialized');
    } catch (err) {
        console.error('[notification-service] Firebase init error:', err);
    }
}

export interface FCMPayload {
    token: string;
    title: string;
    body: string;
    data?: Record<string, string>;
}

export async function sendFCMNotification(payload: FCMPayload): Promise<string | null> {
    if (!initialized) {
        console.log(`[notification-service] [FCM_STUB] Token: ${payload.token.slice(0, 8)}...\nTitle: ${payload.title}\nBody: ${payload.body}`);
        return 'STUB-MSG-ID';
    }

    if (!payload.token) {
        console.warn('[notification-service] sendFCMNotification called with empty token');
        return null;
    }

    try {
        const messageId = await admin.messaging().send({
            token: payload.token,
            notification: { title: payload.title, body: payload.body },
            data: payload.data ?? {},
            android: {
                priority: 'high',
                notification: { sound: 'emergency_alert', priority: 'max', channelId: 'rescuedge_sos' },
            },
            apns: {
                payload: { aps: { sound: 'emergency_alert.wav', contentAvailable: true, badge: 1 } },
            },
        });
        console.log(`[notification-service] FCM sent: ${messageId}`);
        return messageId;
    } catch (err) {
        console.error('[notification-service] FCM error:', err);
        return null;
    }
}

export async function sendMulticastFCM(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>
): Promise<void> {
    // Filter empty tokens before sending
    const validTokens = tokens.filter(t => t && t.length > 0);

    if (!initialized) {
        console.log(`[notification-service] [FCM_MULTICAST_STUB] To: ${validTokens.length} tokens\nTitle: ${title}\nBody: ${body}`);
        return; // ← Was missing this return in the original: fell through to admin.messaging()
    }

    if (validTokens.length === 0) return;

    const batchSize = 500; // FCM sendEachForMulticast limit (firebase-admin v12+)
    for (let i = 0; i < validTokens.length; i += batchSize) {
        const batch = validTokens.slice(i, i + batchSize);
        try {
            const response = await admin.messaging().sendEachForMulticast({
                tokens: batch,
                notification: { title, body },
                data: data ?? {},
                android: { priority: 'high' },
            });
            console.log(
                `[notification-service] FCM multicast batch ${Math.floor(i / batchSize) + 1}: ` +
                `${response.successCount} success, ${response.failureCount} failed`
            );
        } catch (err) {
            console.error('[notification-service] FCM multicast error:', err);
        }
    }
}
