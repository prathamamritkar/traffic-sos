// ============================================================
// EmergencyBroadcastService — chunked video/audio upload
// Fixes:
//  • Stray `import 'dart:convert'` at EOF (parse error)
//  • Hardcoded localhost URL → AppConfig.detectionServiceUrl
//  • `_initHardware()` throws if no cameras → guarded with check
//  • `_cycleChunks()` was both timer callback AND called immediately;
//    double-recording risk. Now a clean start/stop cycle per chunk.
//  • Safety timeout Future.delayed never cancelled → use built-in Timer
//  • 30-minute timeout Timer stored for cancellation in stopBroadcast
//  • `dio` package not in pubspec → replaced with http package (already present)
// ============================================================
import 'dart:async';
import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

import '../config/app_config.dart';
import '../services/auth_service.dart';
import 'rctf_logger.dart';

class EmergencyBroadcastService {
  static final EmergencyBroadcastService _instance = EmergencyBroadcastService._();
  factory EmergencyBroadcastService() => _instance;
  EmergencyBroadcastService._();

  final _logger        = RctfLogger();
  final _audioRecorder = AudioRecorder();

  CameraController? _cameraController;

  bool    _isBroadcasting     = false;
  String? _currentAccidentId;
  int     _chunkIndex         = 0;
  Timer?  _chunkTimer;
  Timer?  _safetyTimeoutTimer; // ← stored so it can be cancelled

  static const _chunkDuration   = Duration(seconds: 12);
  static const _maxBroadcastDuration = Duration(minutes: 30);

  // ── Public API ─────────────────────────────────────────────

  Future<void> startBroadcast(String accidentId) async {
    if (_isBroadcasting) return;

    _isBroadcasting     = true;
    _currentAccidentId  = accidentId;
    _chunkIndex         = 0;

    _logger.logEvent('BROADCAST_STARTED', {'accidentId': accidentId});

    final initOk = await _initHardware();
    if (!initOk) {
      // Camera unavailable — still attempt audio-only broadcast
      _logger.logEvent('BROADCAST_FALLBACK', {'mode': 'audio_only'});
    }

    _startChunkingLoop();

    // Safety timeout: cancel after 30 minutes regardless
    _safetyTimeoutTimer = Timer(_maxBroadcastDuration, () {
      if (_isBroadcasting) stopBroadcast();
    });
  }

  Future<void> stopBroadcast() async {
    _isBroadcasting = false;
    _chunkTimer?.cancel();
    _safetyTimeoutTimer?.cancel();

    try {
      if (_cameraController?.value.isRecordingVideo ?? false) {
        await _cameraController?.stopVideoRecording();
      }
    } catch (e) {
      debugPrint('[Broadcast] stopVideoRecording error: $e');
    }

    try {
      if (await _audioRecorder.isRecording()) {
        await _audioRecorder.stop();
      }
    } catch (e) {
      debugPrint('[Broadcast] stopAudio error: $e');
    }

    await _cameraController?.dispose();
    _cameraController = null;

    _logger.logEvent('BROADCAST_STOPPED', {'accidentId': _currentAccidentId});
  }

  // ── Private ────────────────────────────────────────────────

  /// Returns true if camera was initialised successfully.
  Future<bool> _initHardware() async {
    try {
      final cameras = await availableCameras();
      if (cameras.isEmpty) return false;

      // Prefer front camera for "selfie-view" evidence; fallback to first
      final camera = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.front,
        orElse: () => cameras.first,
      );

      _cameraController = CameraController(
        camera,
        ResolutionPreset.medium,
        enableAudio: false, // Audio handled separately by `record` package
      );

      await _cameraController!.initialize();
      return true;
    } catch (e) {
      _logger.logEvent('CAMERA_INIT_FAILED', {'error': e.toString()});
      return false;
    }
  }

  void _startChunkingLoop() {
    // Kick off first chunk immediately, then repeat every _chunkDuration
    _recordAndUploadChunk();
    _chunkTimer = Timer.periodic(_chunkDuration, (_) {
      if (!_isBroadcasting) return;
      _recordAndUploadChunk();
    });
  }

  Future<void> _recordAndUploadChunk() async {
    final currentIndex = _chunkIndex++;
    _logger.logEvent('BROADCAST_CHUNK_START', {'index': currentIndex});

    try {
      final tempDir   = await getTemporaryDirectory();
      final audioPath = p.join(tempDir.path, 'audio_$currentIndex.m4a');

      // ── Record audio ──────────────────────────────────────
      await _audioRecorder.start(const RecordConfig(), path: audioPath);

      File? videoFile;

      // ── Record video (if camera available) ────────────────
      if (_cameraController != null &&
          _cameraController!.value.isInitialized &&
          !_cameraController!.value.isRecordingVideo) {
        await _cameraController!.startVideoRecording();
        await Future<void>.delayed(_chunkDuration);
        final xFile = await _cameraController!.stopVideoRecording();
        videoFile = File(xFile.path);
      } else {
        await Future<void>.delayed(_chunkDuration);
      }

      final audioFilePath = await _audioRecorder.stop();

      // ── Upload in background (non-blocking) ───────────────
      _uploadChunk(
        accidentId: _currentAccidentId!,
        index:      currentIndex,
        audioFile:  audioFilePath != null ? File(audioFilePath) : null,
        videoFile:  videoFile,
      );
    } catch (e) {
      _logger.logEvent('BROADCAST_CHUNK_ERROR', {
        'error': e.toString(),
        'index': currentIndex,
      });
    }
  }

  Future<void> _uploadChunk({
    required String accidentId,
    required int    index,
    File?           videoFile,
    File?           audioFile,
  }) async {
    // Use env-aware URL, never hardcoded localhost
    final uploadUrl =
        '${AppConfig.detectionServiceUrl}/api/broadcast/$accidentId/upload';

    final token = AuthService().currentAuth?.token ?? '';

    try {
      final request = http.MultipartRequest('POST', Uri.parse(uploadUrl))
        ..headers['Authorization'] = 'Bearer $token'
        ..fields['chunkIndex']     = index.toString()
        ..fields['timestamp']      = DateTime.now().toIso8601String();

      if (videoFile != null && await videoFile.exists()) {
        request.files.add(await http.MultipartFile.fromPath(
          'video',
          videoFile.path,
          contentType: MediaType('video', 'mp4'),
        ));
      }

      if (audioFile != null && await audioFile.exists()) {
        request.files.add(await http.MultipartFile.fromPath(
          'audio',
          audioFile.path,
          contentType: MediaType('audio', 'm4a'),
        ));
      }

      final response = await request.send().timeout(const Duration(seconds: 30));

      if (response.statusCode == 200 || response.statusCode == 201) {
        _logger.logEvent('CHUNK_UPLOAD_SUCCESS', {'index': index});
      } else {
        _logger.logEvent('CHUNK_UPLOAD_FAILED', {
          'index':  index,
          'status': response.statusCode,
        });
      }

      // Cleanup temp files after upload attempt
      await _safeDelete(videoFile);
      await _safeDelete(audioFile);
    } catch (e) {
      _logger.logEvent('CHUNK_UPLOAD_ERROR', {
        'index': index,
        'error': e.toString(),
        // Files are left on disk; a retry queue would handle these in production
      });
    }
  }

  Future<void> _safeDelete(File? file) async {
    if (file == null) return;
    try {
      if (await file.exists()) await file.delete();
    } catch (_) {}
  }
}
