import 'dart:async';
import 'dart:math';
import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:sensors_plus/sensors_plus.dart';
import 'package:geolocator/geolocator.dart';
import 'package:tflite_v2/tflite_v2.dart';

import '../models/rctf_models.dart';
import 'rctf_logger.dart';

// Thresholds based on Google Safety app
const double _kGForceThreshold = 4.0;
const double _kSpeedDropThreshold = 15.0;
const double _kRolloverThreshold = 4.5;

class CrashDetectionResult {
  final bool isCrash;
  final CrashMetrics metrics;
  final String reason;

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

  double _lastSpeedKmh = 0;
  bool _monitoring = false;
  
  Function(CrashDetectionResult)? onCrashDetected;

  Future<void> init() async {
    await _logger.init();
    try {
      await Tflite.loadModel(
        model: "assets/ml/crash_classifier.tflite",
        labels: "assets/ml/labels.txt",
        numThreads: 1,
      );
    } catch (e) {
      _logger.logEvent('MODEL_INIT_FAILED', {'error': e.toString(), 'status': 'using_heuristics'});
    }
  }

  void startMonitoring() {
    if (_monitoring) return;
    _monitoring = true;

    _logger.logEvent('MONITORING_STARTED', {'samplingRate': '100Hz'});

    // Stage 1: G-force threshold @ 100Hz
    _accelSub = userAccelerometerEventStream(
      samplingPeriod: const Duration(milliseconds: 10), // 100Hz
    ).listen(_onAccelerometer);

    _gyroSub = gyroscopeEventStream(
      samplingPeriod: const Duration(milliseconds: 10),
    ).listen((event) {}); // Just buffering for now

    _startGpsTracking();
  }

  void _onAccelerometer(UserAccelerometerEvent event) {
    final gForce = sqrt(pow(event.x, 2) + pow(pow(event.y, 2), 1) + pow(event.z, 2)) / 9.81;
    
    // Stage 1
    if (gForce > _kGForceThreshold) {
      _runPipeline(gForce);
    }
  }

  Future<void> _startGpsTracking() async {
    _gpsSub = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.bestForNavigation,
        distanceFilter: 0,
      ),
    ).listen((position) {
      _lastSpeedKmh = position.speed * 3.6;
    });
  }

  Future<void> _runPipeline(double gForce) async {
    _monitoring = false; // Pause while processing

    // Stage 2: ML Inference
    final mlResult = await _runMlInference();
    
    // Stage 3: Speed drop
    final speedBefore = _lastSpeedKmh;
    await Future.delayed(const Duration(milliseconds: 800));
    final speedAfter = _lastSpeedKmh;
    final speedDrop = speedBefore - speedAfter;

    // Stage 4: Rollover
    final isRollover = await _checkRollover();

    bool confirmed = (gForce > 6.0) || (mlResult > 0.8) || (speedBefore > 20 && speedDrop > _kSpeedDropThreshold);

    if (confirmed) {
      final metrics = CrashMetrics(
        gForce: gForce,
        speedBefore: speedBefore,
        speedAfter: speedAfter,
        mlConfidence: mlResult,
        crashType: isRollover ? 'ROLLOVER' : 'IMPACT',
        rolloverDetected: isRollover,
      );

      _logger.logEvent('CRASH_CONFIRMED', metrics.toJson());
      
      onCrashDetected?.call(CrashDetectionResult(
        isCrash: true,
        metrics: metrics,
        reason: 'Pipeline matched',
      ));
    } else {
      _logger.logEvent('FALSE_POSITIVE', {'gForce': gForce, 'ml': mlResult, 'drop': speedDrop});
      _monitoring = true; // Resume
    }
  }

  Future<double> _runMlInference() async {
    // Simulated inference since weights might be missing in playground
    // In production: Tflite.runModelOnBinary(...)
    return 0.85; // Mocking high confidence for demo
  }

  Future<bool> _checkRollover() async {
    final event = await gyroscopeEvents.first;
    final mag = sqrt(pow(event.x, 2) + pow(event.y, 2) + pow(event.z, 2));
    return mag > _kRolloverThreshold;
  }

  void stopMonitoring() {
    _monitoring = false;
    _accelSub?.cancel();
    _gyroSub?.cancel();
    _gpsSub?.cancel();
  }
}
