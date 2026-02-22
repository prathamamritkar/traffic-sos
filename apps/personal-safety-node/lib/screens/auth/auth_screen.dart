// ============================================================
// Auth Screen — Material 3 production sign-in
// Google SSO + Demo mode with proper UX states
// ============================================================
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../config/app_theme.dart';
import '../../services/auth_service.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen>
    with SingleTickerProviderStateMixin {
  bool _loading = false;
  String? _error;
  bool _demoLoading = false;

  late AnimationController _heroCtrl;
  late Animation<double> _heroFade;
  late Animation<Offset> _heroSlide;

  @override
  void initState() {
    super.initState();
    _heroCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 700));
    _heroFade = CurvedAnimation(parent: _heroCtrl, curve: Curves.easeOut);
    _heroSlide = Tween<Offset>(begin: const Offset(0, 0.08), end: Offset.zero)
        .animate(CurvedAnimation(parent: _heroCtrl, curve: Curves.easeOut));
    _heroCtrl.forward();
  }

  @override
  void dispose() {
    _heroCtrl.dispose();
    super.dispose();
  }

  Future<void> _signInWithGoogle() async {
    HapticFeedback.selectionClick();
    setState(() { _loading = true; _error = null; });
    try {
      final auth = await AuthService().signInWithGoogle();
      if (auth != null && mounted) {
        Navigator.pushReplacementNamed(context, '/home');
      } else if (mounted) {
        setState(() => _error = 'Google sign-in failed. Please try demo mode.');
      }
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _signInDemo() async {
    HapticFeedback.selectionClick();
    setState(() { _demoLoading = true; _error = null; });
    await AuthService().signInDemo();
    if (mounted) Navigator.pushReplacementNamed(context, '/home');
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;

    return Scaffold(
      backgroundColor: AppColors.bg0,
      body: Stack(
        children: [
          // Decorative orb — blue-indigo, NOT red.
          // Blue in the top corner primes a sense of intelligence and trust
          // before the user engages. Red would prime alarm/danger on a
          // pre-login screen where there is nothing yet to be alarmed about.
          Positioned(
            top: -80,
            right: -80,
            child: Container(
              width: 280,
              height: 280,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                // aiBlue orb — trust/intelligence framing before login (not alarm)
                gradient: RadialGradient(
                  colors: [
                    AppColors.aiBlue.withOpacity(0.09),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),

          SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: size.height - MediaQuery.of(context).padding.top - MediaQuery.of(context).padding.bottom),
                child: FadeTransition(
                  opacity: _heroFade,
                  child: SlideTransition(
                    position: _heroSlide,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SizedBox(height: size.height * 0.12),

                        // Hero section
                        Center(
                          child: Column(
                            children: [
                              Container(
                                width: 80,
                                height: 80,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: AppColors.redSurface,
                                  border: Border.all(
                                    color: AppColors.brandRed.withOpacity(0.35),
                                    width: 1.5,
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: AppColors.brandRed.withOpacity(0.2),
                                      blurRadius: 20,
                                      spreadRadius: 4,
                                    ),
                                  ],
                                ),
                                child: const Icon(
                                  Icons.local_hospital_rounded,
                                  color: AppColors.brandRed,
                                  size: 38,
                                ),
                              ),
                              const SizedBox(height: 20),
                              Text(
                                'RapidRescue',
                                style: GoogleFonts.inter(
                                  fontSize: 30,
                                  fontWeight: FontWeight.w900,
                                  color: AppColors.textPrimary,
                                  letterSpacing: -0.5,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                'Your personal emergency safety companion',
                                textAlign: TextAlign.center,
                                style: GoogleFonts.inter(
                                  fontSize: 14,
                                  color: AppColors.textSecondary,
                                  height: 1.4,
                                ),
                              ),
                            ],
                          ),
                        ),

                        SizedBox(height: size.height * 0.08),

                        // Feature pills
                        const Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            _FeaturePill(icon: Icons.sensors, label: 'Crash Detection'),
                            _FeaturePill(icon: Icons.emergency_share_outlined, label: 'Auto SOS'),
                            _FeaturePill(icon: Icons.cloud_off_outlined, label: 'Works Offline'),
                            _FeaturePill(icon: Icons.shield_outlined, label: 'Private & Secure'),
                          ],
                        ),

                        const SizedBox(height: 40),

                        // Error
                        if (_error != null)
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(14),
                            margin: const EdgeInsets.only(bottom: 16),
                            decoration: BoxDecoration(
                              color: AppColors.bg3,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: AppColors.redBright.withOpacity(0.35),
                              ),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.error_outline_rounded, color: AppColors.redBright, size: 16),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    _error!,
                                    style: GoogleFonts.inter(
                                      fontSize: 13,
                                      color: AppColors.textSecondary, // muted, not alarming red text
                                      height: 1.4,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),

                        // Google Sign-In
                        _GoogleSignInButton(
                          loading: _loading,
                          onTap: _loading || _demoLoading ? null : _signInWithGoogle,
                        ),

                        const SizedBox(height: 12),

                        // Divider with OR
                        Row(
                          children: [
                            const Expanded(child: Divider(color: AppColors.surfaceOutline)),
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 12),
                              child: Text(
                                'OR',
                                style: GoogleFonts.inter(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.textMuted,
                                  letterSpacing: 0.8,
                                ),
                              ),
                            ),
                            const Expanded(child: Divider(color: AppColors.surfaceOutline)),
                          ],
                        ),

                        const SizedBox(height: 12),

                        // Demo mode
                        SizedBox(
                          width: double.infinity,
                          height: 52,
                          child: OutlinedButton.icon(
                            onPressed: _loading || _demoLoading ? null : _signInDemo,
                            icon: _demoLoading
                                ? const SizedBox(
                                    width: 16, height: 16,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.textSecondary),
                                  )
                                : const Icon(Icons.phonelink_outlined, size: 18),
                            label: Text(
                              _demoLoading ? 'Starting demo…' : 'Continue as Demo',
                              style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600),
                            ),
                          ),
                        ),

                        const SizedBox(height: 32),

                        // Legal footnote
                        Center(
                          child: Text(
                            'By continuing, you agree to our Terms and Privacy Policy.\nYour location is only used during active emergencies.',
                            textAlign: TextAlign.center,
                            style: GoogleFonts.inter(
                              fontSize: 11,
                              // raised from textDisabled — legal text must be
                              // legible enough that users can actually read it.
                              color: AppColors.textMuted,
                              height: 1.7,
                            ),
                          ),
                        ),

                        SizedBox(height: size.height * 0.05),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _GoogleSignInButton extends StatelessWidget {
  final bool loading;
  final VoidCallback? onTap;

  const _GoogleSignInButton({required this.loading, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: ElevatedButton(
        onPressed: onTap,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.textPrimary,
          foregroundColor: const Color(0xFF1A1A1A),
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          padding: const EdgeInsets.symmetric(horizontal: 20),
        ),
        child: loading
            ? const SizedBox(
                width: 20, height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  color: Color(0xFF1A1A1A),
                ),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Google G logo
                  Container(
                    width: 20,
                    height: 20,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white,
                    ),
                    child: Center(
                      child: Text(
                        'G',
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          fontWeight: FontWeight.w900,
                          color: const Color(0xFF4285F4),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    'Continue with Google',
                    style: GoogleFonts.inter(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF1A1A1A),
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

class _FeaturePill extends StatelessWidget {
  final IconData icon;
  final String label;
  const _FeaturePill({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: AppColors.bg3,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.surfaceOutline),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AppColors.textSecondary),
          const SizedBox(width: 6),
          Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}
