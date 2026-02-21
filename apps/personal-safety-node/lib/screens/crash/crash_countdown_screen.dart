// ============================================================
// Crash Countdown Screen — Material 3 production redesign
// High-urgency, accessible full-screen emergency modal
// ============================================================
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:vibration/vibration.dart';
import 'package:audioplayers/audioplayers.dart';

import '../../config/app_theme.dart';
import '../../services/rctf_logger.dart';

class CrashCountdownScreen extends StatefulWidget {
  final double gForce;

  const CrashCountdownScreen({super.key, required this.gForce});

  @override
  State<CrashCountdownScreen> createState() => _CrashCountdownScreenState();
}

class _CrashCountdownScreenState extends State<CrashCountdownScreen>
    with TickerProviderStateMixin {
  static const _total = 15;
  int _secondsLeft = _total;
  Timer? _timer;
  bool _cancelled = false;

  final AudioPlayer _audio = AudioPlayer();
  final _logger = RctfLogger();

  late AnimationController _pulseCtrl;
  late AnimationController _warningCtrl;
  late Animation<double> _pulseScale;
  late Animation<Color?> _bgColor;

  @override
  void initState() {
    super.initState();

    _pulseCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))
      ..repeat(reverse: true);
    _warningCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 600))
      ..repeat(reverse: true);

    _pulseScale = Tween<double>(begin: 1.0, end: 1.08)
        .animate(CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut));

    _bgColor = ColorTween(
      begin: AppColors.bg1,
      end: const Color(0xFF1A0505),
    ).animate(CurvedAnimation(parent: _warningCtrl, curve: Curves.easeInOut));

    _startCountdown();
    _triggerAlerts();
    _logger.logEvent('COUNTDOWN_SHOWN', {'gForce': widget.gForce});
  }

  void _triggerAlerts() async {
    try {
      await _audio.play(AssetSource('sounds/emergency_alarm.mp3'));
      _audio.setReleaseMode(ReleaseMode.loop);
    } catch (_) {}

    if (await Vibration.hasVibrator() ?? false) {
      Vibration.vibrate(pattern: [0, 600, 200, 600, 200, 600]);
    }
    HapticFeedback.heavyImpact();
  }

  void _startCountdown() {
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_cancelled) { timer.cancel(); return; }
      if (_secondsLeft > 0) {
        setState(() => _secondsLeft--);
        if (_secondsLeft <= 5) HapticFeedback.heavyImpact();
      } else {
        timer.cancel();
        _triggerSOS();
      }
    });
  }

  void _cancelAlert() async {
    if (_cancelled) return;
    _cancelled = true;
    _timer?.cancel();
    await _audio.stop();
    Vibration.cancel();
    _logger.logEvent('USER_CANCELLED_CRASH', {'secondsRemaining': _secondsLeft});
    if (mounted) {
      HapticFeedback.lightImpact();
      Navigator.of(context).pop();
    }
  }

  void _triggerSOS() async {
    await _audio.stop();
    Vibration.cancel();
    _logger.logEvent('SOS_AUTO_TRIGGERED', {'reason': 'countdown_reached_zero'});
    if (mounted) Navigator.of(context).pushReplacementNamed('/rescue-guide');
  }

  @override
  void dispose() {
    _timer?.cancel();
    _pulseCtrl.dispose();
    _warningCtrl.dispose();
    _audio.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final progress = _secondsLeft / _total;
    final isUrgent = _secondsLeft <= 5;

    return AnimatedBuilder(
      animation: _bgColor,
      builder: (_, child) => Scaffold(
        backgroundColor: _bgColor.value ?? AppColors.bg1,
        body: SafeArea(child: child!),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            const SizedBox(height: 48),

            // ── Warning icon ────────────────────────────────
            ScaleTransition(
              scale: _pulseScale,
              child: Container(
                width: 88,
                height: 88,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.redCore.withOpacity(0.15),
                  border: Border.all(color: AppColors.redCore.withOpacity(0.5), width: 2),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.redCore.withOpacity(isUrgent ? 0.5 : 0.25),
                      blurRadius: isUrgent ? 40 : 20,
                      spreadRadius: isUrgent ? 8 : 2,
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.warning_amber_rounded,
                  color: AppColors.redBright,
                  size: 44,
                ),
              )
                  .animate(onPlay: (c) => c.repeat())
                  .shimmer(delay: 0.ms, duration: 1800.ms, color: AppColors.redCore.withOpacity(0.3)),
            ),

            const SizedBox(height: 24),

            // ── Title ───────────────────────────────────────
            Text(
              'CRASH DETECTED',
              style: GoogleFonts.inter(
                fontSize: 26,
                fontWeight: FontWeight.w900,
                color: AppColors.redBright,
                letterSpacing: 1.5,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Severe impact detected (${widget.gForce.toStringAsFixed(1)}G)\nEmergency services will be alerted in:',
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(
                fontSize: 14,
                color: AppColors.textSecondary,
                height: 1.5,
              ),
            ),

            const Spacer(),

            // ── Countdown ring ──────────────────────────────
            SizedBox(
              width: 200,
              height: 200,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // Glow
                  AnimatedBuilder(
                    animation: _pulseScale,
                    builder: (_, __) => Container(
                      width: 200 * _pulseScale.value,
                      height: 200 * _pulseScale.value,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppColors.redCore.withOpacity(0.06 * _pulseScale.value),
                      ),
                    ),
                  ),
                  // Progress ring
                  SizedBox(
                    width: 190,
                    height: 190,
                    child: CircularProgressIndicator(
                      value: progress,
                      strokeWidth: 10,
                      strokeCap: StrokeCap.round,
                      backgroundColor: AppColors.bg4,
                      color: isUrgent ? AppColors.redBright : AppColors.redCore,
                    ),
                  ),
                  // Countdown number
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '$_secondsLeft',
                        style: GoogleFonts.inter(
                          fontSize: 72,
                          fontWeight: FontWeight.w900,
                          color: isUrgent ? AppColors.redBright : Colors.white,
                          height: 1,
                        ),
                      ),
                      Text(
                        'seconds',
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const Spacer(),

            // ── Cancel button ───────────────────────────────
            SizedBox(
              width: double.infinity,
              height: 62,
              child: FilledButton.tonal(
                onPressed: _cancelAlert,
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: const Color(0xFF0D1221),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
                  elevation: 0,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.check_circle_outline_rounded, size: 22),
                    const SizedBox(width: 10),
                    Text(
                      "I'M SAFE — CANCEL",
                      style: GoogleFonts.inter(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0.3,
                      ),
                    ),
                  ],
                ),
              ),
            ).animate().slideY(begin: 1.2, end: 0, delay: 300.ms, duration: 600.ms, curve: Curves.easeOut),

            const SizedBox(height: 14),

            // ── Manual SOS link ─────────────────────────────
            TextButton.icon(
              onPressed: _triggerSOS,
              icon: const Icon(Icons.sos_rounded, size: 16, color: AppColors.redBright),
              label: Text(
                'SEND SOS NOW (skip countdown)',
                style: GoogleFonts.inter(
                  fontSize: 12,
                  color: AppColors.redBright,
                  fontWeight: FontWeight.w600,
                  decoration: TextDecoration.underline,
                  decorationColor: AppColors.redBright,
                ),
              ),
            ),

            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}
