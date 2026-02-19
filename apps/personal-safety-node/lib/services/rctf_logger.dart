// ============================================================
// RctfLogger — append-only crash event log
// Fixes:
//  • `print()` replaced with `debugPrint()` (linting + production safety)
//  • getLogs() silently drops malformed lines instead of throwing
//  • Log file size is bounded: if > 5 MB, auto-rotate to fresh file
//    to prevent unbounded disk usage on long-lived installs
// ============================================================
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';

// Max log file size before rotation (5 MB)
const int _kMaxLogBytes = 5 * 1024 * 1024;

class RctfLogger {
  static final RctfLogger _instance = RctfLogger._internal();
  factory RctfLogger() => _instance;
  RctfLogger._internal();

  File? _logFile;

  Future<void> init() async {
    final dir = await getApplicationDocumentsDirectory();
    _logFile = File('${dir.path}/crash_events.log');
    if (!await _logFile!.exists()) {
      await _logFile!.create(recursive: true);
    }
  }

  Future<void> logEvent(String type, Map<String, dynamic> data) async {
    if (_logFile == null) await init();

    // Auto-rotate if the log file exceeds the size limit
    await _rotateIfNeeded();

    final logEntry = {
      'timestamp': DateTime.now().toIso8601String(),
      'type':      type,
      'data':      data,
    };

    try {
      await _logFile!.writeAsString(
        '${jsonEncode(logEntry)}\n',
        mode:  FileMode.append,
        flush: true,
      );
    } catch (e) {
      debugPrint('[RctfLogger] Failed to write log: $e');
    }
  }

  Future<List<Map<String, dynamic>>> getLogs() async {
    if (_logFile == null) await init();
    try {
      final lines = await _logFile!.readAsLines();
      final result = <Map<String, dynamic>>[];
      for (final line in lines) {
        if (line.trim().isEmpty) continue;
        try {
          result.add(jsonDecode(line) as Map<String, dynamic>);
        } catch (_) {
          // Skip malformed lines instead of crashing the whole read
        }
      }
      return result;
    } catch (e) {
      debugPrint('[RctfLogger] Failed to read logs: $e');
      return [];
    }
  }

  Future<void> clearLogs() async {
    if (_logFile == null) await init();
    try {
      await _logFile!.writeAsString('', flush: true);
    } catch (e) {
      debugPrint('[RctfLogger] Failed to clear logs: $e');
    }
  }

  Future<void> _rotateIfNeeded() async {
    try {
      if (_logFile == null) return;
      final stat = await _logFile!.stat();
      if (stat.size > _kMaxLogBytes) {
        // Rename current log to archive and start fresh
        final archivePath = _logFile!.path.replaceFirst('.log', '_archive.log');
        await _logFile!.rename(archivePath);
        _logFile = File(_logFile!.path);
        await _logFile!.create();
        debugPrint('[RctfLogger] Log rotated (was > 5 MB)');
      }
    } catch (_) {}
  }
}
