// ============================================================
// Safety Check — Timer based SOS trigger
// ============================================================
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../config/app_theme.dart';
import '../../services/sos_service.dart';
import '../../services/offline_vault_service.dart';
import '../../models/rctf_models.dart';

class SafetyCheckScreen extends StatefulWidget {
  const SafetyCheckScreen({super.key});

  @override
  State<SafetyCheckScreen> createState() => _SafetyCheckScreenState();
}

class _SafetyCheckScreenState extends State<SafetyCheckScreen> with TickerProviderStateMixin {
  bool _active = false;
  int _durationMinutes = 15;
  int _remainingSeconds = 0;
  Timer? _timer;
  
  late AnimationController _pulseCtrl;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(vsync: this, duration: const Duration(seconds: 1))..repeat(reverse: true);
  }

  @override
  void dispose() {
    _timer?.cancel();
    _pulseCtrl.dispose();
    super.dispose();
  }

  void _startTimer() {
    setState(() {
      _active = true;
      _remainingSeconds = _durationMinutes * 60;
    });

    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      setState(() {
        if (_remainingSeconds > 0) {
          _remainingSeconds--;
        } else {
          _timer?.cancel();
          _triggerSOS();
        }
      });
    });
  }

  void _cancelTimer() {
    _timer?.cancel();
    setState(() {
      _active = false;
    });
  }

  Future<void> _triggerSOS() async {
    // 1. Get medical profile
    final profile = await OfflineVaultService().getMedicalProfile();
    if (profile == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Profile not set up! Cannot send SOS.')),
        );
      }
      return;
    }

    // 2. Create Safety Check Payload
    // using "manual" logic but initiated by timer
    final metrics = const CrashMetrics(
      gForce: 0.0,
      speedBefore: 0.0,
      speedAfter: 0.0,
      mlConfidence: 1.0,
      crashType: 'SAFETY_CHECK_TIMEOUT',
      rolloverDetected: false,
    );

    // 3. Dispatch
    if (mounted) {
       // Navigate to rescue guide effectively starting the SOS sequence
       // We pass the metrics so RescueGuide knows to dispatch immediately
       Navigator.pushReplacementNamed(context, '/rescue-guide', arguments: metrics);
    }
  }

  String _formatTime(int seconds) {
    final m = seconds ~/ 60;
    final s = seconds % 60;
    return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg1,
      appBar: AppBar(
        title: Text('Safety Check', style: GoogleFonts.inter(fontWeight: FontWeight.w700)),
        centerTitle: true,
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            const Spacer(),
            
            // Timer Display
            Stack(
              alignment: Alignment.center,
              children: [
                if (_active)
                  FadeTransition(
                    opacity: _pulseCtrl,
                    child: Container(
                      width: 260,
                      height: 260,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppColors.warnAmber.withOpacity(0.1),
                        border: Border.all(color: AppColors.warnAmber.withOpacity(0.3), width: 2),
                      ),
                    ),
                  ),
                
                Container(
                  width: 220,
                  height: 220,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.bg2,
                    border: Border.all(
                      color: _active ? AppColors.warnAmber : AppColors.surfaceOutline,
                      width: 4
                    ),
                    boxShadow: _active ? [
                      BoxShadow(color: AppColors.warnAmber.withOpacity(0.2), blurRadius: 20)
                    ] : [],
                  ),
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.timer_outlined, 
                          size: 40, 
                          color: _active ? AppColors.warnAmber : AppColors.textMuted
                        ),
                        const SizedBox(height: 10),
                        Text(
                          _active ? _formatTime(_remainingSeconds) : '${_durationMinutes} min',
                          style: GoogleFonts.inter(
                            fontSize: 48,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                            fontFeatures: [const FontFeature.tabularFigures()],
                          ),
                        ),
                        if (_active)
                          Text(
                            'Remaining',
                            style: GoogleFonts.inter(color: AppColors.textSecondary),
                          ),
                      ],
                    ),
                  ),
                ),
              ],
            ),

            const Spacer(),

            if (!_active) ...[
               Text(
                'Set a timer for your journey.',
                style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 8),
              Text(
                'If you don\'t check in before the timer expires, an SOS will be sent to your emergency contacts.',
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(fontSize: 13, color: AppColors.textSecondary, height: 1.4),
              ),
              const SizedBox(height: 32),
              
              // Duration Slider
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Duration', style: GoogleFonts.inter(color: AppColors.textSecondary)),
                  Text('$_durationMinutes min', style: GoogleFonts.inter(fontWeight: FontWeight.w700)),
                ],
              ),
              Slider(
                value: _durationMinutes.toDouble(),
                min: 5,
                max: 120,
                divisions: 23,
                activeColor: AppColors.warnAmber,
                onChanged: (v) => setState(() => _durationMinutes = v.round()),
              ),
              
              const SizedBox(height: 24),
              
              SizedBox(
                width: double.infinity,
                height: 56,
                child: FilledButton(
                  onPressed: _startTimer,
                  style: FilledButton.styleFrom(backgroundColor: AppColors.warnAmber),
                  child: Text('Start Safety Check', style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 16, color: Colors.black)),
                ),
              ),
            ] else ...[
              Text(
                'Safety Check Active',
                style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.warnAmber),
              ),
              const SizedBox(height: 8),
              Text(
                'We are monitoring your status.',
                style: GoogleFonts.inter(color: AppColors.textSecondary),
              ),
              const SizedBox(height: 48),
              
              SizedBox(
                width: double.infinity,
                height: 56,
                child: OutlinedButton(
                  onPressed: _cancelTimer,
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: AppColors.textPrimary),
                    foregroundColor: AppColors.textPrimary,
                  ),
                  child: Text('I\'m Safe (Stop Timer)', style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 16)),
                ),
              ),
            ],
            
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}
