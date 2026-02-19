// ============================================================
// SMS Service — Twilio (free trial, no expiry for demo)
// Sends SMS to victim's emergency contacts
// ============================================================
import twilio from 'twilio';

let twilioClient: ReturnType<typeof twilio> | null = null;

function getClient() {
    if (twilioClient) return twilioClient;

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
        console.warn('[notification-service] Twilio credentials not configured — SMS disabled');
        return null;
    }

    twilioClient = twilio(accountSid, authToken);
    return twilioClient;
}

export async function sendSMS(to: string, body: string): Promise<boolean> {
    const client = getClient();
    if (!client) {
        // Fallback logging for hackathon demo
        console.log(`[notification-service] [SMS_STUB] To: ${to}\nMessage: ${body}`);
        return true;
    }

    const from = process.env.TWILIO_PHONE_NUMBER;
    if (!from) {
        console.warn('[notification-service] TWILIO_PHONE_NUMBER not set');
        return false;
    }

    try {
        const message = await client.messages.create({ to, from, body });
        console.log(`[notification-service] SMS sent to ${to}: ${message.sid}`);
        return true;
    } catch (err) {
        console.error(`[notification-service] SMS failed to ${to}:`, err);
        return false;
    }
}

export async function sendEmergencySMS(
    contacts: string[],
    accidentId: string,
    location: { lat: number; lng: number }
): Promise<void> {
    const mapsLink = `https://maps.google.com/?q=${location.lat},${location.lng}`;
    const broadcastUrl = `${process.env.PUBLIC_URL || 'http://localhost:3000'}/track/${accidentId}/broadcast`;

    const body = [
        `🚨 EMERGENCY ALERT — RescuEdge`,
        `Your contact has been in an accident.`,
        `Case ID: ${accidentId}`,
        `Live Location: ${mapsLink}`,
        `Live Audio/Video: ${broadcastUrl}`,
        `Emergency services are enroute. Stay calm.`,
    ].join('\n');

    await Promise.allSettled(contacts.map((contact) => sendSMS(contact, body)));
}
