// Splash Screen
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/auth_service.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200));
    _fadeAnim   = CurvedAnimation(parent: _controller, curve: Curves.easeOut);
    _controller.forward();
    _navigate();
  }

  Future<void> _navigate() async {
    await Future.delayed(const Duration(seconds: 2));
    final auth = await AuthService().restoreSession();
    if (!mounted) return;
    if (auth != null) {
      Navigator.pushReplacementNamed(context, '/home');
    } else {
      Navigator.pushReplacementNamed(context, '/auth');
    }
  }

  @override
  void dispose() { _controller.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0E1A),
      body: FadeTransition(
        opacity: _fadeAnim,
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 100, height: 100,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFFEF4444).withOpacity(0.15),
                  border: Border.all(color: const Color(0xFFEF4444).withOpacity(0.4), width: 2),
                ),
                child: const Center(child: Text('🚑', style: TextStyle(fontSize: 48))),
              ),
              const SizedBox(height: 24),
              Text('RescuEdge', style: GoogleFonts.inter(fontSize: 32, fontWeight: FontWeight.w900, color: Colors.white)),
              Text('ADGC — Accident Detection & Green Corridor', style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF94A3B8))),
              const SizedBox(height: 48),
              const CircularProgressIndicator(color: Color(0xFFEF4444), strokeWidth: 2),
            ],
          ),
        ),
      ),
    );
  }
}
