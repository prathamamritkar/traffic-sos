import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:vibration/vibration.dart';
import 'package:audioplayers/audioplayers.dart';
import '../../services/rctf_logger.dart';

class CrashCountdownScreen extends StatefulWidget {
  final double gForce;

  const CrashCountdownScreen({super.key, required this.gForce});

  @override
  State<CrashCountdownScreen> createState() => _CrashCountdownScreenState();
}

class _CrashCountdownScreenState extends State<CrashCountdownScreen> {
  int _secondsLeft = 15;
  Timer? _timer;
  final AudioPlayer _audioPlayer = AudioPlayer();
  final _logger = RctfLogger();

  @override
  void initState() {
    super.initState();
    _startCountdown();
    _triggerAlerts();
    _logger.logEvent('COUNTDOWN_SHOWN', {'gForce': widget.gForce});
  }

  void _triggerAlerts() async {
    // Loud alarm
    await _audioPlayer.play(AssetSource('sounds/emergency_alarm.mp3'));
    _audioPlayer.setReleaseMode(ReleaseMode.loop);

    // Haptic spikes
    if (await Vibration.hasVibrator() ?? false) {
      Vibration.vibrate(pattern: [0, 500, 200, 500], repeat: 0);
    }
  }

  void _startCountdown() {
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_secondsLeft > 0) {
        setState(() => _secondsLeft--);
      } else {
        _timer?.cancel();
        _triggerSOS();
      }
    });
  }

  void _cancelAlert() async {
    _timer?.cancel();
    _audioPlayer.stop();
    Vibration.cancel();
    _logger.logEvent('USER_CANCELLED_CRASH', {'secondsRemaining': _secondsLeft});
    Navigator.of(context).pop();
  }

  void _triggerSOS() {
    _audioPlayer.stop();
    Vibration.cancel();
    _logger.logEvent('SOS_AUTO_TRIGGERED', {'reason': 'countdown_reached_zero'});
    // Navigate to SOS progress/active screen
    Navigator.of(context).pushReplacementNamed('/sos_active');
  }

  @override
  void dispose() {
    _timer?.cancel();
    _audioPlayer.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF1E1E1E),
      body: SafeArea(
        child: Column(
          children: [
            const SizedBox(height: 60),
            const Icon(Icons.warning_amber_rounded, size: 80, color: Colors.red)
                .animate(onPlay: (controller) => controller.repeat())
                .scale(begin: const Offset(1, 1), end: const Offset(1.2, 1.2), duration: 500.ms, curve: Curves.easeInOut)
                .then()
                .scale(begin: const Offset(1.2, 1.2), end: const Offset(1, 1)),
            
            const SizedBox(height: 24),
            Text(
              "CRASH DETECTED",
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.w900,
                letterSpacing: 2,
              ),
            ),
            
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 40),
              child: Text(
                "A severe impact was detected (${widget.gForce.toStringAsFixed(1)}G). We will alert emergency services in:",
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white70, fontSize: 16),
              ),
            ),
            
            const Spacer(),
            
            Stack(
              alignment: Alignment.center,
              children: [
                SizedBox(
                  width: 200,
                  height: 200,
                  child: CircularProgressIndicator(
                    value: _secondsLeft / 15,
                    strokeWidth: 12,
                    color: Colors.red,
                    backgroundColor: Colors.white10,
                  ),
                ),
                Text(
                  "$_secondsLeft",
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 80,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ],
            ),
            
            const Spacer(),
            
            Padding(
              padding: const EdgeInsets.all(32),
              child: SizedBox(
                width: double.infinity,
                height: 70,
                child: ElevatedButton(
                  onPressed: _cancelAlert,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  child: const Text(
                    "I'M SAFE",
                    style: TextStyle(
                      color: Colors.black,
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ).animate().slideY(begin: 1.0, end: 0.0, delay: 500.ms),
            ),
            
            TextButton(
              onPressed: _triggerSOS,
              child: const Text(
                "SEND SOS NOW",
                style: TextStyle(color: Colors.redAccent, decoration: TextDecoration.underline),
              ),
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }
}
