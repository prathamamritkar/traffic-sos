// ============================================================
// SOS Active Screen — 15-second countdown with cancel button
// Shows after crash detection triggers
// ============================================================
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../models/rctf_models.dart';
import '../../services/sos_service.dart';
import '../../services/auth_service.dart';
import '../../services/emergency_broadcast_service.dart';

class SOSActiveScreen extends StatefulWidget {
  const SOSActiveScreen({super.key});

  @override
  State<SOSActiveScreen> createState() => _SOSActiveScreenState();
}

class _SOSActiveScreenState extends State<SOSActiveScreen>
    with TickerProviderStateMixin {
  static const _countdownSeconds = 15;

  int _remaining   = _countdownSeconds;
  bool _dispatched = false;
  bool _cancelled  = false;
  String? _accidentId;

  Timer? _timer;
  late AnimationController _pulseController;
  late AnimationController _progressController;

  @override
  void initState() {
    super.initState();

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    )..repeat(reverse: true);

    _progressController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: _countdownSeconds),
    )..forward();

    // Vibrate pattern for alert
    HapticFeedback.heavyImpact();

    _startCountdown();
  }

  void _startCountdown() {
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_cancelled || _dispatched) {
        timer.cancel();
        return;
      }

      setState(() => _remaining--);

      if (_remaining <= 0) {
        timer.cancel();
        _dispatchSOS();
      }
    });
  }

  Future<void> _dispatchSOS() async {
    if (_dispatched || _cancelled) return;
    setState(() => _dispatched = true);

    HapticFeedback.heavyImpact();

    // Get crash metrics from route arguments
    final args = ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
    final metrics = args?['metrics'] as CrashMetrics? ?? const CrashMetrics(
      gForce: 5.5,
      speedBefore: 60,
      speedAfter: 0,
      mlConfidence: 0.91,
      crashType: 'CONFIRMED_CRASH',
      rolloverDetected: false,
    );

    // Get medical profile from stored user data
    final medicalProfile = args?['medicalProfile'] as MedicalProfile? ?? const MedicalProfile(
      bloodGroup: 'O+',
      age: 25,
      gender: 'MALE',
      allergies: [],
      medications: [],
      conditions: [],
      emergencyContacts: [],
    );

    final accidentId = await SOSService().dispatchSOS(
      metrics:        metrics,
      medicalProfile: medicalProfile,
    );

    if (mounted) {
      setState(() => _accidentId = accidentId);
      if (accidentId != null) {
        // Navigate to tracking screen
        Future.delayed(const Duration(seconds: 2), () {
          if (mounted) {
            Navigator.pushReplacementNamed(
              context,
              '/home',
              arguments: {'accidentId': accidentId},
            );
          }
        });
      }
    }
  }

  Future<void> _cancel() async {
    setState(() => _cancelled = true);
    _timer?.cancel();
    HapticFeedback.mediumImpact();

    if (_accidentId != null) {
      await SOSService().cancelSOS(_accidentId!);
      await EmergencyBroadcastService().stopBroadcast();
    }

    if (mounted) Navigator.pop(context);
  }

  @override
  void dispose() {
    _timer?.cancel();
    _pulseController.dispose();
    _progressController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0E1A),
      body: SafeArea(
        child: Stack(
          children: [
            _dispatched ? _buildDispatched() : _buildCountdown(),
            
            // Emergency Recording Indicator Overlay (Google Safety Style)
            if (_dispatched && !_cancelled)
              Positioned(
                top: 20,
                right: 20,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.7),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: Colors.red.withOpacity(0.5)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(
                          color: Colors.red,
                          shape: BoxShape.circle,
                        ),
                      ).animate(onPlay: (c) => c.repeat()).fadeIn(duration: 500.ms).fadeOut(delay: 500.ms),
                      const SizedBox(width: 8),
                      const Text(
                        'Emergency Recording Active',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildCountdown() {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Pulsing SOS icon
          AnimatedBuilder(
            animation: _pulseController,
            builder: (_, __) => Container(
              width: 160,
              height: 160,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Color.lerp(
                  const Color(0xFFEF4444),
                  const Color(0xFFDC2626),
                  _pulseController.value,
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFEF4444).withOpacity(0.4 + _pulseController.value * 0.3),
                    blurRadius: 40 + _pulseController.value * 20,
                    spreadRadius: 10 + _pulseController.value * 10,
                  ),
                ],
              ),
              child: const Center(
                child: Text('🚨', style: TextStyle(fontSize: 64)),
              ),
            ),
          ),

          const SizedBox(height: 32),

          Text(
            'CRASH DETECTED',
            style: GoogleFonts.inter(
              fontSize: 28,
              fontWeight: FontWeight.w900,
              color: const Color(0xFFEF4444),
              letterSpacing: 2,
            ),
          ),

          const SizedBox(height: 8),

          Text(
            'SOS dispatching in',
            style: GoogleFonts.inter(
              fontSize: 16,
              color: const Color(0xFF94A3B8),
            ),
          ),

          const SizedBox(height: 24),

          // Countdown number
          Text(
            '$_remaining',
            style: GoogleFonts.inter(
              fontSize: 80,
              fontWeight: FontWeight.w900,
              color: Colors.white,
              height: 1,
            ),
          ),

          const SizedBox(height: 16),

          // Progress bar
          AnimatedBuilder(
            animation: _progressController,
            builder: (_, __) => LinearProgressIndicator(
              value: 1 - _progressController.value,
              backgroundColor: const Color(0xFF1E293B),
              valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFFEF4444)),
              minHeight: 6,
              borderRadius: BorderRadius.circular(3),
            ),
          ),

          const SizedBox(height: 48),

          // Cancel button
          SizedBox(
            width: double.infinity,
            height: 64,
            child: ElevatedButton(
              onPressed: _cancel,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1E293B),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                  side: const BorderSide(color: Color(0xFF334155)),
                ),
              ),
              child: Text(
                'I\'M OKAY — CANCEL',
                style: GoogleFonts.inter(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1,
                ),
              ),
            ),
          ),

          const SizedBox(height: 16),

          Text(
            'Emergency services will be notified automatically',
            style: GoogleFonts.inter(
              fontSize: 12,
              color: const Color(0xFF475569),
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildDispatched() {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Text('✅', style: TextStyle(fontSize: 80)),
          const SizedBox(height: 24),
          Text(
            'SOS DISPATCHED',
            style: GoogleFonts.inter(
              fontSize: 28,
              fontWeight: FontWeight.w900,
              color: const Color(0xFF22C55E),
              letterSpacing: 2,
            ),
          ),
          if (_accidentId != null) ...[
            const SizedBox(height: 12),
            Text(
              _accidentId!,
              style: GoogleFonts.jetBrainsMono(
                fontSize: 14,
                color: const Color(0xFF94A3B8),
              ),
            ),
          ],
          const SizedBox(height: 16),
          Text(
            'Emergency services have been notified.\nHelp is on the way.',
            style: GoogleFonts.inter(
              fontSize: 16,
              color: const Color(0xFF94A3B8),
              height: 1.5,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
