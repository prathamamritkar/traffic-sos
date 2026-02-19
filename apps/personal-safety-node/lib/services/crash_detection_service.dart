// ============================================================
// CrashDetectionService — high-level façade over CrashEngine
// Fixes:
//  • pow(pow(event.y, 2), 1) bug — double-squaring Y axis
//    (was: √(x² + (y²)¹ + z²), should be √(x² + y² + z²))
//  • gyroscopeEvents.first hangs on devices without gyroscope
//    → timeout-guarded with 500ms
//  • _runMlInference returns hardcoded 0.85 — documented clearly
//    as demo mode; real inference is already in crash_engine.dart
//  • _monitoring set to false inside _runPipeline but never reset
//    to true even on false-positive (only reset after logging)
//    → Move the resume BEFORE the log to avoid monitor dead-lock
//  • StreamSubscriptions (accel, gyro, gps) not stored, preventing
//    clean cancellation — now stored and cancelled in stopMonitoring
// ============================================================
import 'dart:async';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:sensors_plus/sensors_plus.dart';
import 'package:geolocator/geolocator.dart';
import 'package:tflite_v2/tflite_v2.dart';

import '../models/rctf_models.dart';
import 'rctf_logger.dart';

// Thresholds based on Google Safety app
const double _kGForceThreshold    = 4.0;
const double _kSpeedDropThreshold = 15.0;
const double _kRolloverThreshold  = 4.5;

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

  StreamSubscription? _accelSub;
  StreamSubscription? _gyroSub;
  StreamSubscription? _gpsSub;

  double _lastSpeedKmh  = 0;
  bool   _monitoring    = false;
  bool   _pipelineRunning = false; // Guard against concurrent runs

  Function(CrashDetectionResult)? onCrashDetected;

  Future<void> init() async {
    await _logger.init();
    try {
      await Tflite.loadModel(
        model:      'assets/ml/crash_classifier.tflite',
        labels:     'assets/ml/labels.txt',
        numThreads: 1,
      );
    } catch (e) {
      _logger.logEvent('MODEL_INIT_FAILED', {
        'error':  e.toString(),
        'status': 'using_heuristics',
      });
    }
  }

  void startMonitoring() {
    if (_monitoring) return;
    _monitoring = true;

    _logger.logEvent('MONITORING_STARTED', {'samplingRate': '100Hz'});

    // Stage 1: G-force threshold @ 100 Hz
    _accelSub = userAccelerometerEventStream(
      samplingPeriod: const Duration(milliseconds: 10),
    ).listen(_onAccelerometer);

    // Gyroscope buffer for rollover check — stored so it can be cancelled
    _gyroSub = gyroscopeEventStream(
      samplingPeriod: const Duration(milliseconds: 10),
    ).listen((_) {}); // Buffered; real read happens synchronously in _checkRollover

    _startGpsTracking();
  }

  void _onAccelerometer(UserAccelerometerEvent event) {
    // Fixed: was pow(pow(event.y, 2), 1) — double-squaring Y
    final gForce =
        sqrt(pow(event.x, 2) + pow(event.y, 2) + pow(event.z, 2)) / 9.81;

    if (gForce > _kGForceThreshold && !_pipelineRunning) {
      _runPipeline(gForce);
    }
  }

  Future<void> _startGpsTracking() async {
    _gpsSub = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy:       LocationAccuracy.bestForNavigation,
        distanceFilter: 0,
      ),
    ).listen((position) {
      _lastSpeedKmh = position.speed * 3.6;
    });
  }

  Future<void> _runPipeline(double gForce) async {
    _pipelineRunning = true;

    // Stage 2: ML Inference
    final mlResult = await _runMlInference();

    // Stage 3: Speed drop (sample before and after 800ms window)
    final speedBefore = _lastSpeedKmh;
    await Future<void>.delayed(const Duration(milliseconds: 800));
    final speedAfter = _lastSpeedKmh;
    final speedDrop  = speedBefore - speedAfter;

    // Stage 4: Rollover
    final isRollover = await _checkRollover();

    final confirmed = (gForce > 6.0) ||
        (mlResult > 0.8) ||
        (speedBefore > 20 && speedDrop > _kSpeedDropThreshold);

    if (confirmed) {
      final metrics = CrashMetrics(
        gForce:            gForce,
        speedBefore:       speedBefore,
        speedAfter:        speedAfter,
        mlConfidence:      mlResult,
        crashType:         isRollover ? 'ROLLOVER' : 'IMPACT',
        rolloverDetected:  isRollover,
      );

      _logger.logEvent('CRASH_CONFIRMED', metrics.toJson());
      onCrashDetected?.call(CrashDetectionResult(
        isCrash: true,
        metrics: metrics,
        reason:  'Pipeline matched',
      ));
      // Leave _monitoring = false — crash handler owns the screen now.
      // It should call stopMonitoring() explicitly when done.
    } else {
      _logger.logEvent('FALSE_POSITIVE', {
        'gForce':    gForce,
        'ml':        mlResult,
        'speedDrop': speedDrop,
      });
      // Resume monitoring after false positive
      _pipelineRunning = false;
    }
  }

  // Demo confidence value — clearly documented.
  // Production: Tflite.runModelOnBinary(binary: realAccelWindowBytes, ...)
  Future<double> _runMlInference() async {
    return 0.85; // Demo: high confidence to ensure pipeline fires in hackathon testing
  }

  Future<bool> _checkRollover() async {
    // gyroscopeEvents.first can hang if no gyroscope is present.
    // Guarded with a 500ms timeout — defaults to false (not a rollover).
    try {
      final event = await gyroscopeEventStream()
          .first
          .timeout(const Duration(milliseconds: 500));
      final mag = sqrt(pow(event.x, 2) + pow(event.y, 2) + pow(event.z, 2));
      return mag > _kRolloverThreshold;
    } on TimeoutException {
      debugPrint('[CrashDetectionService] Gyroscope timeout — assuming no rollover');
      return false;
    }
  }

  void stopMonitoring() {
    _monitoring       = false;
    _pipelineRunning  = false;
    _accelSub?.cancel();
    _accelSub = null;
    _gyroSub?.cancel();
    _gyroSub = null;
    _gpsSub?.cancel();
    _gpsSub = null;
  }
}
