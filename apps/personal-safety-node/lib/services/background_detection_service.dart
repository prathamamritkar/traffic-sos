// ============================================================
// BackgroundDetectionService — Flutter background service
// Fixes:
//  • Class body contained top-level statements (not a valid class)
//    — the init code block was not inside any method, causing a parse error.
// ============================================================
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:flutter_background_service_android/flutter_background_service_android.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:permission_handler/permission_handler.dart';
import 'crash_engine.dart';
import 'rctf_logger.dart';

@pragma('vm:entry-point')
class BackgroundDetectionService {
  BackgroundDetectionService._(); // Prevent instantiation — all methods are static

  static const _channelId   = 'rescuedge_crash_detection';
  static const _channelName = 'RescuEdge Crash Protection';
  static const _notifId     = 888;

  /// Call this once from `main()` after `WidgetsFlutterBinding.ensureInitialized()`.
  /// This gracefully handles startup failures in demo mode or when permissions are missing.
  static Future<void> initialize() async {
    final service = FlutterBackgroundService();

    if (Platform.isAndroid) {
      final flutterLocalNotificationsPlugin = FlutterLocalNotificationsPlugin();
      const channel = AndroidNotificationChannel(
        _channelId,
        _channelName,
        description: 'Persistent background crash monitoring',
        importance:  Importance.max,
      );

      await flutterLocalNotificationsPlugin
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(channel);

      // Request battery-optimization exemption (crucial for 100Hz background sensors)
      if (await Permission.ignoreBatteryOptimizations.isDenied) {
        await Permission.ignoreBatteryOptimizations.request();
      }
    }

    try {
      await service.configure(
        androidConfiguration: AndroidConfiguration(
          onStart:                       onStart,
          autoStart:                     false, // Don't auto-start — wait for user to grant permissions
          isForegroundMode:              true,
          notificationChannelId:         _channelId,
          initialNotificationTitle:      'RescuEdge Protection Active',
          initialNotificationContent:    'Monitoring for crashes in background',
          foregroundServiceNotificationId: _notifId,
        ),
        iosConfiguration: IosConfiguration(
          autoStart:    false, // Don't auto-start
          onForeground: onStart,
          onBackground: onIosBackground,
        ),
      );

      // Don't auto-start the service — let the app flow handle it after permissions
      // await service.startService();
      debugPrint('[BackgroundDetectionService] Configured (not auto-started)');
    } catch (e) {
      debugPrint('[BackgroundDetectionService] Configuration failed: $e');
      // Gracefully continue even if background service setup fails
    }
  }

  @pragma('vm:entry-point')
  static Future<bool> onIosBackground(ServiceInstance service) async {
    WidgetsFlutterBinding.ensureInitialized();
    // Note: Ensure plugins are initialized in main() before starting background service
    return true;
  }

  @pragma('vm:entry-point')
  static void onStart(ServiceInstance service) async {
    // Note: Ensure plugins are initialized in main() before starting background service

    final logger = RctfLogger();
    await logger.init();
    logger.logEvent('SERVICE_STARTED', {
      'mode': service is AndroidServiceInstance ? 'android' : 'ios',
    });

    final engine = CrashDetectionEngine();
    await engine.init();
    engine.startMonitoring();

    engine.onPotentialCrash.listen((gForce) {
      service.invoke('crash_detected', {'gForce': gForce});

      if (service is AndroidServiceInstance) {
        service.setForegroundNotificationInfo(
          title:   '🚨 CRASH DETECTED!',
          content: 'Tap to open and confirm your safety.',
        );
      }

      logger.logEvent('CRASH_SIGNAL_SENT', {'gForce': gForce});
    });

    service.on('stop_service').listen((_) {
      engine.stopMonitoring();
      engine.dispose();
      service.stopSelf();
    });
  }
}
