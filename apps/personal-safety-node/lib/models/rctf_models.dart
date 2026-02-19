// ============================================================
// RCTF JSON Model — Dart implementation
// Mirrors shared/models/rctf.ts exactly
// ============================================================

enum CrashType { confirmedCrash, phoneDrop, pothole, hardBrake, unknown }
enum CaseStatus { detected, dispatched, enRoute, arrived, resolved, cancelled }
enum UserRole { user, responder, admin }

// ── GeoPoint ──────────────────────────────────────────────────
class GeoPoint {
  final double lat;
  final double lng;
  final double? accuracy;
  final double? altitude;
  final double? heading;
  final double? speed;

  const GeoPoint({
    required this.lat,
    required this.lng,
    this.accuracy,
    this.altitude,
    this.heading,
    this.speed,
  });

  Map<String, dynamic> toJson() => {
    'lat': lat,
    'lng': lng,
    if (accuracy != null) 'accuracy': accuracy,
    if (altitude != null) 'altitude': altitude,
    if (heading != null) 'heading': heading,
    if (speed != null) 'speed': speed,
  };

  factory GeoPoint.fromJson(Map<String, dynamic> json) => GeoPoint(
    lat:      (json['lat'] as num).toDouble(),
    lng:      (json['lng'] as num).toDouble(),
    accuracy: (json['accuracy'] as num?)?.toDouble(),
    altitude: (json['altitude'] as num?)?.toDouble(),
    heading:  (json['heading'] as num?)?.toDouble(),
    speed:    (json['speed'] as num?)?.toDouble(),
  );
}

// ── Medical Profile ───────────────────────────────────────────
class MedicalProfile {
  final String bloodGroup;
  final int age;
  final String gender;
  final List<String> allergies;
  final List<String> medications;
  final List<String> conditions;
  final List<String> emergencyContacts;

  const MedicalProfile({
    required this.bloodGroup,
    required this.age,
    required this.gender,
    required this.allergies,
    required this.medications,
    required this.conditions,
    required this.emergencyContacts,
  });

  Map<String, dynamic> toJson() => {
    'bloodGroup':        bloodGroup,
    'age':               age,
    'gender':            gender,
    'allergies':         allergies,
    'medications':       medications,
    'conditions':        conditions,
    'emergencyContacts': emergencyContacts,
  };

  factory MedicalProfile.fromJson(Map<String, dynamic> json) => MedicalProfile(
    bloodGroup:        json['bloodGroup'] as String? ?? 'Unknown',
    age:               json['age'] as int? ?? 0,
    gender:            json['gender'] as String? ?? 'Unknown',
    allergies:         List<String>.from(json['allergies'] as List? ?? const []),
    medications:       List<String>.from(json['medications'] as List? ?? const []),
    conditions:        List<String>.from(json['conditions'] as List? ?? const []),
    emergencyContacts: List<String>.from(json['emergencyContacts'] as List? ?? const []),
  );
}

// ── Crash Metrics ─────────────────────────────────────────────
class CrashMetrics {
  final double gForce;
  final double speedBefore;
  final double speedAfter;
  final double mlConfidence;
  final String crashType;
  final bool rolloverDetected;
  final String? impactDirection;

  const CrashMetrics({
    required this.gForce,
    required this.speedBefore,
    required this.speedAfter,
    required this.mlConfidence,
    required this.crashType,
    required this.rolloverDetected,
    this.impactDirection,
  });

  Map<String, dynamic> toJson() => {
    'gForce':           gForce,
    'speedBefore':      speedBefore,
    'speedAfter':       speedAfter,
    'mlConfidence':     mlConfidence,
    'crashType':        crashType,
    'rolloverDetected': rolloverDetected,
    if (impactDirection != null) 'impactDirection': impactDirection,
  };

  factory CrashMetrics.fromJson(Map<String, dynamic> json) => CrashMetrics(
    gForce:           (json['gForce'] as num?)?.toDouble() ?? 0.0,
    speedBefore:      (json['speedBefore'] as num?)?.toDouble() ?? 0.0,
    speedAfter:       (json['speedAfter'] as num?)?.toDouble() ?? 0.0,
    mlConfidence:     (json['mlConfidence'] as num?)?.toDouble() ?? 0.0,
    crashType:        json['crashType'] as String? ?? 'UNKNOWN',
    rolloverDetected: json['rolloverDetected'] as bool? ?? false,
    impactDirection:  json['impactDirection'] as String?,
  );
}

// ── RCTF Meta ─────────────────────────────────────────────────
class RCTFMeta {
  final String requestId;
  final String timestamp;
  final String env;
  final String version;

  const RCTFMeta({
    required this.requestId,
    required this.timestamp,
    required this.env,
    this.version = '1.0',
  });

  Map<String, dynamic> toJson() => {
    'requestId': requestId,
    'timestamp': timestamp,
    'env':       env,
    'version':   version,
  };
}

// ── RCTF Auth ─────────────────────────────────────────────────
class RCTFAuth {
  final String userId;
  final String role;
  final String token;

  const RCTFAuth({
    required this.userId,
    required this.role,
    required this.token,
  });

  Map<String, dynamic> toJson() => {
    'userId': userId,
    'role':   role,
    'token':  token,
  };
}

// ── RCTF Envelope ─────────────────────────────────────────────
class RCTFEnvelope<T> {
  final RCTFMeta meta;
  final RCTFAuth auth;
  final T payload;

  const RCTFEnvelope({
    required this.meta,
    required this.auth,
    required this.payload,
  });

  Map<String, dynamic> toJson(Map<String, dynamic> Function(T) payloadToJson) => {
    'meta':    meta.toJson(),
    'auth':    auth.toJson(),
    'payload': payloadToJson(payload),
  };
}

// ── SOS Payload ───────────────────────────────────────────────
class SOSPayload {
  final GeoPoint location;
  final CrashMetrics metrics;
  final MedicalProfile medicalProfile;

  const SOSPayload({
    required this.location,
    required this.metrics,
    required this.medicalProfile,
  });

  Map<String, dynamic> toJson() => {
    'location':       location.toJson(),
    'metrics':        metrics.toJson(),
    'medicalProfile': medicalProfile.toJson(),
  };
}

// ── Scene Analysis Response ───────────────────────────────────
class SceneAnalysis {
  final String injurySeverity;
  final int victimCount;
  final List<String> hazards;
  final List<String> recommendedServices;
  final String urgency;
  final List<String> suggestedActions;
  final double confidence;
  final String rawDescription;

  const SceneAnalysis({
    required this.injurySeverity,
    required this.victimCount,
    required this.hazards,
    required this.recommendedServices,
    required this.urgency,
    required this.suggestedActions,
    required this.confidence,
    required this.rawDescription,
  });

  factory SceneAnalysis.fromJson(Map<String, dynamic> json) => SceneAnalysis(
    injurySeverity:      json['injurySeverity'] as String? ?? 'UNKNOWN',
    victimCount:         json['victimCount'] as int? ?? 1,
    hazards:             List<String>.from(json['hazards'] as List? ?? []),
    recommendedServices: List<String>.from(json['recommendedServices'] as List? ?? ['AMBULANCE']),
    urgency:             json['urgency'] as String? ?? 'HIGH',
    suggestedActions:    List<String>.from(json['suggestedActions'] as List? ?? []),
    confidence:          (json['confidence'] as num?)?.toDouble() ?? 0.8,
    rawDescription:      json['rawDescription'] as String? ?? '',
  );
}
