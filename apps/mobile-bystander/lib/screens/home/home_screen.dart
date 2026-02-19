// ============================================================
// Home Screen — Main user app screen
// Shows: monitoring status, SOS button, live responder map
// ============================================================
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../services/crash_detection_service.dart';
import '../../services/auth_service.dart';
import '../../models/rctf_models.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with TickerProviderStateMixin {
  bool _monitoring = true;
  late AnimationController _radarController;

  @override
  void initState() {
    super.initState();
    _radarController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();

    // Start crash detection
    final detector = CrashDetectionService();
    detector.onCrashDetected = _onCrashDetected;
    detector.startMonitoring();
  }

  void _onCrashDetected(CrashDetectionResult result) {
    if (!mounted) return;
    Navigator.pushNamed(
      context,
      '/sos-active',
      arguments: {'metrics': result.metrics},
    );
  }

  void _triggerManualSOS() {
    HapticFeedback.heavyImpact();
    Navigator.pushNamed(context, '/sos-active');
  }

  @override
  void dispose() {
    _radarController.dispose();
    CrashDetectionService().stopMonitoring();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0E1A),
      appBar: AppBar(
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('🚑 ', style: TextStyle(fontSize: 20)),
            Text('RescuEdge', style: GoogleFonts.inter(fontWeight: FontWeight.w800)),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_outline),
            onPressed: () {},
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () async {
              await AuthService().signOut();
              if (mounted) Navigator.pushReplacementNamed(context, '/auth');
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Monitoring Status Card ─────────────────────
            _MonitoringCard(
              monitoring: _monitoring,
              radarController: _radarController,
              onToggle: (v) {
                setState(() => _monitoring = v);
                if (v) {
                  CrashDetectionService().startMonitoring();
                } else {
                  CrashDetectionService().stopMonitoring();
                }
              },
            ),

            const SizedBox(height: 20),

            // ── Emergency SOS Button ───────────────────────
            _SOSButton(onPressed: _triggerManualSOS),

            const SizedBox(height: 20),

            // ── Bystander Mode ─────────────────────────────
            _BystanderCard(
              onPressed: () => Navigator.pushNamed(context, '/bystander'),
            ),

            const SizedBox(height: 20),

            // ── Quick Stats ────────────────────────────────
            _QuickStats(),

            const SizedBox(height: 20),

            // ── Test Crash (Demo) ──────────────────────────
            if (const bool.fromEnvironment('DEMO_MODE', defaultValue: true))
              _DemoCard(
                onSimulate: () => CrashDetectionService().simulateCrash(),
              ),
          ],
        ),
      ),
    );
  }
}

class _MonitoringCard extends StatelessWidget {
  final bool monitoring;
  final AnimationController radarController;
  final ValueChanged<bool> onToggle;

  const _MonitoringCard({
    required this.monitoring,
    required this.radarController,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF131D35),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x14FFFFFF)),
      ),
      child: Row(
        children: [
          // Radar animation
          AnimatedBuilder(
            animation: radarController,
            builder: (_, __) => Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: monitoring
                    ? const Color(0xFF22C55E).withOpacity(0.1)
                    : const Color(0xFF475569).withOpacity(0.1),
                border: Border.all(
                  color: monitoring
                      ? const Color(0xFF22C55E).withOpacity(0.3 + radarController.value * 0.5)
                      : const Color(0xFF475569),
                  width: 2,
                ),
              ),
              child: Icon(
                Icons.radar,
                color: monitoring ? const Color(0xFF22C55E) : const Color(0xFF475569),
                size: 28,
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  monitoring ? 'Monitoring Active' : 'Monitoring Paused',
                  style: GoogleFonts.inter(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
                Text(
                  monitoring
                      ? 'Crash detection running in background'
                      : 'Tap to resume crash detection',
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    color: const Color(0xFF94A3B8),
                  ),
                ),
              ],
            ),
          ),
          Switch(
            value: monitoring,
            onChanged: onToggle,
            activeColor: const Color(0xFF22C55E),
          ),
        ],
      ),
    );
  }
}

class _SOSButton extends StatelessWidget {
  final VoidCallback onPressed;
  const _SOSButton({required this.onPressed});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onLongPress: onPressed,
      child: Container(
        width: double.infinity,
        height: 120,
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFFEF4444), Color(0xFFDC2626)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFFEF4444).withOpacity(0.4),
              blurRadius: 24,
              spreadRadius: 4,
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('🆘', style: TextStyle(fontSize: 36)),
            const SizedBox(height: 8),
            Text(
              'HOLD FOR EMERGENCY SOS',
              style: GoogleFonts.inter(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                color: Colors.white,
                letterSpacing: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BystanderCard extends StatelessWidget {
  final VoidCallback onPressed;
  const _BystanderCard({required this.onPressed});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onPressed,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: const Color(0xFF131D35),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0x14FFFFFF)),
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: const Color(0xFF3B82F6).withOpacity(0.15),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.camera_alt, color: Color(0xFF3B82F6), size: 24),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Bystander Mode', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white)),
                  Text('Capture scene for AI analysis', style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF94A3B8))),
                ],
              ),
            ),
            const Icon(Icons.arrow_forward_ios, color: Color(0xFF475569), size: 16),
          ],
        ),
      ),
    );
  }
}

class _QuickStats extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: _StatCard(label: 'G-Force', value: '0.0g', icon: '📊')),
        const SizedBox(width: 12),
        Expanded(child: _StatCard(label: 'Speed', value: '0 km/h', icon: '🚗')),
        const SizedBox(width: 12),
        Expanded(child: _StatCard(label: 'Status', value: 'Safe', icon: '✅')),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label, value, icon;
  const _StatCard({required this.label, required this.value, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF131D35),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0x14FFFFFF)),
      ),
      child: Column(
        children: [
          Text(icon, style: const TextStyle(fontSize: 20)),
          const SizedBox(height: 6),
          Text(value, style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white)),
          Text(label, style: GoogleFonts.inter(fontSize: 10, color: const Color(0xFF94A3B8))),
        ],
      ),
    );
  }
}

class _DemoCard extends StatelessWidget {
  final VoidCallback onSimulate;
  const _DemoCard({required this.onSimulate});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A2E),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFEAB308).withOpacity(0.3)),
      ),
      child: Row(
        children: [
          const Text('⚠️', style: TextStyle(fontSize: 20)),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              'Demo Mode — Simulate crash detection',
              style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFFEAB308)),
            ),
          ),
          TextButton(
            onPressed: onSimulate,
            child: Text('Simulate', style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFFEAB308), fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }
}
