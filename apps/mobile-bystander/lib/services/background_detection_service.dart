import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:flutter_background_service_android/flutter_background_service_android.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:permission_handler/permission_handler.dart';
import 'crash_detection_service.dart';
import 'rctf_logger.dart';

class BackgroundDetectionService {

    final service = FlutterBackgroundService();

    // Setup for Android
    if (Platform.isAndroid) {
      final flutterLocalNotificationsPlugin = FlutterLocalNotificationsPlugin();
      const AndroidNotificationChannel channel = AndroidNotificationChannel(
        'rescuedge_crash_detection',
        'RescuEdge Crash Protection',
        description: 'Persistent background crash monitoring',
        importance: Importance.max,
      );

      await flutterLocalNotificationsPlugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()?.createNotificationChannel(channel);

      // Check for battery optimization (Crucial for 100Hz background sensors)
      if (await Permission.ignoreBatteryOptimizations.isDenied) {
        await Permission.ignoreBatteryOptimizations.request();
      }
    }

    await service.configure(
      androidConfiguration: AndroidConfiguration(
        onStart: onStart,
        autoStart: true,
        isForegroundMode: true,
        notificationChannelId: 'rescuedge_crash_detection',
        initialNotificationTitle: 'RescuEdge Protection Active',
        initialNotificationContent: 'Monitoring for crashes in background',
        foregroundServiceNotificationId: 888,
        // Bystander shortcut
        notificationChannelName: 'RescuEdge Crash Protection',
      ),
      iosConfiguration: IosConfiguration(
        autoStart: true,
        onForeground: onStart,
        onBackground: onIosBackground,
      ),
    );

    await service.startService();
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
    logger.logEvent('SERVICE_STARTED', {'mode': service is AndroidServiceInstance ? 'android' : 'ios'});

    final engine = CrashDetectionEngine();
    await engine.init();
    engine.startMonitoring();

    engine.onPotentialCrash.listen((gForce) {
      service.invoke('crash_detected', {'gForce': gForce});
      
      if (service is AndroidServiceInstance) {
        service.setForegroundNotificationInfo(
          title: "🚨 CRASH DETECTED!",
          content: "Tap to open and confirm your safety.",
        );
      }
      
      logger.logEvent('CRASH_SIGNAL_SENT', {'gForce': gForce});
    });

    service.on('stop_service').listen((event) {
      engine.stopMonitoring();
      service.stopSelf();
    });
  }
}
