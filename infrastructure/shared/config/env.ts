// ============================================================
// RescuEdge Environment Configuration
// Auto-switches based on NODE_ENV / FLUTTER_ENV
// ============================================================

export type EnvName = 'development' | 'staging' | 'production';

export interface ServiceConfig {
    detectionServiceUrl: string;
    corridorServiceUrl: string;
    notificationServiceUrl: string;
    trackingServiceUrl: string;   // WebSocket
    dashboardUrl: string;
    mqttBrokerUrl: string;
    mqttBrokerWsUrl: string;
}

export interface AuthConfig {
    jwtSecret: string;
    jwtExpiresIn: string;
    googleClientId: string;
}

export interface RescuEdgeConfig {
    env: EnvName;
    services: ServiceConfig;
    auth: AuthConfig;
    version: '1.0';
}

const configs: Record<EnvName, RescuEdgeConfig> = {
    development: {
        env: 'development',
        version: '1.0',
        services: {
            detectionServiceUrl: 'http://localhost:3001',
            corridorServiceUrl: 'http://localhost:3002',
            notificationServiceUrl: 'http://localhost:3003',
            trackingServiceUrl: 'ws://localhost:3004',
            dashboardUrl: 'http://localhost:3000',
            mqttBrokerUrl: 'mqtt://broker.hivemq.com:1883',
            mqttBrokerWsUrl: 'wss://broker.hivemq.com:8884/mqtt',
        },
        auth: {
            jwtSecret: process.env.JWT_SECRET ?? 'rescuedge-dev-secret-change-in-prod',
            jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
            googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
        },
    },

    staging: {
        env: 'staging',
        version: '1.0',
        services: {
            detectionServiceUrl: process.env.DETECTION_SERVICE_URL ?? 'https://detection.rescuedge-staging.app',
            corridorServiceUrl: process.env.CORRIDOR_SERVICE_URL ?? 'https://corridor.rescuedge-staging.app',
            notificationServiceUrl: process.env.NOTIFICATION_SERVICE_URL ?? 'https://notify.rescuedge-staging.app',
            trackingServiceUrl: process.env.TRACKING_SERVICE_URL ?? 'wss://tracking.rescuedge-staging.app',
            dashboardUrl: process.env.DASHBOARD_URL ?? 'https://dashboard.rescuedge-staging.app',
            mqttBrokerUrl: 'mqtt://broker.hivemq.com:1883',
            mqttBrokerWsUrl: 'wss://broker.hivemq.com:8884/mqtt',
        },
        auth: {
            jwtSecret: process.env.JWT_SECRET ?? '',
            jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
            googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
        },
    },

    production: {
        env: 'production',
        version: '1.0',
        services: {
            detectionServiceUrl: process.env.DETECTION_SERVICE_URL ?? '',
            corridorServiceUrl: process.env.CORRIDOR_SERVICE_URL ?? '',
            notificationServiceUrl: process.env.NOTIFICATION_SERVICE_URL ?? '',
            trackingServiceUrl: process.env.TRACKING_SERVICE_URL ?? '',
            dashboardUrl: process.env.DASHBOARD_URL ?? '',
            mqttBrokerUrl: 'mqtt://broker.hivemq.com:1883',
            mqttBrokerWsUrl: 'wss://broker.hivemq.com:8884/mqtt',
        },
        auth: {
            jwtSecret: process.env.JWT_SECRET ?? '',
            jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '24h',
            googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
        },
    },
};

function resolveEnv(): EnvName {
    const raw = process.env.NODE_ENV ?? process.env.APP_ENV ?? 'development';
    if (raw === 'production') return 'production';
    if (raw === 'staging') return 'staging';
    return 'development';
}

export const config: RescuEdgeConfig = configs[resolveEnv()];
export default config;
