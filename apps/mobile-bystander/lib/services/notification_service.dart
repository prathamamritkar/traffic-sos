// Notification Service — FCM push notification handling
import 'package:flutter/foundation.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

class NotificationService {
  static final NotificationService _instance = NotificationService._();
  factory NotificationService() => _instance;
  NotificationService._();

  final _messaging = FirebaseMessaging.instance;

  Future<void> initialize() async {
    try {
      await _messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        criticalAlert: true,
      );

      final token = await _messaging.getToken();
      debugPrint('[NotificationService] FCM Token: $token');

      // Handle foreground messages
      FirebaseMessaging.onMessage.listen(_handleMessage);

      // Handle background tap
      FirebaseMessaging.onMessageOpenedApp.listen(_handleMessage);
    } catch (e) {
      debugPrint('[NotificationService] Init error: $e');
    }
  }

  void _handleMessage(RemoteMessage message) {
    debugPrint('[NotificationService] Message: ${message.data}');
    // Navigate to SOS active screen if type is SOS_ALERT
    if (message.data['type'] == 'SOS_ALERT') {
      // Handled by app router
    }
  }

  Future<String?> getToken() async {
    try {
      return await _messaging.getToken();
    } catch (_) { return null; }
  }
}
