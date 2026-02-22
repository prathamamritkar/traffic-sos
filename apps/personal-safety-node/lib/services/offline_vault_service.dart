// ============================================================
// OfflineVaultService — local medical and SOS data storage
// Fixes:
//  • getMedicalProfile: jsonDecode + fromJson had no error guard
//    → corrupt SharedPreferences entry crashes the app at startup
//  • getPendingRequests: malformed JSON entry throws on map → filtered
// ============================================================
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/rctf_models.dart';

/// Service for offline-first medical and safety data storage.
/// NOTE: SharedPreferences is NOT encrypted. Use FlutterSecureStorage
/// for sensitive data in a production deployment.
class OfflineVaultService {
  static final OfflineVaultService _instance = OfflineVaultService._();
  factory OfflineVaultService() => _instance;
  OfflineVaultService._();

  static const String _kMedicalKey    = 'rapidrescue_medical_profile';
  static const String _kContactsKey   = 'rapidrescue_emergency_contacts';
  static const String _kPendingSosKey = 'rapidrescue_pending_sos';

  // ── Medical Profile ────────────────────────────────────────

  Future<void> saveMedicalProfile(MedicalProfile profile) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kMedicalKey, jsonEncode(profile.toJson()));
  }

  Future<MedicalProfile?> getMedicalProfile() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final data  = prefs.getString(_kMedicalKey);
      if (data == null) return null;
      final json = jsonDecode(data) as Map<String, dynamic>;
      return MedicalProfile.fromJson(json);
    } catch (e) {
      // Corrupt storage — clear the bad entry and return null
      debugPrint('[OfflineVault] Corrupt medical profile — clearing: $e');
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_kMedicalKey);
      return null;
    }
  }

  // ── Offline SOS Queue ──────────────────────────────────────

  Future<void> queueSosRequest(Map<String, dynamic> rctfEnvelope) async {
    final prefs = await SharedPreferences.getInstance();
    final queue = prefs.getStringList(_kPendingSosKey) ?? [];
    queue.add(jsonEncode(rctfEnvelope));
    await prefs.setStringList(_kPendingSosKey, queue);
  }

  Future<List<Map<String, dynamic>>> getPendingRequests() async {
    final prefs = await SharedPreferences.getInstance();
    final queue = prefs.getStringList(_kPendingSosKey) ?? [];
    final result = <Map<String, dynamic>>[];
    for (final entry in queue) {
      try {
        result.add(jsonDecode(entry) as Map<String, dynamic>);
      } catch (e) {
        debugPrint('[OfflineVault] Skipping malformed pending SOS entry: $e');
      }
    }
    return result;
  }

  Future<void> clearPendingRequests() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kPendingSosKey);
  }

  /// Removes the contact list key (kept for API symmetry).
  Future<void> clearContacts() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kContactsKey);
  }
}
