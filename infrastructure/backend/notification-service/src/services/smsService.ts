// ============================================================
// SMS Service — Twilio (free trial, no expiry for demo)
// Fixes:
//   • Vulnerability: SMS content logging to console was unconditioned.
//     Now gated to `process.env.NODE_ENV === 'development'` or if
//     specifically enabled via `DEBUG_SMS=true`.
//   • Added basic E.164 phone number sanitation for the Twilio call.
//   • PUBLIC_URL fallback tightened.
// ============================================================
import twilio from 'twilio';

let twilioClient: ReturnType<typeof twilio> | null = null;

function getClient() {
    if (twilioClient) return twilioClient;

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
        if (process.env.NODE_ENV !== 'production') {
            console.warn('[notification-service] Twilio credentials not configured — SMS disabled');
        }
        return null;
    }

    twilioClient = twilio(accountSid, authToken);
    return twilioClient;
}

export async function sendSMS(to: string, body: string): Promise<boolean> {
    const client = getClient();

    // Sanitize recipient number
    const sanitizedTo = to.startsWith('+') ? to : `+${to}`;

    if (!client) {
        // Fallback logging: only in dev or if DEBUG_SMS is true
        if (process.env.NODE_ENV === 'development' || process.env.DEBUG_SMS === 'true') {
            console.log(`[notification-service] [SMS_STUB] To: ${sanitizedTo}\nMessage: ${body}`);
        }
        return true;
    }

    const from = process.env.TWILIO_PHONE_NUMBER;
    if (!from) {
        console.error('[notification-service] TWILIO_PHONE_NUMBER not set — SMS cannot be sent');
        return false;
    }

    try {
        const message = await client.messages.create({ to: sanitizedTo, from, body });
        console.log(`[notification-service] SMS sent to ${sanitizedTo}: ${message.sid}`);
        return true;
    } catch (err: any) {
        console.error(`[notification-service] SMS failed to ${sanitizedTo}:`, err.message || err);
        return false;
    }
}

export async function sendEmergencySMS(
    contacts: string[],
    accidentId: string,
    location: { lat: number; lng: number }
): Promise<void> {
    const mapsLink = `https://maps.google.com/?q=${location.lat},${location.lng}`;

    // Fallback to localhost only in development
    const dashboardHost = process.env.PUBLIC_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '');
    if (!dashboardHost) {
        console.warn('[notification-service] PUBLIC_URL not set — broadcast link will be missing from SMS');
    }

    const broadcastUrl = `${dashboardHost}/track/${accidentId}/broadcast`;

    const body = [
        `🚨 EMERGENCY ALERT — RescuEdge`,
        `Your contact has been in an accident.`,
        `Case ID: ${accidentId}`,
        `Live Location: ${mapsLink}`,
        `Live Audio/Video: ${broadcastUrl}`,
        `Emergency services are enroute. Stay calm.`,
    ].join('\n');

    // Basic async orchestration
    await Promise.allSettled(contacts.map((contact) => sendSMS(contact, body)));
}
