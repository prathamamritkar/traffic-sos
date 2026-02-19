// ============================================================
// App Configuration — env-aware
// ============================================================

class AppConfig {
  static const String env = String.fromEnvironment(
    'APP_ENV',
    defaultValue: 'development',
  );

  static const String detectionServiceUrl = String.fromEnvironment(
    'DETECTION_SERVICE_URL',
    defaultValue: 'http://localhost:3001',
  );

  static const String corridorServiceUrl = String.fromEnvironment(
    'CORRIDOR_SERVICE_URL',
    defaultValue: 'http://localhost:3002',
  );

  static const String trackingServiceUrl = String.fromEnvironment(
    'TRACKING_SERVICE_URL',
    defaultValue: 'ws://localhost:3004',
  );

  static const String geminiApiKey = String.fromEnvironment(
    'GEMINI_API_KEY',
    defaultValue: '',
  );

  static const String huggingFaceToken = String.fromEnvironment(
    'HUGGING_FACE_TOKEN',
    defaultValue: '',
  );

  static const String mqttBrokerUrl = 'mqtt://broker.hivemq.com:1883';
}
