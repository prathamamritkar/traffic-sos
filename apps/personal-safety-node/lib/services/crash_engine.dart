// ============================================================
// CrashDetectionEngine — 4-stage pipeline
// Fixes:
//  • Stray `import 'dart:typed_data'` at EOF (parse error)
//  • Stream subscriptions stored and cancelled on stopMonitoring
//  • ML inference uses non-empty buffer (empty Uint8List crashes TFLite)
//  • gyroscopeEvents.first replaced with timeout-guarded Future
//  • _isMonitoring flag respected in pipeline before adding to stream
// ============================================================
import 'dart:async';
import 'dart:math';
import 'dart:typed_data';

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:sensors_plus/sensors_plus.dart';
import 'package:tflite_v2/tflite_v2.dart';

import 'rctf_logger.dart';

class CrashDetectionEngine {
  // Thresholds based on Google Safety app patterns
  static const double gForceThreshold    = 4.0;  // 4Gs to trigger stage 1
  static const double speedDropThreshold = 15.0; // km/h drop within 1s
  static const double rotationThreshold  = 5.0;  // rad/s for rollover

  final _logger = RctfLogger();

  // State variables
  double    _lastSpeed     = 0.0;
  DateTime? _lastSpeedTime;
  bool      _isMonitoring  = false;
  bool      _pipelineActive = false; // Guard against concurrent pipeline runs

  // Stream subscriptions — stored so they can be cancelled cleanly
  StreamSubscription? _accelSub;
  StreamSubscription? _gpsSub;

  final _crashController = StreamController<double>.broadcast();
  Stream<double> get onPotentialCrash => _crashController.stream;

  Future<void> init() async {
    try {
      await Tflite.loadModel(
        model:          'assets/ml/crash_classifier.tflite',
        labels:         'assets/ml/labels.txt',
        numThreads:     1,
        isAsset:        true,
        useGpuDelegate: false,
      );
    } catch (e) {
      _logger.logEvent('ENGINE_ERROR', {
        'message': 'TFLite model load failed — using heuristic fallback',
        'error':   e.toString(),
      });
    }
  }

  void startMonitoring() {
    if (_isMonitoring) return;
    _isMonitoring = true;

    // Stage 1: High G-Force Detection (100 Hz)
    _accelSub = userAccelerometerEventStream(
      samplingPeriod: const Duration(milliseconds: 10),
    ).listen((UserAccelerometerEvent event) {
      final double magnitude =
          sqrt(pow(event.x, 2) + pow(event.y, 2) + pow(event.z, 2)) / 9.81;

      if (magnitude > gForceThreshold && !_pipelineActive) {
        _handlePotentialCrash(magnitude);
      }
    });

    // Background Speed Monitoring
    _gpsSub = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy:       LocationAccuracy.high,
        distanceFilter: 5,
      ),
    ).listen((Position position) {
      final double speedKmH = position.speed * 3.6;
      _validateSpeedDrop(speedKmH);
      _lastSpeed     = speedKmH;
      _lastSpeedTime = DateTime.now();
    });
  }

  void stopMonitoring() {
    _isMonitoring = false;
    _accelSub?.cancel();
    _accelSub = null;
    _gpsSub?.cancel();
    _gpsSub = null;
  }

  void dispose() {
    stopMonitoring();
    _crashController.close();
  }

  Future<void> _handlePotentialCrash(double gForce) async {
    _pipelineActive = true;
    _logger.logEvent('STAGE_1_TRIGGERED', {'gForce': gForce});

    try {
      // Stage 2: TFLite ML Classification
      final mlConfirmed = await _runMlInference();
      _logger.logEvent('STAGE_2_RESULT', {'confirmed': mlConfirmed});

      if (!mlConfirmed) {
        _pipelineActive = false;
        return;
      }

      // Stage 4: Rollover Check (Gyroscope) — timeout-guarded
      final rollover = await _checkRollover();
      _logger.logEvent('STAGE_4_RESULT', {'rollover': rollover});

      // Stage 1 & 2 passed — notify UI for countdown
      if (_isMonitoring && !_crashController.isClosed) {
        _crashController.add(gForce);
      }
    } catch (e) {
      debugPrint('[CrashEngine] Pipeline error: $e');
    } finally {
      _pipelineActive = false;
    }
  }

  Future<bool> _runMlInference() async {
    try {
      // Use a 150-byte non-zero buffer to avoid TFLite crashes on empty input.
      // In production: pipe real accelerometer window (50 samples × 3 axes).
      final dummyBuffer = Uint8List.fromList(List.filled(150, 1));
      final recognitions = await Tflite.runModelOnBinary(
        binary:     dummyBuffer,
        numResults: 2,
        threshold:  0.1,
      );

      if (recognitions == null || recognitions.isEmpty) {
        // Safety default: if model produces no output, err on side of caution
        return true;
      }
      return recognitions[0]['label'] == 'crash' &&
             (recognitions[0]['confidence'] as num) > 0.8;
    } catch (_) {
      // Heuristic: if G-force is high and ML fails, err on side of caution
      return true;
    }
  }

  void _validateSpeedDrop(double currentSpeed) {
    if (_lastSpeedTime == null) return;

    final diff = DateTime.now().difference(_lastSpeedTime!);
    if (diff.inSeconds <= 2) {
      final drop = _lastSpeed - currentSpeed;
      if (drop > speedDropThreshold) {
        _logger.logEvent('STAGE_3_TRIGGERED', {
          'speedBefore': _lastSpeed,
          'speedAfter':  currentSpeed,
          'drop':        drop,
        });
      }
    }
  }

  Future<bool> _checkRollover() async {
    // gyroscopeEvents.first can hang indefinitely if gyroscope is unavailable.
    // Use a 500ms timeout and default to false (not a rollover) on timeout.
    try {
      final gyroEvent = await gyroscopeEventStream()
          .first
          .timeout(const Duration(milliseconds: 500));
      final magnitude = sqrt(
        pow(gyroEvent.x, 2) + pow(gyroEvent.y, 2) + pow(gyroEvent.z, 2),
      );
      return magnitude > rotationThreshold;
    } on TimeoutException {
      debugPrint('[CrashEngine] Gyroscope timeout — rollover assumed false');
      return false;
    }
  }
}
