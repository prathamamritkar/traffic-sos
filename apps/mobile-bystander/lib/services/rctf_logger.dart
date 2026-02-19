import 'dart:convert';
import 'dart:io';
import 'package:path_provider/path_provider.dart';
import '../models/rctf_models.dart';

class RctfLogger {
  static final RctfLogger _instance = RctfLogger._internal();
  factory RctfLogger() => _instance;
  RctfLogger._internal();

  File? _logFile;

  Future<void> init() async {
    final dir = await getApplicationDocumentsDirectory();
    _logFile = File('${dir.path}/crash_events.log');
    if (!await _logFile!.exists()) {
      await _logFile!.create();
    }
  }

  Future<void> logEvent(String type, Map<String, dynamic> data) async {
    if (_logFile == null) await init();

    final logEntry = {
      'timestamp': DateTime.now().toIso8601String(),
      'type': type,
      'data': data,
    };

    try {
      await _logFile!.writeAsString(
        '${jsonEncode(logEntry)}\n',
        mode: FileMode.append,
        flush: true,
      );
    } catch (e) {
      print('Failed to write log: $e');
    }
  }

  Future<List<Map<String, dynamic>>> getLogs() async {
    if (_logFile == null) await init();
    try {
      final lines = await _logFile!.readAsLines();
      return lines.map((l) => jsonDecode(l) as Map<String, dynamic>).toList();
    } catch (e) {
      return [];
    }
  }

  Future<void> clearLogs() async {
    if (_logFile == null) await init();
    await _logFile!.writeAsString('');
  }
}
