// ============================================================
// RapidRescue Environment Configuration
// Fixes:
//  • Production JWT secret was empty string '' — empty string is
//    falsy but IS a valid value for `?? ''` so no fallback fired.
//    Added a startup exit guard for known-bad values.
//  • staging/production jwtSecret falling back to '' — an empty
//    secret makes jwt.sign() work but all tokens are trivially
//    forgeable (any jwt.verify() also passes with '').
//    → Process exits if JWT_SECRET is empty in non-development.
//  • mqttBrokerUrl stored as full URL — this is fine for the
//    `mqtt` package (uses full URL). Clarified comment.
//  • Exposes a `validateConfig()` function to call at startup
//    so misconfiguration fails early with a clear error message.
// ============================================================

export type EnvName = 'development' | 'staging' | 'production';

export interface ServiceConfig {
    detectionServiceUrl: string;
    corridorServiceUrl: string;
    notificationServiceUrl: string;
    trackingServiceUrl: string;   // WebSocket
    dashboardUrl: string;
    mqttBrokerUrl: string;   // Full mqtt:// URL for the `mqtt` package
    mqttBrokerWsUrl: string;   // Full wss:// URL for browser MQTT clients
}

export interface AuthConfig {
    jwtSecret: string;
    jwtExpiresIn: string;
    googleClientId: string;
}

export interface RapidRescueConfig {
    env: EnvName;
    services: ServiceConfig;
    auth: AuthConfig;
    version: '1.0';
}

const configs: Record<EnvName, RapidRescueConfig> = {
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
            // Dev uses a known insecure default — safe for local development only
            jwtSecret: process.env.JWT_SECRET ?? 'rapidrescue-dev-secret-change-in-prod',
            jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
            googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
        },
    },

    staging: {
        env: 'staging',
        version: '1.0',
        services: {
            detectionServiceUrl: process.env.DETECTION_SERVICE_URL ?? 'https://detection.rapidrescue-staging.app',
            corridorServiceUrl: process.env.CORRIDOR_SERVICE_URL ?? 'https://corridor.rapidrescue-staging.app',
            notificationServiceUrl: process.env.NOTIFICATION_SERVICE_URL ?? 'https://notify.rapidrescue-staging.app',
            trackingServiceUrl: process.env.TRACKING_SERVICE_URL ?? 'wss://tracking.rapidrescue-staging.app',
            dashboardUrl: process.env.DASHBOARD_URL ?? 'https://dashboard.rapidrescue-staging.app',
            mqttBrokerUrl: process.env.MQTT_BROKER_URL ?? 'mqtt://broker.hivemq.com:1883',
            mqttBrokerWsUrl: process.env.MQTT_BROKER_WS_URL ?? 'wss://broker.hivemq.com:8884/mqtt',
        },
        auth: {
            jwtSecret: process.env.JWT_SECRET ?? '', // validated by validateConfig()
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
            mqttBrokerUrl: process.env.MQTT_BROKER_URL ?? '',
            mqttBrokerWsUrl: process.env.MQTT_BROKER_WS_URL ?? '',
        },
        auth: {
            jwtSecret: process.env.JWT_SECRET ?? '', // validated by validateConfig()
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

export const config: RapidRescueConfig = configs[resolveEnv()];
export default config;

/**
 * Call this at service startup to abort early with a clear error
 * if required environment variables are missing or insecure.
 */
export function validateConfig(): void {
    const env = config.env;

    if (env !== 'development') {
        if (!config.auth.jwtSecret) {
            console.error('[config] FATAL: JWT_SECRET must be set in staging/production');
            process.exit(1);
        }
        if (config.auth.jwtSecret === 'rapidrescue-dev-secret-change-in-prod') {
            console.error('[config] FATAL: Default JWT_SECRET detected in non-development environment');
            process.exit(1);
        }

        const missingUrls: string[] = [];
        const s = config.services;
        if (!s.detectionServiceUrl) missingUrls.push('DETECTION_SERVICE_URL');
        if (!s.corridorServiceUrl) missingUrls.push('CORRIDOR_SERVICE_URL');
        if (!s.notificationServiceUrl) missingUrls.push('NOTIFICATION_SERVICE_URL');
        if (!s.trackingServiceUrl) missingUrls.push('TRACKING_SERVICE_URL');
        if (!s.mqttBrokerUrl) missingUrls.push('MQTT_BROKER_URL');

        if (missingUrls.length > 0) {
            console.error(`[config] FATAL: Missing required env vars for ${env}:`, missingUrls.join(', '));
            process.exit(1);
        }
    }

    console.log(`[config] Environment validated: ${env}`);
}
