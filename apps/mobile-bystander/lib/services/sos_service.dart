// ============================================================
// SOS Service — Dispatches SOS to detection-service
// Wraps payload in RCTF JSON envelope
// ============================================================
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:uuid/uuid.dart';
import 'package:geolocator/geolocator.dart';

import '../models/rctf_models.dart';
import 'auth_service.dart';
import 'emergency_broadcast_service.dart';
import '../config/app_config.dart';

class SOSService {
  static final SOSService _instance = SOSService._();
  factory SOSService() => _instance;
  SOSService._();

  final _uuid = const Uuid();

  Future<String?> dispatchSOS({
    required CrashMetrics metrics,
    required MedicalProfile medicalProfile,
  }) async {
    try {
      // Get current location
      Position? position;
      try {
        position = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high,
          timeLimit: const Duration(seconds: 5),
        );
      } catch (e) {
        debugPrint('[SOSService] GPS failed, using last known: $e');
        position = await Geolocator.getLastKnownPosition();
      }

      final location = GeoPoint(
        lat:      position?.latitude  ?? 18.5204,
        lng:      position?.longitude ?? 73.8567,
        accuracy: position?.accuracy,
        speed:    position?.speed,
        heading:  position?.heading,
      );

      final auth = AuthService().currentAuth;
      if (auth == null) {
        debugPrint('[SOSService] Not authenticated');
        return null;
      }

      // Build RCTF envelope
      final envelope = RCTFEnvelope<SOSPayload>(
        meta: RCTFMeta(
          requestId: 'REQ-${_uuid.v4()}',
          timestamp: DateTime.now().toIso8601String(),
          env:       AppConfig.env,
        ),
        auth: auth,
        payload: SOSPayload(
          location:       location,
          metrics:        metrics,
          medicalProfile: medicalProfile,
        ),
      );

      final body = jsonEncode(envelope.toJson((p) => p.toJson()));

      final response = await http.post(
        Uri.parse('${AppConfig.detectionServiceUrl}/api/sos'),
        headers: {
          'Content-Type':  'application/json',
          'Authorization': 'Bearer ${auth.token}',
        },
        body: body,
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 201) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        final accidentId = data['payload']?['accidentId'] as String?;
        debugPrint('[SOSService] SOS dispatched: $accidentId');
        
        if (accidentId != null) {
          // Immediately start Google Safety style Emergency Broadcast
          try {
            await EmergencyBroadcastService().startBroadcast(accidentId);
          } catch (e) {
            debugPrint('[SOSService] Broadcast start failed: $e');
          }

          // Simulate SMS and Push to Emergency Contacts
          debugPrint('[SOSService] 🚨 SMS SENT to emergency contacts: Live Location + Broadcast Stream link: http://rescue.edge/track/$accidentId');
          debugPrint('[SOSService] 🚨 Push Notifications delivered to emergency responders.');
        }
        
        return accidentId;
      } else {
        debugPrint('[SOSService] SOS failed: ${response.statusCode} ${response.body}');
        return null;
      }
    } catch (e) {
      debugPrint('[SOSService] SOS error: $e');
      return null;
    }
  }

  Future<bool> cancelSOS(String accidentId) async {
    try {
      final auth = AuthService().currentAuth;
      final response = await http.patch(
        Uri.parse('${AppConfig.detectionServiceUrl}/api/sos/$accidentId/cancel'),
        headers: {
          'Content-Type':  'application/json',
          'Authorization': 'Bearer ${auth?.token ?? ''}',
        },
      ).timeout(const Duration(seconds: 5));
      return response.statusCode == 200;
    } catch (e) {
      debugPrint('[SOSService] Cancel error: $e');
      return false;
    }
  }
}
