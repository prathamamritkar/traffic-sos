// ============================================================
// Rescue Scene Guide Screen — Material 3 production redesign
// SOS Active: Countdown → Dispatch → Bystander handover mode
// ============================================================
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../config/app_theme.dart';
import '../../services/emergency_broadcast_service.dart';
import '../../services/rctf_logger.dart';

class RescueSceneGuideScreen extends StatefulWidget {
  const RescueSceneGuideScreen({super.key});

  @override
  State<RescueSceneGuideScreen> createState() => _RescueSceneGuideScreenState();
}

class _RescueSceneGuideScreenState extends State<RescueSceneGuideScreen>
    with TickerProviderStateMixin {
  static const _countdownSeconds = 10;

  int _remaining = _countdownSeconds;
  bool _dispatched = false;
  bool _cancelled = false;
  bool _isResponderMode = false;
  String? _accidentId;

  Timer? _timer;
  late AnimationController _pulseCtrl;
  late AnimationController _dispatchCtrl;

  @override
  void initState() {
    super.initState();

    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);

    _dispatchCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );

    _startCountdown();
  }

  void _startCountdown() {
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_cancelled || _dispatched) { timer.cancel(); return; }
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
    _dispatchCtrl.forward();
    _accidentId = "ACC-${DateTime.now().year}-${(1000 + (DateTime.now().millisecond))}";
  }

  void _cancel() {
    if (_cancelled || _dispatched) return;
    setState(() => _cancelled = true);
    _timer?.cancel();
    HapticFeedback.lightImpact();
    Navigator.of(context).pop();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _pulseCtrl.dispose();
    _dispatchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg0,
      body: SafeArea(
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 500),
          transitionBuilder: (child, anim) => FadeTransition(
            opacity: anim,
            child: SlideTransition(
              position: Tween<Offset>(begin: const Offset(0.05, 0), end: Offset.zero).animate(anim),
              child: child,
            ),
          ),
          child: _dispatched
              ? _DispatchedView(
                  key: const ValueKey('dispatched'),
                  accidentId: _accidentId ?? 'ACC-UNKNOWN',
                  isResponderMode: _isResponderMode,
                  pulseCtrl: _pulseCtrl,
                  onResponderTap: () => setState(() => _isResponderMode = true),
                )
              : _CountdownView(
                  key: const ValueKey('countdown'),
                  remaining: _remaining,
                  total: _countdownSeconds,
                  cancelled: _cancelled,
                  pulseCtrl: _pulseCtrl,
                  onCancel: _cancel,
                  onSosNow: _dispatchSOS,
                ),
        ),
      ),
    );
  }
}

// ── Countdown View ──────────────────────────────────────────

class _CountdownView extends StatelessWidget {
  final int remaining;
  final int total;
  final bool cancelled;
  final AnimationController pulseCtrl;
  final VoidCallback onCancel;
  final VoidCallback onSosNow;

  const _CountdownView({
    super.key,
    required this.remaining,
    required this.total,
    required this.cancelled,
    required this.pulseCtrl,
    required this.onCancel,
    required this.onSosNow,
  });

  @override
  Widget build(BuildContext context) {
    final progress = remaining / total;
    final isUrgent = remaining <= 3;

    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Notification chip
          Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
              decoration: BoxDecoration(
                color: AppColors.redSurface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.redCore.withOpacity(0.4)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  AnimatedBuilder(
                    animation: pulseCtrl,
                    builder: (_, __) => Container(
                      width: 7,
                      height: 7,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppColors.redBright.withOpacity(0.4 + pulseCtrl.value * 0.6),
                      ),
                    ),
                  ),
                  const SizedBox(width: 7),
                  Text(
                    'CRASH DETECTED',
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: AppColors.redBright,
                      letterSpacing: 0.8,
                    ),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 32),

