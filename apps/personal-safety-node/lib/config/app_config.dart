// ============================================================
// App Configuration — compile-time environment variables
// Fixes:
//  • mqttBrokerUrl used plain 'mqtt://' scheme — the mqtt_client
//    package connects via TCP, not HTTP scheme. Separate host+port.
//  • All URL fields documented for developers.
// ============================================================

class AppConfig {
  AppConfig._(); // Not instantiable

  /// APP_ENV — 'development' | 'staging' | 'production'
  static const String env = String.fromEnvironment(
    'APP_ENV',
    defaultValue: 'development',
  );

  /// REST endpoint for the crash detection microservice
  static const String detectionServiceUrl = String.fromEnvironment(
    'DETECTION_SERVICE_URL',
    defaultValue: 'http://localhost:3001',
  );

  /// REST endpoint for the green corridor orchestration service
  static const String corridorServiceUrl = String.fromEnvironment(
    'CORRIDOR_SERVICE_URL',
    defaultValue: 'http://localhost:3002',
  );

  /// WebSocket endpoint for the ambulance tracking service
  static const String trackingServiceUrl = String.fromEnvironment(
    'TRACKING_SERVICE_URL',
    defaultValue: 'ws://localhost:3004',
  );

  /// Google Gemini API key — required for AI scene analysis
  static const String geminiApiKey = String.fromEnvironment(
    'GEMINI_API_KEY',
    defaultValue: '',
  );

  /// HuggingFace user access token — optional secondary inference engine
  static const String huggingFaceToken = String.fromEnvironment(
    'HUGGING_FACE_TOKEN',
    defaultValue: '',
  );

  // ── MQTT config ──────────────────────────────────────────
  // Stored as separate host/port because mqtt_client's MqttServerClient
  // takes host and port as separate constructor arguments, not a URL string.
  /// Public HiveMQ broker — replace with private broker in production
  static const String mqttBrokerHost = 'broker.hivemq.com';
  static const int    mqttBrokerPort = 1883;

  /// Whether the app is running in demo/hackathon mode
  static bool get isDemo => env == 'development';
}
