// ============================================================
// MQTT Client — Detection Service
// Fixes:
//  • mqttClient.publish() called before MQTT is connected;
//    buffered messages would be dropped if QoS 0, or the library
//    queues them but has no overflow guard. Added `connected` check
//    + warning log so the caller knows about a potential message drop.
//  • No `close` event handler — reconnect storms possible on broker
//    restart. Added logging.
//  • CLIENT_ID only 6 hex chars of entropy — increased to 12 to
//    reduce collision probability on the shared public broker.
// ============================================================
import mqtt, { IClientPublishOptions, MqttClient } from 'mqtt';

const BROKER_URL = process.env.MQTT_BROKER_URL ?? 'mqtt://broker.hivemq.com:1883';
const CLIENT_ID = `rapidrescue-detection-${Math.random().toString(16).slice(2, 14)}`;

let client: MqttClient;

function getClient(): MqttClient {
    if (client) return client;

    client = mqtt.connect(BROKER_URL, {
        clientId: CLIENT_ID,
        clean: true,
        reconnectPeriod: 3000,
        connectTimeout: 10_000,
        keepalive: 60,
    });

    client.on('connect', () => {
        console.log(`[detection-service] MQTT connected to ${BROKER_URL} (${CLIENT_ID})`);
    });

    client.on('error', (err) => {
        console.error('[detection-service] MQTT error:', err.message);
    });

    client.on('reconnect', () => {
        console.log('[detection-service] MQTT reconnecting...');
    });

    client.on('close', () => {
        console.warn('[detection-service] MQTT connection closed');
    });

    client.on('offline', () => {
        console.warn('[detection-service] MQTT offline — broker unreachable');
    });

    return client;
}

// Wrap publish with a connectivity check + warning
export const mqttClient = getClient();

export function safeMqttPublish(
    topic: string,
    message: string,
    opts: IClientPublishOptions = { qos: 1 }
): void {
    if (!mqttClient.connected) {
        console.warn(`[detection-service] MQTT not connected — message may be queued or dropped: ${topic}`);
    }
    mqttClient.publish(topic, message, opts, (err) => {
        if (err) console.error(`[detection-service] MQTT publish error on ${topic}:`, err.message);
    });
}
