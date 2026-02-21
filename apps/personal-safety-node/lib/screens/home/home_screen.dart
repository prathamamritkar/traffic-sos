// ============================================================
// Home Screen — Material 3 production redesign
// Main hub: monitoring, SOS, features, stats
// ============================================================
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:permission_handler/permission_handler.dart';
import 'package:permission_handler/permission_handler.dart';
import '../../config/app_theme.dart';
import '../../services/crash_detection_service.dart';
import '../../services/auth_service.dart';
import '../../models/rctf_models.dart';
import '../map/safety_map_screen.dart';
import '../history/history_screen.dart';
import '../settings/settings_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with TickerProviderStateMixin {
  bool _monitoring = true;
  int _navIndex = 0;

  late AnimationController _radarCtrl;
  late AnimationController _sosCtrl;
  late Animation<double> _sosScale;

  @override
  void initState() {
    super.initState();

    _radarCtrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();

    _sosCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    )..repeat(reverse: true);

    _sosScale = Tween<double>(begin: 1.0, end: 1.05)
        .animate(CurvedAnimation(parent: _sosCtrl, curve: Curves.easeInOut));

    final detector = CrashDetectionService();
    detector.onCrashDetected = _onCrashDetected;
    detector.startMonitoring();

    _checkPermissions();
  }

  Future<void> _checkPermissions() async {
    await Permission.location.request();
    await Permission.notification.request();
  }

  void _onCrashDetected(CrashDetectionResult result) {
    if (!mounted) return;
    Navigator.pushNamed(context, '/crash-countdown', arguments: result.metrics);
  }

  void _triggerManualSOS() {
    HapticFeedback.heavyImpact();
    Navigator.pushNamed(context, '/rescue-guide');
  }

  @override
  void dispose() {
    _radarCtrl.dispose();
    _sosCtrl.dispose();
    CrashDetectionService().stopMonitoring();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg1,
      // Only show Main AppBar on Home Tab (0); others have their own Scaffolds
      appBar: _navIndex == 0 ? _buildAppBar() : null,
      body: _buildBody(),
      bottomNavigationBar: _buildNavBar(),
    );
  }

  Widget _buildBody() {
    switch (_navIndex) {
      case 0: return _buildHomeContent();
      case 1: return const SafetyMapScreen();
      case 2: return const HistoryScreen();
      case 3: return const SettingsScreen();
      default: return _buildHomeContent();
    }
  }

  PreferredSizeWidget _buildAppBar() {
    return AppBar(
      titleSpacing: 20,
      title: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.redSurface,
              border: Border.all(color: AppColors.redCore.withOpacity(0.5), width: 1),
            ),
            child: const Icon(Icons.local_hospital_rounded, size: 15, color: AppColors.redCore),
          ),
          const SizedBox(width: 10),
          Text(
            'RescuEdge',
            style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
          ),
        ],
      ),
      actions: [
        // Live status — safeGreen = monitoring active = calm/safe state
        if (_monitoring)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Row(
              children: [
                PulseDot(color: AppColors.safeGreen, size: 6),
                const SizedBox(width: 5),
                Text(
                  'LIVE',
                  style: GoogleFonts.inter(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: AppColors.safeGreen,
                    letterSpacing: 0.8,
                  ),
                ),
              ],
            ),
          ),
        const SizedBox(width: 4),
        IconButton(
          icon: const Icon(Icons.notifications_outlined),
          onPressed: () => Navigator.pushNamed(context, '/notifications'),
          tooltip: 'Notifications',
        ),
        IconButton(
          icon: const Icon(Icons.person_outline_rounded),
          onPressed: () => Navigator.pushNamed(context, '/profile'),
          tooltip: 'Profile',
        ),
      ],
    );
  }

  Widget _buildHomeContent() {
    return CustomScrollView(
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          sliver: SliverList(
            delegate: SliverChildListDelegate([

              // ── Monitoring Status Card ──────────────────────
              _MonitoringCard(
                monitoring: _monitoring,
                radarCtrl: _radarCtrl,
                onToggle: (v) {
                  HapticFeedback.selectionClick();
                  setState(() => _monitoring = v);
                  if (v) {
                    CrashDetectionService().startMonitoring();
                  } else {
                    CrashDetectionService().stopMonitoring();
                  }
                },
              ),

              const SizedBox(height: 16),

              // ── SOS Button ─────────────────────────────────
              _SOSButton(sosScale: _sosScale, onLongPress: _triggerManualSOS),

              const SizedBox(height: 24),

              // ── Section: Features ────────────────────────
              SectionHeader(title: 'Safety Features'),
              const SizedBox(height: 12),

               Row(
                children: [
                  Expanded(
                    child: _FeatureCard(
                      icon: Icons.timer_outlined,
                      label: 'Safety Check',
                      subtitle: 'Timed check-in',
                      // amber = time-sensitive / caution — correct semantic
                      color: AppColors.warnAmber,
                      onTap: () => Navigator.pushNamed(context, '/safety-check'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _FeatureCard(
                      icon: Icons.contact_emergency_outlined,
                      label: 'Emergency\nContacts',
                      subtitle: 'Notify inner circle',
                      // safeGreen = "people who will help" = reassurance
                      color: AppColors.safeGreen,
                      onTap: () => Navigator.pushNamed(context, '/contacts'),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 12),

              _FeatureCardWide(
                icon: Icons.auto_awesome_outlined,
                label: 'Situational Intelligence',
                subtitle: 'Analyze scene with AI vision & audio',
                color: AppColors.aiBlue,  // blue = intelligence / analytical
                badge: 'AI-POWERED',
                onTap: () => Navigator.pushNamed(context, '/bystander'),
              ),

              const SizedBox(height: 12),

              _FeatureCardWide(
                icon: Icons.map_outlined,
                label: 'Route Safety Map',
                subtitle: 'Live accident density and safe routes',
                color: AppColors.infoAmber, // muted amber = informational, not urgent
                badge: 'BETA',
                onTap: () => Navigator.pushNamed(context, '/safety-map'),
              ),

              const SizedBox(height: 24),

              // ── Section: System Status ──────────────────────
              SectionHeader(title: 'System Status'),
              const SizedBox(height: 12),

              _QuickStats(),

              const SizedBox(height: 20),

              // ── Vault Status ────────────────────────────────
              _VaultStatusCard(),

              const SizedBox(height: 20),

              // ── Medical Profile ─────────────────────────────
              _MedicalProfileCard(),

              const SizedBox(height: 20),

              // ── Demo Mode ───────────────────────────────────
              if (const bool.fromEnvironment('DEMO_MODE', defaultValue: true))
                _DemoCard(
                  onSimulate: () {
                    HapticFeedback.heavyImpact();
                    CrashDetectionService().simulateCrash();
                  },
                ),

              const SizedBox(height: 32),
            ]),
          ),
        ),
      ],
    );
  }

  Widget _buildNavBar() {
    return NavigationBar(
      selectedIndex: _navIndex,
      onDestinationSelected: (i) => setState(() => _navIndex = i),
      destinations: const [
        NavigationDestination(
          icon: Icon(Icons.home_outlined),
          selectedIcon: Icon(Icons.home_rounded),
          label: 'Home',
        ),
        NavigationDestination(
          icon: Icon(Icons.map_outlined),
          selectedIcon: Icon(Icons.map_rounded),
          label: 'Map',
        ),
        NavigationDestination(
          icon: Icon(Icons.history_outlined),
          selectedIcon: Icon(Icons.history_rounded),
          label: 'History',
        ),
        NavigationDestination(
          icon: Icon(Icons.settings_outlined),
          selectedIcon: Icon(Icons.settings_rounded),
          label: 'Settings',
        ),
      ],
    );
  }
}

// ── _MonitoringCard ─────────────────────────────────────────

class _MonitoringCard extends StatelessWidget {
  final bool monitoring;
  final AnimationController radarCtrl;
  final ValueChanged<bool> onToggle;

  const _MonitoringCard({
    required this.monitoring,
    required this.radarCtrl,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    // safeGreen: monitoring = system working = calm positive state
    // textMuted: paused = neutral, not frightening
    final activeColor = monitoring ? AppColors.safeGreen : AppColors.textMuted;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.bg2,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: monitoring
              // safeGreen border = subtle positive framing — system is protecting you
              ? AppColors.safeGreen.withOpacity(0.22)
              : AppColors.surfaceOutline,
        ),
        boxShadow: monitoring
            ? [BoxShadow(color: AppColors.safeGreen.withOpacity(0.06), blurRadius: 18, spreadRadius: 2)]
            : [],
      ),
      child: Row(
        children: [
          // Animated radar
          AnimatedBuilder(
            animation: radarCtrl,
            builder: (_, __) {
              final pulse = radarCtrl.value;
              return Stack(
                alignment: Alignment.center,
                children: [
                  if (monitoring)
                      Container(
                        width: 56,
                        height: 56,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: AppColors.safeGreen.withOpacity(0.04 + pulse * 0.06),
                          border: Border.all(
                            color: AppColors.safeGreen.withOpacity(0.08 + pulse * 0.24),
                          ),
                        ),
                      ),
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: activeColor.withOpacity(0.12),
                    ),
                    child: Icon(
                      monitoring ? Icons.radar_rounded : Icons.sensors_off_outlined,
                      color: activeColor,
                      size: 22,
                    ),
                  ),
                ],
              );
            },
          ),

          const SizedBox(width: 14),

          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  monitoring ? 'Crash Detection Active' : 'Detection Paused',
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  monitoring
                      ? 'Monitoring accelerometer in background'
                      : 'Tap toggle to resume protection',
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),

          Switch(
            value: monitoring,
            onChanged: onToggle,
          ),
        ],
      ),
    );
  }
}

