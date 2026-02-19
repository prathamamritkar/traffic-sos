/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    env: {
        NEXT_PUBLIC_TRACKING_WS_URL: process.env.TRACKING_SERVICE_URL ?? 'ws://localhost:3004',
        NEXT_PUBLIC_DETECTION_API_URL: process.env.DETECTION_SERVICE_URL ?? 'http://localhost:3001',
        NEXT_PUBLIC_CORRIDOR_API_URL: process.env.CORRIDOR_SERVICE_URL ?? 'http://localhost:3002',
        NEXT_PUBLIC_NOTIFICATION_API_URL: process.env.NOTIFICATION_SERVICE_URL ?? 'http://localhost:3003',
        NEXT_PUBLIC_MQTT_WS_URL: process.env.MQTT_BROKER_WS_URL ?? 'wss://broker.hivemq.com:8884/mqtt',
    },
};

module.exports = nextConfig;
