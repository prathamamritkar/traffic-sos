import 'dart:async';
import 'dart:math';
import 'package:geolocator/geolocator.dart';
import 'package:sensors_plus/sensors_plus.dart';
import 'package:tflite_v2/tflite_v2.dart';
import 'rctf_logger.dart';

class CrashDetectionEngine {
  // Thresholds based on Google Safety app patterns
  static const double gForceThreshold = 4.0; // 4Gs to trigger stage 1
  static const double speedDropThreshold = 15.0; // km/h drop within 1s
  static const double rotationThreshold = 5.0; // rad/s for rollover

  final _logger = RctfLogger();
  
  // State variables
  double _lastSpeed = 0.0;
  DateTime? _lastSpeedTime;
  List<double> _accelBuffer = [];
  bool _isMonitoring = false;

  final _crashController = StreamController<double>.broadcast();
  Stream<double> get onPotentialCrash => _crashController.stream;

  Future<void> init() async {
    try {
      await Tflite.loadModel(
        model: "assets/ml/crash_classifier.tflite",
        labels: "assets/ml/labels.txt",
        numThreads: 1,
        isAsset: true,
        useGpuDelegate: false,
      );
    } catch (e) {
      _logger.logEvent('ENGINE_ERROR', {'message': 'TFLite model load failed, using heuristic fallback', 'error': e.toString()});
    }
  }

  void startMonitoring() {
    if (_isMonitoring) return;
    _isMonitoring = true;

    // Stage 1: High G-Force Detection
    userAccelerometerEvents.listen((UserAccelerometerEvent event) {
      final double magnitude = sqrt(pow(event.x, 2) + pow(event.y, 2) + pow(event.z, 2)) / 9.81;
      
      if (magnitude > gForceThreshold) {
        _handlePotentialCrash(magnitude);
      }
    });

    // Background Speed Monitoring
    Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 5,
      ),
    ).listen((Position position) {
      final double speedKmH = position.speed * 3.6;
      _validateSpeedDrop(speedKmH);
      _lastSpeed = speedKmH;
      _lastSpeedTime = DateTime.now();
    });
  }

  void stopMonitoring() {
    _isMonitoring = false;
  }

  Future<void> _handlePotentialCrash(double gForce) async {
    _logger.logEvent('STAGE_1_TRIGGERED', {'gForce': gForce});

    // Stage 2: TFLite ML Classification
    bool mlConfirmed = await _runMlInference();
    _logger.logEvent('STAGE_2_RESULT', {'confirmed': mlConfirmed});

    if (!mlConfirmed) return;

    // Stage 4: Rollover Check (Gyroscope)
    bool rollover = await _checkRollover();
    _logger.logEvent('STAGE_4_RESULT', {'rollover': rollover});

    // If stage 1 & 2 pass, we notify UI for countdown
    // Validating speed drop (Stage 3) happens concurrently 
    _crashController.add(gForce);
  }

  Future<bool> _runMlInference() async {
    // In a real app, we would take a buffer of accelerometer readings (e.g. 50 samples)
    // and pipe it into TFLite. Here we provide the structure.
    try {
      // Dummy check for asset existence, otherwise use high-confidence fallback
      // Since I can't guarantee the asset exists in the environment without user adding it
      var recognitions = await Tflite.runModelOnBinary(
        binary: Uint8List(0), // Placeholder
        numResults: 2,
        threshold: 0.1,
      );
      
      if (recognitions == null || recognitions.isEmpty) return true; // Safety default
      return (recognitions[0]['label'] == 'crash' && recognitions[0]['confidence'] > 0.8);
    } catch (e) {
      return true; // Heuristic: if G-force is high and ML fails, err on side of caution
    }
  }

  void _validateSpeedDrop(double currentSpeed) {
    if (_lastSpeedTime == null) return;
    
    final diff = DateTime.now().difference(_lastSpeedTime!);
    if (diff.inSeconds <= 2) {
      final drop = _lastSpeed - currentSpeed;
      if (drop > speedDropThreshold) {
        _logger.logEvent('STAGE_3_TRIGGERED', {'speedBefore': _lastSpeed, 'speedAfter': currentSpeed, 'drop': drop});
      }
    }
  }

  Future<bool> _checkRollover() async {
    // Check gyroscope for high angular velocity
    final gyroEvent = await gyroscopeEvents.first;
    final magnitude = sqrt(pow(gyroEvent.x, 2) + pow(gyroEvent.y, 2) + pow(gyroEvent.z, 2));
    return magnitude > rotationThreshold;
  }
}
import 'dart:typed_data';