// ── _SOSButton ──────────────────────────────────────────────

class _SOSButton extends StatelessWidget {
  final Animation<double> sosScale;
  final VoidCallback onLongPress;

  const _SOSButton({required this.sosScale, required this.onLongPress});

  @override
  Widget build(BuildContext context) {
    return ScaleTransition(
      scale: sosScale,
      child: GestureDetector(
        onLongPress: onLongPress,
        child: Container(
          width: double.infinity,
          // height removed - content driven
          constraints: const BoxConstraints(minHeight: 120),
          decoration: BoxDecoration(
            // SOS button = maximum urgency element = uses sosRed (full chroma)
            // Flat color, NOT gradient. Research (Ware, 2004) shows that uniform
            // high-chroma color surfaces produce stronger urgency signals than
            // gradient surfaces. Gradient creates ambiguity about focal point.
            color: AppColors.sosRed,
            borderRadius: BorderRadius.circular(22),
            boxShadow: [
              BoxShadow(
                color: AppColors.sosRed.withOpacity(0.40),
                blurRadius: 28,
                spreadRadius: 0,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Stack(
            children: [
              // Decorative circles
              Positioned(
                right: -16,
                top: -16,
                child: Container(
                  width: 100,
                  height: 100,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.white.withOpacity(0.06),
                  ),
                ),
              ),
              Positioned(
                right: 20,
                bottom: -30,
                child: Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.white.withOpacity(0.04),
                  ),
                ),
              ),

              // Content
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
                child: Row(
                  children: [
                    const Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.sos_rounded, color: Colors.white, size: 36),
                      ],
                    ),
                    const SizedBox(width: 20),
                    Expanded(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'EMERGENCY SOS',
                            style: GoogleFonts.inter(
                              fontSize: 20,
                              fontWeight: FontWeight.w900,
                              color: Colors.white,
                              letterSpacing: 0.5,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Hold 2 seconds to activate',
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              color: Colors.white70,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white.withOpacity(0.15),
                      ),
                      child: const Icon(Icons.chevron_right_rounded, color: Colors.white, size: 22),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── _FeatureCard ────────────────────────────────────────────

class _FeatureCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String subtitle;
  final Color color;
  final VoidCallback onTap;

  const _FeatureCard({
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.bg2,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.surfaceOutline),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: color.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: color, size: 22),
              ),
              const SizedBox(height: 12),
              Text(
                label,
                style: GoogleFonts.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                  height: 1.2,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                subtitle,
                style: GoogleFonts.inter(
                  fontSize: 11,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── _FeatureCardWide ────────────────────────────────────────

class _FeatureCardWide extends StatelessWidget {
  final IconData icon;
  final String label;
  final String subtitle;
  final Color color;
  final String? badge;
  final VoidCallback onTap;

  const _FeatureCardWide({
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.color,
    this.badge,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.bg2,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.surfaceOutline),
          ),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: color.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, color: color, size: 24),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          label,
                          style: GoogleFonts.inter(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        if (badge != null) ...[
                          const SizedBox(width: 8),
                          AppBadge(label: badge!, color: color),
                        ],
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      subtitle,
                      style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted, size: 20),
            ],
          ),
        ),
      ),
    );
  }
}

// ── _QuickStats ─────────────────────────────────────────────

class _QuickStats extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _StatTile(
            label: 'G-Force',
            value: '0.0g',
            icon: Icons.show_chart_rounded,
            // blue = informational / analytical data
            iconColor: AppColors.aiBlue,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _StatTile(
            label: 'Speed',
            value: '0 km/h',
            icon: Icons.speed_rounded,
            // amber = caution metric — worth watching
            iconColor: AppColors.warnAmber,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _StatTile(
            label: 'Status',
            value: 'Safe',
            icon: Icons.verified_user_outlined,
            // safeGreen = all clear / passive positive state
            iconColor: AppColors.safeGreen,
          ),
        ),
      ],
    );
  }
}

