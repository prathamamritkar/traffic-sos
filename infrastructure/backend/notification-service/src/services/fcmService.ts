// ============================================================
// FCM Service — Firebase Cloud Messaging (free tier)
// Sends push notifications to responder app
// ============================================================
import admin from 'firebase-admin';

let initialized = false;

export function initFirebase(): void {
    if (initialized) return;

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
        console.warn('[notification-service] Firebase credentials not configured — FCM disabled');
        return;
    }

    admin.initializeApp({
        credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
        }),
    });

    initialized = true;
    console.log('[notification-service] Firebase Admin SDK initialized');
}

export interface FCMPayload {
    token: string;
    title: string;
    body: string;
    data?: Record<string, string>;
}

export async function sendFCMNotification(payload: FCMPayload): Promise<string | null> {
    if (!initialized) {
        console.log(`[notification-service] [FCM_STUB] To: ${payload.token}\nTitle: ${payload.title}\nBody: ${payload.body}`);
        return 'STUB-MSG-ID';
    }

    try {
        const messageId = await admin.messaging().send({
            token: payload.token,
            notification: {
                title: payload.title,
                body: payload.body,
            },
            data: payload.data ?? {},
            android: {
                priority: 'high',
                notification: {
                    sound: 'emergency_alert',
                    priority: 'max',
                    channelId: 'rescuedge_sos',
                },
            },
            apns: {
                payload: {
                    aps: {
                        sound: 'emergency_alert.wav',
                        contentAvailable: true,
                        badge: 1,
                    },
                },
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
    if (!initialized) {
        console.log(`[notification-service] [FCM_MULTICAST_STUB] To: ${tokens.length} tokens\nTitle: ${title}\nBody: ${body}`);
        if (tokens.length === 0) return;
    } else if (tokens.length === 0) {
        return;
    }

    const batchSize = 500; // FCM multicast limit
    for (let i = 0; i < tokens.length; i += batchSize) {
        const batch = tokens.slice(i, i + batchSize);
        try {
            const response = await admin.messaging().sendEachForMulticast({
                tokens: batch,
                notification: { title, body },
                data: data ?? {},
                android: { priority: 'high' },
            });
            console.log(`[notification-service] FCM multicast: ${response.successCount} success, ${response.failureCount} failed`);
        } catch (err) {
            console.error('[notification-service] FCM multicast error:', err);
        }
    }
}
