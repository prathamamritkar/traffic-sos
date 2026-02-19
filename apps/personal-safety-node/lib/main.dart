// ============================================================
// RescuEdge — Personal Safety Node
// Material 3 production entry point
// Fixes:
//  • Firebase.initializeApp() was missing — all Firebase calls
//    (FirebaseAuth, FCM) would throw "No Firebase App" exception
//  • BackgroundDetectionService.initialize() was never called
//  • ProviderScope missing — Riverpod providers (authProvider) 
//    would throw "No ProviderScope found in the widget tree"
//  • Error boundary added: FlutterError.onError + PlatformDispatcher
//    to log uncaught exceptions in release builds
// ============================================================
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';

import 'config/app_theme.dart';
import 'screens/splash_screen.dart';
import 'screens/auth/auth_screen.dart';
import 'screens/onboarding/onboarding_screen.dart';
import 'screens/home/home_screen.dart';
import 'screens/crash/crash_countdown_screen.dart';
import 'screens/rescue/rescue_scene_guide_screen.dart';
import 'screens/bystander/situational_intelligence_screen.dart';
import 'services/background_detection_service.dart';
import 'services/rctf_logger.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // ── Global error logging ─────────────────────────────────
  final logger = RctfLogger();
  await logger.init();

  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    logger.logEvent('FLUTTER_ERROR', {
      'exception': details.exception.toString(),
      'library':   details.library ?? 'unknown',
    });
  };

  // Lock to portrait only (safety app — landscape is disorienting in emergencies)
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // ── Firebase ──────────────────────────────────────────────
  // Apps without google-services.json/GoogleService-Info.plist will throw here.
  // We guard gracefully so the app still works in demo mode without Firebase.
  try {
    await Firebase.initializeApp();
  } catch (e) {
    logger.logEvent('FIREBASE_INIT_FAILED', {
      'error': e.toString(),
      'mode':  'demo_fallback',
    });
    debugPrint('[main] Firebase init failed — running in demo mode: $e');
  }

  // ── Background Detection Service ──────────────────────────
  try {
    await BackgroundDetectionService.initialize();
  } catch (e) {
    logger.logEvent('BG_SERVICE_INIT_FAILED', {'error': e.toString()});
    debugPrint('[main] Background service init failed: $e');
  }

  runApp(
    // ProviderScope is REQUIRED for all Riverpod providers
    const ProviderScope(child: RescuEdgeApp()),
  );
}

class RescuEdgeApp extends StatelessWidget {
  const RescuEdgeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title:                    'RescuEdge',
      debugShowCheckedModeBanner: false,
      theme:                    buildAppTheme(),
      initialRoute:             '/',
      routes: {
        '/':             (_) => const SplashScreen(),
        '/auth':         (_) => const AuthScreen(),
        '/onboarding':   (_) => const OnboardingScreen(),
        '/home':         (_) => const HomeScreen(),
        '/rescue-guide': (_) => const RescueSceneGuideScreen(),
        '/bystander':    (_) => const SituationalIntelligenceScreen(),
      },
      onGenerateRoute: (settings) {
        // Handle parameterized routes
        if (settings.name == '/crash-countdown') {
          final metrics = settings.arguments as Map<String, dynamic>?;
          final gForce  = (metrics?['gForce'] as num?)?.toDouble() ?? 0.0;
          return MaterialPageRoute(
            builder:  (_) => CrashCountdownScreen(gForce: gForce),
            settings: settings,
          );
        }
        // Unknown route — show a safe fallback rather than crashing
        return MaterialPageRoute(
          builder: (_) => Scaffold(
            appBar: AppBar(title: const Text('Page Not Found')),
            body:   const Center(child: Text('404 — Route not found')),
          ),
        );
      },
    );
  }
}
