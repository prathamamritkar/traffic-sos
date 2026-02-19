// ============================================================
// BackgroundDetectionService — Flutter background service
// Fixes:
//  • Class body contained top-level statements (not a valid class)
//    — the init code block was not inside any method, causing a parse error.
// ============================================================
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:flutter_background_service_android/flutter_background_service_android.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:permission_handler/permission_handler.dart';
import 'crash_engine.dart';
import 'rctf_logger.dart';

class BackgroundDetectionService {
  BackgroundDetectionService._(); // Prevent instantiation — all methods are static

  static const _channelId   = 'rescuedge_crash_detection';
  static const _channelName = 'RescuEdge Crash Protection';
  static const _notifId     = 888;

  /// Call this once from `main()` after `WidgetsFlutterBinding.ensureInitialized()`.
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

    await service.configure(
      androidConfiguration: AndroidConfiguration(
        onStart:                       onStart,
        autoStart:                     true,
        isForegroundMode:              true,
        notificationChannelId:         _channelId,
        notificationChannelName:       _channelName,
        initialNotificationTitle:      'RescuEdge Protection Active',
        initialNotificationContent:    'Monitoring for crashes in background',
        foregroundServiceNotificationId: _notifId,
      ),
      iosConfiguration: IosConfiguration(
        autoStart:    true,
        onForeground: onStart,
        onBackground: onIosBackground,
      ),
    );

    await service.startService();
    debugPrint('[BackgroundDetectionService] Started');
  }

  @pragma('vm:entry-point')
  static Future<bool> onIosBackground(ServiceInstance service) async {
    WidgetsFlutterBinding.ensureInitialized();
    DartPluginRegistrant.ensureInitialized();
    return true;
  }

  @pragma('vm:entry-point')
  static void onStart(ServiceInstance service) async {
    DartPluginRegistrant.ensureInitialized();

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