          // Heading
          Text(
            'Are you okay?',
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(
              fontSize: 30,
              fontWeight: FontWeight.w900,
              color: AppColors.textPrimary,
              letterSpacing: -0.4,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            'A severe impact was detected. Emergency services\nwill be notified automatically.',
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(
              fontSize: 14,
              color: AppColors.textSecondary,
              height: 1.5,
            ),
          ),

          const Spacer(),

          // Countdown ring
          SizedBox(
            width: 200,
            height: 200,
            child: Stack(
              alignment: Alignment.center,
              children: [
                AnimatedBuilder(
                  animation: pulseCtrl,
                  builder: (_, __) => Container(
                    width: 200,
                    height: 200,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.redCore.withOpacity(0.04 + pulseCtrl.value * 0.06),
                    ),
                  ),
                ),
                SizedBox(
                  width: 188,
                  height: 188,
                  child: CircularProgressIndicator(
                    value: progress,
                    strokeWidth: 8,
                    strokeCap: StrokeCap.round,
                    backgroundColor: AppColors.bg4,
                    color: isUrgent ? AppColors.redBright : AppColors.redCore,
                  ),
                ),
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '$remaining',
                      style: GoogleFonts.inter(
                        fontSize: 68,
                        fontWeight: FontWeight.w900,
                        color: AppColors.textPrimary,
                        height: 1,
                      ),
                    ),
                    Text(
                      'sec',
                      style: GoogleFonts.inter(fontSize: 14, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const Spacer(),

          // Cancel button
          SizedBox(
            width: double.infinity,
            height: 60,
            child: FilledButton.tonal(
              onPressed: onCancel,
              style: FilledButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: const Color(0xFF0D1221),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.check_circle_outline_rounded, size: 22),
                  const SizedBox(width: 10),
                  Text(
                    "I'M SAFE — CANCEL SOS",
                    style: GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.w900),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 14),

          TextButton.icon(
            onPressed: onSosNow,
            icon: const Icon(Icons.sos_rounded, size: 16, color: AppColors.redBright),
            label: Text(
              'SEND SOS IMMEDIATELY',
              style: GoogleFonts.inter(
                fontSize: 13,
                color: AppColors.redBright,
                fontWeight: FontWeight.w700,
                decoration: TextDecoration.underline,
                decorationColor: AppColors.redBright,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Dispatched (Handover) View ──────────────────────────────

class _DispatchedView extends StatelessWidget {
  final String accidentId;
  final bool isResponderMode;
  final AnimationController pulseCtrl;
  final VoidCallback onResponderTap;

  const _DispatchedView({
    super.key,
    required this.accidentId,
    required this.isResponderMode,
    required this.pulseCtrl,
    required this.onResponderTap,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Status banner
          // SOS dispatched banner — safeGreen (calm confirmation, help is on the way)
          // arrivedGreen would be too bright here; the state is "dispatched", not yet "arrived"
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: AppColors.safeGreen.withOpacity(0.08),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.safeGreen.withOpacity(0.35)),
            ),
            child: Row(
              children: [
                AnimatedBuilder(
                  animation: pulseCtrl,
                  builder: (_, __) => Container(
                    width: 10, height: 10,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.safeGreen.withOpacity(0.4 + pulseCtrl.value * 0.6),
                      boxShadow: [BoxShadow(color: AppColors.safeGreen.withOpacity(0.5), blurRadius: 6)],
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Text(
                  'SOS DISPATCHED',
                  style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.safeGreen, letterSpacing: 0.5),
                ),
                const Spacer(),
                Text(
                  accidentId,
                  style: GoogleFonts.jetBrainsMono(fontSize: 10, color: AppColors.safeGreen, fontWeight: FontWeight.w600),
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),

          // ETA card
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.bg3,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.surfaceOutline),
            ),
            child: Row(
              children: [
                // aiBlue icon — ETA/ambulance info is analytical, not an alarm
                Container(
                  width: 48, height: 48,
                  decoration: BoxDecoration(
                    color: AppColors.aiBlue.withOpacity(0.12),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.local_taxi_rounded, color: AppColors.aiBlue, size: 26),
                ),
                const SizedBox(width: 14),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Ambulance Dispatched', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                    Text('Estimating arrival…', style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSecondary)),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),

          // Instructions title
          // warnAmber — bystander guide is an instructional warning (pay attention / act now)
          // Not a brand color, not an emergency, but demands attention → warnAmber is correct
          Row(
            children: [
              const Icon(Icons.info_outline_rounded, color: AppColors.warnAmber, size: 18),
              const SizedBox(width: 8),
              Text(
                'BYSTANDER GUIDE',
                style: GoogleFonts.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: AppColors.warnAmber,
                  letterSpacing: 1,
                ),
              ),
            ],
          ),

          const SizedBox(height: 16),

          _InstructionStep(
            step: 1,
            text: 'Stay with the victim. Keep them calm and do not move them unless immediate danger is present.',
            icon: Icons.person_pin_rounded,
          ),
          _InstructionStep(
            step: 2,
            text: 'Point the phone camera at the scene from ~45° angle to capture the full accident area.',
            icon: Icons.camera_enhance_outlined,
          ),
          _InstructionStep(
            step: 3,
            text: 'Keep the area clear for emergency responders. Direct bystanders to create a pathway.',
            icon: Icons.warning_amber_outlined,
          ),
          _InstructionStep(
            step: 4,
            text: 'If victim is conscious, check: name, pain level, and any visible injuries.',
            icon: Icons.medical_information_outlined,
          ),

          const SizedBox(height: 20),

          // AI processing card
          // aiBlue card — AI processing is informational/analytical, never alarming
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.aiBlue.withOpacity(0.06),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.aiBlue.withOpacity(0.2)),
            ),
            child: Row(
              children: [
                const Icon(Icons.auto_awesome_outlined, color: AppColors.aiBlue, size: 20),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'On-device vision & audio AI analyzing scene severity and triaging injuries…',
                    style: GoogleFonts.inter(fontSize: 12, color: AppColors.aiBlue, height: 1.4),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // Responder section
          isResponderMode
              ? _ResponderControls()
              : _ResponderEntryButton(onTap: onResponderTap),
        ],
      ),
    );
  }
}

class _InstructionStep extends StatelessWidget {
  final int step;
  final String text;
  final IconData icon;

  const _InstructionStep({required this.step, required this.text, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.bg3,
              shape: BoxShape.circle,
              border: Border.all(color: AppColors.surfaceOutline),
            ),
            child: Center(
              child: Text(
                '$step',
                style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 4),
                Row(
                  children: [
                    Icon(icon, size: 14, color: AppColors.textMuted),
                    const SizedBox(width: 4),
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  text,
                  style: GoogleFonts.inter(fontSize: 13, color: AppColors.textSecondary, height: 1.4),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ResponderEntryButton extends StatelessWidget {
  final VoidCallback onTap;
  const _ResponderEntryButton({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: OutlinedButton.icon(
        onPressed: onTap,
        icon: const Icon(Icons.badge_outlined, size: 18),
        label: Text(
          'Official Responder? Log in to Take Over',
          style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600),
        ),
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.textSecondary,
          side: const BorderSide(color: AppColors.surfaceOutline2),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      ),
    );
  }
}

class _ResponderControls extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        // Responder panel: safeGreen for confirmed active state (on-scene).
      // arrivedGreen is used for the CTA button specifically — that's the
      // high-salience confirmation action, warranting the brighter green.
      color: AppColors.safeGreen.withOpacity(0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.safeGreen.withOpacity(0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.badge_rounded, color: AppColors.safeGreen, size: 20),
              const SizedBox(width: 8),
              Text(
                'RESPONDER MODE ACTIVE',
                style: GoogleFonts.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: AppColors.safeGreen,
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () {},
                  icon: const Icon(Icons.check_circle_outline_rounded, size: 18),
                  label: const Text('Mark Arrived'),
                  style: ElevatedButton.styleFrom(
                    // arrivedGreen for the CTA — this IS the high-salience confirmation action
                    backgroundColor: AppColors.arrivedGreen,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 0,
                    minimumSize: const Size(0, 46),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () {},
                  icon: const Icon(Icons.medical_services_outlined, size: 18),
                  label: const Text('Vitals Log'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.safeGreen,
                    side: BorderSide(color: AppColors.safeGreen.withOpacity(0.4)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    minimumSize: const Size(0, 46),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
