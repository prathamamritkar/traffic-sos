// Auth Screen — Google Sign-In + Phone OTP + Demo mode
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../services/auth_service.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  bool _loading = false;
  String? _error;

  Future<void> _signInWithGoogle() async {
    setState(() { _loading = true; _error = null; });
    try {
      final auth = await AuthService().signInWithGoogle();
      if (auth != null && mounted) {
        Navigator.pushReplacementNamed(context, '/home');
      } else {
        setState(() => _error = 'Google sign-in failed. Try demo mode.');
      }
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _signInDemo() async {
    setState(() { _loading = true; _error = null; });
    await AuthService().signInDemo();
    if (mounted) Navigator.pushReplacementNamed(context, '/home');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0E1A),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('🚑', style: TextStyle(fontSize: 72)),
              const SizedBox(height: 16),
              Text('RescuEdge', style: GoogleFonts.inter(fontSize: 36, fontWeight: FontWeight.w900, color: Colors.white)),
              Text('Your emergency safety companion', style: GoogleFonts.inter(fontSize: 14, color: const Color(0xFF94A3B8))),
              const SizedBox(height: 48),

              if (_error != null)
                Container(
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEF4444).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFEF4444).withOpacity(0.4)),
                  ),
                  child: Text(_error!, style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFFEF4444))),
                ),

              // Google Sign-In
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton.icon(
                  onPressed: _loading ? null : _signInWithGoogle,
                  icon: const Text('G', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
                  label: Text('Continue with Google', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: Colors.black87,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),

              const SizedBox(height: 12),

              // Demo mode
              SizedBox(
                width: double.infinity,
                height: 52,
                child: OutlinedButton(
                  onPressed: _loading ? null : _signInDemo,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF94A3B8),
                    side: const BorderSide(color: Color(0x14FFFFFF)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: Text('Demo Mode (No Login)', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600)),
                ),
              ),

              if (_loading) ...[
                const SizedBox(height: 24),
                const CircularProgressIndicator(color: Color(0xFFEF4444), strokeWidth: 2),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
