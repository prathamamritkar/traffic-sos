// ============================================================
// CrashDetectionService — Façade for CrashDetectionEngine
// Updates:
//  • Now delegates all detection logic to the improved CrashDetectionEngine
//  • Bridges Engine Stream -> Service Callback for UI
//  • Maintains existing public API for UI compatibility
// ============================================================
import 'dart:async';

import 'package:flutter/foundation.dart';

import '../models/rctf_models.dart';
import 'rctf_logger.dart';
import 'crash_engine.dart'; // Import the improved engine

class CrashDetectionResult {
  final bool          isCrash;
  final CrashMetrics  metrics;
  final String        reason;

  const CrashDetectionResult({
    required this.isCrash,
    required this.metrics,
    required this.reason,
  });
}

class CrashDetectionService {
  static final CrashDetectionService _instance = CrashDetectionService._();
  factory CrashDetectionService() => _instance;
  CrashDetectionService._();

  final _logger = RctfLogger();
  final _engine = CrashDetectionEngine(); // The actual brain

  StreamSubscription? _engineSub;
  bool _monitoring = false;

  Function(CrashDetectionResult)? onCrashDetected;

  Future<void> init() async {
    await _logger.init();
    await _engine.init();
    debugPrint('[CrashDetectionService] Initialized with Multimodal Engine');
  }

  void startMonitoring() {
    if (_monitoring) return;
    _monitoring = true;

    _logger.logEvent('MONITORING_STARTED', {'mode': 'Multimodal'});
    
    // Start the engine
    _engine.startMonitoring();
    
    // Listen to engine output
    _engineSub = _engine.onPotentialCrash.listen((gForce) {
      _handleCrashEvent(gForce);
    });
  }

  void _handleCrashEvent(double gForce) {
    // If the engine emits an event, it has already passed:
    // 1. High G-Force Trigger
    // 2. TFLite Sensor Verification
    // 3. Audio Verification
    // 4. Rollover Check (optional)
    
    // We strictly trust the engine here.
    final metrics = CrashMetrics(
      gForce:            gForce,
      speedBefore:       0.0, // TODO: threaded from engine if needed
      speedAfter:        0.0,
      mlConfidence:      0.95, // High confidence because engine passed
      crashType:         'IMPACT',
      rolloverDetected:  false,
    );

    _logger.logEvent('CRASH_CONFIRMED', metrics.toJson());
    
    onCrashDetected?.call(CrashDetectionResult(
      isCrash: true,
      metrics: metrics,
      reason:  'Multimodal Pipeline Confirmed',
    ));
    
    // Auto-stop monitoring to prevent duplicate alerts
    stopMonitoring();
  }

  void stopMonitoring() {
    _monitoring = false;
    _engine.stopMonitoring();
    _engineSub?.cancel();
    _engineSub = null;
  }

  void simulateCrash() {
    // Demo Mode: Realistic accident scenario matching backend demo_accident.ts
    final demoMetrics = CrashMetrics(
      gForce:            9.2,                      // High G-force (auto-confirm)
      speedBefore:       45.0,                     // 45 km/h
      speedAfter:        0.0,                      // Came to abrupt stop
      mlConfidence:      0.98,                     // High ML confidence
      crashType:         'CONFIRMED_CRASH',        // Definitive crash type
      rolloverDetected:  true,                     // Rollover detected
      impactDirection:   'FRONT',                  // Front impact
    );

    _logger.logEvent('DEMO_CRASH_SIMULATED', demoMetrics.toJson());
    
    onCrashDetected?.call(CrashDetectionResult(
      isCrash: true,
      metrics: demoMetrics,
      reason: 'Demo Scenario: Multi-vehicle collision with rollover',
    ));
    
    // Auto-stop monitoring to prevent duplicate alerts
    stopMonitoring();
  }
  
  void dispose() {
    stopMonitoring();
    _engine.dispose();
  }
}

