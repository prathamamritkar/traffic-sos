// ============================================================
// MQTT Client — HiveMQ Public Broker (zero-config, free forever)
// Broker: broker.hivemq.com:1883
// ============================================================
import mqtt, { MqttClient } from 'mqtt';

const BROKER_URL = process.env.MQTT_BROKER_URL ?? 'mqtt://broker.hivemq.com:1883';
const CLIENT_ID = `rescuedge-detection-${Math.random().toString(16).slice(2, 8)}`;

let client: MqttClient;

function getClient(): MqttClient {
    if (client) return client;

    client = mqtt.connect(BROKER_URL, {
        clientId: CLIENT_ID,
        clean: true,
        reconnectPeriod: 3000,
        connectTimeout: 10000,
        keepalive: 60,
    });

    client.on('connect', () => {
        console.log(`[detection-service] MQTT connected to ${BROKER_URL}`);
    });

    client.on('error', (err) => {
        console.error('[detection-service] MQTT error:', err.message);
    });

    client.on('reconnect', () => {
        console.log('[detection-service] MQTT reconnecting...');
    });

    return client;
}

export const mqttClient = getClient();
