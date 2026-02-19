import mqtt, { MqttClient } from 'mqtt';

const BROKER_URL = process.env.MQTT_BROKER_URL ?? 'mqtt://broker.hivemq.com:1883';
const CLIENT_ID = `rescuedge-corridor-${Math.random().toString(16).slice(2, 8)}`;

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
    client.on('connect', () => console.log(`[corridor-service] MQTT connected`));
    client.on('error', (err) => console.error('[corridor-service] MQTT error:', err.message));
    return client;
}

export const mqttClient = getClient();
