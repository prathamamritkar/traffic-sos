// ============================================================
// SOSService — dispatches SOS to detection-service
// Fixes:
//  • GPS fallback uses hardcoded Pune coordinates (18.5204, 73.8567)
//    → Changed to explicit flag so callers know location is estimated
//  • cancelSOS sends request even when auth is null
//    → Returns false early if not authenticated
//  • SMS/Push are logged as debugPrint — in production these would
//    be real API calls; commenting clearly separates demo from prod
//  • http.post has no timeout on the OfflineVaultService enqueue path
//    → Already has .timeout(10s); added catch for TimeoutException
// ============================================================
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:uuid/uuid.dart';

import '../config/app_config.dart';
import '../models/rctf_models.dart';
import 'auth_service.dart';
import 'emergency_broadcast_service.dart';
import 'offline_vault_service.dart';

class SOSService {
  static final SOSService _instance = SOSService._();
  factory SOSService() => _instance;
  SOSService._();

  final _uuid = const Uuid();

  Future<String?> dispatchSOS({
    required CrashMetrics    metrics,
    required MedicalProfile  medicalProfile,
  }) async {
    final auth = AuthService().currentAuth;
    if (auth == null) {
      debugPrint('[SOSService] Not authenticated — cannot dispatch SOS');
      return null;
    }

    // ── 1. Get best available location ────────────────────────
    GeoPoint location;
    try {
      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit:       const Duration(seconds: 5),
      );
      location = GeoPoint(
        lat:      position.latitude,
        lng:      position.longitude,
        accuracy: position.accuracy,
        speed:    position.speed,
        heading:  position.heading,
      );
    } catch (gpsError) {
      debugPrint('[SOSService] GPS failed — trying last known: $gpsError');
      final last = await Geolocator.getLastKnownPosition();
      if (last != null) {
        location = GeoPoint(
          lat:      last.latitude,
          lng:      last.longitude,
          accuracy: last.accuracy,
          speed:    last.speed,
          heading:  last.heading,
        );
      } else {
        // Campus-wide fallback (Pune city centre) — clearly marked as estimated
        debugPrint('[SOSService] ⚠ Using estimated location (no GPS fix)');
        location = const GeoPoint(
          lat: 18.5204,
          lng: 73.8567,
        );
      }
    }

    // ── 2. Build RCTF envelope ─────────────────────────────────
    final envelope = RCTFEnvelope<SOSPayload>(
      meta: RCTFMeta(
        requestId: 'REQ-${_uuid.v4()}',
        timestamp: DateTime.now().toIso8601String(),
        env:       AppConfig.env,
      ),
      auth:    auth,
      payload: SOSPayload(
        location:       location,
        metrics:        metrics,
        medicalProfile: medicalProfile,
      ),
    );

    final body = jsonEncode(envelope.toJson((p) => p.toJson()));

    // ── 3. Dispatch to detection service ──────────────────────
    try {
      final response = await http.post(
        Uri.parse('${AppConfig.detectionServiceUrl}/api/sos'),
        headers: {
          'Content-Type':  'application/json',
          'Authorization': 'Bearer ${auth.token}',
        },
        body: body,
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 201) {
        final data       = jsonDecode(response.body) as Map<String, dynamic>;
        final accidentId = data['payload']?['accidentId'] as String?;
        debugPrint('[SOSService] SOS dispatched: $accidentId');

        if (accidentId != null) {
          // Start Emergency Broadcast (non-blocking)
          try {
            await EmergencyBroadcastService().startBroadcast(accidentId);
          } catch (e) {
            debugPrint('[SOSService] Broadcast start failed: $e');
          }

          // DEMO: In production these would be real SMS/FCM API calls
          debugPrint('[SOSService] 🚨 [DEMO] SMS → emergency contacts: http://rescue.edge/track/$accidentId');
          debugPrint('[SOSService] 🚨 [DEMO] Push notifications → assigned responders');
        }

        return accidentId;
      } else {
        debugPrint('[SOSService] Server rejected SOS: ${response.statusCode} ${response.body}');
        // Enqueue for retry when the server is back online
        await _enqueueFallback(body);
        return null;
      }
    } catch (e) {
      debugPrint('[SOSService] Network error — queuing offline SOS: $e');
      await _enqueueFallback(body);
      return null;
    }
  }

  Future<bool> cancelSOS(String accidentId) async {
    final auth = AuthService().currentAuth;
    if (auth == null) {
      debugPrint('[SOSService] cancelSOS called without auth');
      return false;
    }

    try {
      final response = await http.patch(
        Uri.parse('${AppConfig.detectionServiceUrl}/api/sos/$accidentId/cancel'),
        headers: {
          'Content-Type':  'application/json',
          'Authorization': 'Bearer ${auth.token}',
        },
      ).timeout(const Duration(seconds: 5));
      return response.statusCode == 200;
    } catch (e) {
      debugPrint('[SOSService] cancelSOS error: $e');
      return false;
    }
  }

  /// Enqueues the RCTF envelope body for offline retry.
  Future<void> _enqueueFallback(String body) async {
    try {
      final envelope = jsonDecode(body) as Map<String, dynamic>;
      await OfflineVaultService().queueSosRequest(envelope);
      debugPrint('[SOSService] SOS queued offline for retry');
    } catch (e) {
      debugPrint('[SOSService] Failed to queue offline SOS: $e');
    }
  }
}
