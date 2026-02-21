import 'dart:async';
import 'dart:io';
import 'dart:typed_data';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:tflite_v2/tflite_v2.dart';

import 'sensor_buffer.dart';

class TfliteService {
  // Model configurations
  static const String _sensorModel  = 'assets/ml/crash_classifier.tflite';
  static const String _sensorLabels = 'assets/ml/labels.txt'; // Assuming labels: [normal, crash]
  
  // Future: Audio model (YAMNet or similar)
  // static const String _audioModel = 'assets/ml/audio_classifier.tflite';

  bool _isModelLoaded = false;
  final SensorBuffer _sensorBuffer;

  TfliteService({required int windowSize}) : _sensorBuffer = SensorBuffer(capacity: windowSize);

  Future<void> init() async {
    try {
      final res = await Tflite.loadModel(
        model:      _sensorModel,
        labels:     _sensorLabels,
        numThreads: 1, // Single thread for low power
        isAsset:    true,
      );
      _isModelLoaded = res == 'success';
      debugPrint('TfliteService: Model loaded? $_isModelLoaded');
    } catch (e) {
      debugPrint('TfliteService: Model load error: $e');
    }
  }

  void addSensorData(double x, double y, double z) {
    _sensorBuffer.add(x, y, z);
  }

  /// Runs TFLite inference on the buffered sensor window.
  Future<Map<String, dynamic>> inferCrashFromSensors() async {
    if (!_isModelLoaded) {
      // Fallback: simple threshold if model failed to load
      // Note: In real production, this should retry loading
      return {'isCrash': false, 'confidence': 0.0};
    }

    try {
      // Get buffer as Byte List (Uint8List) required by tflite_v2
      // Using Float32 underlying buffer converted to bytes
      // Model input assumed to be: [1, 50, 3] float32
      final inputBytes = _sensorBuffer.getBufferAsUint8List();

      final recognitions = await Tflite.runModelOnBinary(
        binary:     inputBytes,
        numResults: 2,   // typically "normal", "crash"
        threshold:  0.5, // low threshold to capture potential events
        asynch:     true,
      );

      if (recognitions == null || recognitions.isEmpty) {
        return {'isCrash': false, 'confidence': 0.0};
      }

      // Check first result
      final topResult = recognitions[0];
      final label = topResult['label'] as String;
      final confidence = (topResult['confidence'] as num).toDouble();

      final isCrash = label == 'crash' && confidence > 0.7; // High confidence needed

      return {
        'isCrash': isCrash,
        'confidence': confidence,
        'label': label,
      };
    } catch (e) {
      debugPrint('TfliteService: Inference error: $e');
      return {'isCrash': false, 'confidence': 0.0};
    }
  }

  /// Analyzes audio chunk for crash signatures (screech, glass break, impact).
  /// Currently uses heuristic (amplitude) as placeholder for heavy ML model.
  Future<double> analyzeAudioBuffer(List<double> audioData) async {
    // PLACEHOLDER for Audio Classification TFLite Model
    // Real implementation:
    // 1. Convert audio to Spectrogram / MFCCs
    // 2. Run Tflite.runModelOnBinary over the spectrogram
    // 3. Return confidence of 'crash' class

    // Heuristic: Check for sudden high amplitude (loud noise)
    if (audioData.isEmpty) return 0.0;
    
    double maxAmp = 0.0;
    for (var sample in audioData) {
      if (sample.abs() > maxAmp) maxAmp = sample.abs();
    }
    
    // Normalize to 0-1 range (assuming 16-bit PCM input normalized to -1.0 to 1.0)
    // If input is raw bytes, conversion is needed first.
    // Here we assume normalized float input.
    return (maxAmp > 0.8) ? 0.9 : 0.1; 
  }

  void dispose() {
    Tflite.close();
  }
}
