// Responder Splash Screen
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200))..forward();
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) Navigator.pushReplacementNamed(context, '/dashboard');
    });
  }

  @override
  void dispose() { _controller.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0E1A),
      body: FadeTransition(
        opacity: CurvedAnimation(parent: _controller, curve: Curves.easeOut),
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 100, height: 100,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFF3B82F6).withOpacity(0.15),
                  border: Border.all(color: const Color(0xFF3B82F6).withOpacity(0.4), width: 2),
                ),
                child: const Center(child: Text('🚑', style: TextStyle(fontSize: 48))),
              ),
              const SizedBox(height: 24),
              Text('RescuEdge', style: GoogleFonts.inter(fontSize: 32, fontWeight: FontWeight.w900, color: Colors.white)),
              Text('Responder Portal', style: GoogleFonts.inter(fontSize: 14, color: const Color(0xFF94A3B8))),
              const SizedBox(height: 48),
              const CircularProgressIndicator(color: Color(0xFF3B82F6), strokeWidth: 2),
            ],
          ),
        ),
      ),
    );
  }
}
