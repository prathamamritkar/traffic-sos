import 'dart:async';
import 'dart:io';
import 'package:camera/camera.dart';
import 'package:dio/dio.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';
import 'package:uuid/uuid.dart';

import '../models/rctf_models.dart';
import 'rctf_logger.dart';

class EmergencyBroadcastService {
  static final EmergencyBroadcastService _instance = EmergencyBroadcastService._();
  factory EmergencyBroadcastService() => _instance;
  EmergencyBroadcastService._();

  final _logger = RctfLogger();
  final _uuid = const Uuid();
  final _dio = Dio();
  
  CameraController? _cameraController;
  final _audioRecorder = AudioRecorder();
  
  bool _isBroadcasting = false;
  String? _currentAccidentId;
  int _chunkIndex = 0;
  Timer? _chunkTimer;
  
  static const _chunkDuration = Duration(seconds: 12);
  static const _uploadBaseUrl = "http://localhost:3001/api/broadcast/upload"; // Detection service endpoint

  Future<void> startBroadcast(String accidentId) async {
    if (_isBroadcasting) return;
    _isBroadcasting = true;
    _currentAccidentId = accidentId;
    _chunkIndex = 0;

    _logger.logEvent('BROADCAST_STARTED', {'accidentId': accidentId});

    await _initHardware();
    _startChunkingLoop();

    // Safety timeout: 30 minutes max recording
    Future.delayed(const Duration(minutes: 30), () {
      if (_isBroadcasting) stopBroadcast();
    });
  }

  Future<void> _initHardware() async {
    final cameras = await availableCameras();
    // Prefer front camera for "selfie" context in accident, fallback to rear
    final camera = cameras.firstWhere(
      (c) => c.lensDirection == CameraLensDirection.front,
      orElse: () => cameras.first,
    );

    _cameraController = CameraController(
      camera,
      ResolutionPreset.medium,
      enableAudio: false, // We use 'record' for high-quality separate audio
    );

    await _cameraController!.initialize();
  }

  void _startChunkingLoop() {
    _chunkTimer = Timer.periodic(_chunkDuration, (timer) async {
      if (!_isBroadcasting) {
        timer.cancel();
        return;
      }
      _cycleChunks();
    });
    
    _cycleChunks(); // Start first chunk immediately
  }

  Future<void> _cycleChunks() async {
    final currentIndex = _chunkIndex++;
    _logger.logEvent('BROADCAST_CHUNK_START', {'index': currentIndex});

    try {
      // 1. Start Audio/Video Recording
      final tempDir = await getTemporaryDirectory();
      final videoPath = p.join(tempDir.path, 'video_$currentIndex.mp4');
      final audioPath = p.join(tempDir.path, 'audio_$currentIndex.m4a');

      // Start recording
      await Future.wait([
        _cameraController!.startVideoRecording(),
        _audioRecorder.start(const RecordConfig(), path: audioPath),
      ]);

      // 2. Wait for chunk duration
      await Future.delayed(_chunkDuration);

      // 3. Stop and get files
      final XFile videoFile = await _cameraController!.stopVideoRecording();
      final String? audioFilePath = await _audioRecorder.stop();

      // 4. Background Upload (Non-blocking)
      _uploadMediaChunk(
        accidentId: _currentAccidentId!,
        index: currentIndex,
        videoFile: File(videoFile.path),
        audioFile: audioFilePath != null ? File(audioFilePath) : null,
      );

    } catch (e) {
      _logger.logEvent('BROADCAST_ERROR', {'error': e.toString(), 'index': currentIndex});
    }
  }

  Future<void> _uploadMediaChunk({
    required String accidentId,
    required int index,
    required File videoFile,
    File? audioFile,
  }) async {
    final metadata = {
      'accidentId': accidentId,
      'chunkIndex': index,
      'timestamp': DateTime.now().toIso8601String(),
      'type': 'EMERGENCY_BROADCAST_CHUNK',
      'version': '1.0',
    };

    final formData = FormData.fromMap({
      'metadata': jsonEncode(metadata),
      'video': await MultipartFile.fromFile(videoFile.path, filename: 'video_$index.mp4'),
      if (audioFile != null)
        'audio': await MultipartFile.fromFile(audioFile.path, filename: 'audio_$index.m4a'),
    });

    try {
      await _dio.post(
        _uploadBaseUrl,
        data: formData,
        options: Options(headers: {'Content-Type': 'multipart/form-data'}),
      );
      _logger.logEvent('CHUNK_UPLOAD_SUCCESS', {'index': index});
      
      // Cleanup locally
      await videoFile.delete();
      await audioFile?.delete();
      
    } catch (e) {
      _logger.logEvent('CHUNK_UPLOAD_FAILED', {
        'index': index,
        'error': e.toString(),
        'status': 'offline_fallback_active'
      });
      // In a production app, we would move these files to a persistent retry queue
    }
  }

  Future<void> stopBroadcast() async {
    _isBroadcasting = false;
    _chunkTimer?.cancel();
    
    if (_cameraController?.value.isRecordingVideo ?? false) {
      await _cameraController?.stopVideoRecording();
    }
    if (await _audioRecorder.isRecording()) {
      await _audioRecorder.stop();
    }
    
    await _cameraController?.dispose();
    _cameraController = null;
    
    _logger.logEvent('BROADCAST_STOPPED', {'accidentId': _currentAccidentId});
  }
}

import 'dart:convert';