class _StatTile extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color iconColor;

  const _StatTile({
    required this.label,
    required this.value,
    required this.icon,
    required this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
      decoration: BoxDecoration(
        color: AppColors.bg2,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.surfaceOutline),
      ),
      child: Column(
        children: [
          Icon(icon, color: iconColor, size: 20),
          const SizedBox(height: 8),
          Text(
            value,
            style: GoogleFonts.inter(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: GoogleFonts.inter(fontSize: 10, color: AppColors.textSecondary, fontWeight: FontWeight.w500),
          ),
        ],
      ),
    );
  }
}

// ── _VaultStatusCard ────────────────────────────────────────

class _VaultStatusCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
      // aiBlue for vault lock icon — security/encryption is informational, not alarming
      decoration: BoxDecoration(
        color: AppColors.bg2,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.aiBlue.withOpacity(0.25)),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.aiBlue.withOpacity(0.09),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.lock_outline_rounded, color: AppColors.aiBlue, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Offline Vault',
                  style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                ),
                Text(
                  'Encrypted AES-256 · Synced locally',
                  style: GoogleFonts.inter(fontSize: 11, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
          // safeGreen badge — vault SECURE is a calm passive confirmation
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: AppColors.safeGreen.withOpacity(0.10),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              'SECURE',
              style: GoogleFonts.inter(
                fontSize: 9,
                fontWeight: FontWeight.w800,
                // safeGreen = secure = system protecting data (calm positive)
                color: AppColors.safeGreen,
                letterSpacing: 0.8,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── _MedicalProfileCard ─────────────────────────────────────

class _MedicalProfileCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.bg2,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.surfaceOutline),
      ),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: AppColors.redSurface,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.medical_information_outlined,
              // brandRed = brand identity, not emergency alarm
              // Medical info is accessed calmly, not in panic mode
              color: AppColors.brandRed,
              size: 22,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Medical Profile',
                  style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                ),
                Text(
                  'Blood group, allergies & emergency contacts',
                  style: GoogleFonts.inter(fontSize: 11, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted, size: 20),
        ],
      ),
    );
  }
}

// ── _DemoCard ───────────────────────────────────────────────

class _DemoCard extends StatelessWidget {
  final VoidCallback onSimulate;
  const _DemoCard({required this.onSimulate});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        // infoAmber tint (not bright warning amber) — demo mode is
        // informational/test-only. Bright amber would falsely signal danger.
        color: AppColors.infoAmber.withOpacity(0.06),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.infoAmber.withOpacity(0.25)),
      ),
      child: Row(
        children: [
          Icon(Icons.science_outlined, color: AppColors.infoAmber, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Demo Mode',
                  style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.infoAmber),
                ),
                Text(
                  'Simulate a crash detection event',
                  style: GoogleFonts.inter(fontSize: 11, color: AppColors.infoAmber.withOpacity(0.65)),
                ),
              ],
            ),
          ),
          TextButton(
            onPressed: onSimulate,
            style: TextButton.styleFrom(
              foregroundColor: AppColors.infoAmber,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            ),
            child: Text('Simulate', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );
  }
}
