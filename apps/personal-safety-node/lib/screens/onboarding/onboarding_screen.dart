// ============================================================
// Onboarding Screen — Material 3 production redesign
// Medical profile setup with step indicator
// ============================================================
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';

import '../../config/app_theme.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen>
    with TickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  int _step = 0;
  static const _totalSteps = 3;

  // Controllers
  final _nameCtrl      = TextEditingController();
  final _phoneCtrl     = TextEditingController();
  final _emergencyCtrl = TextEditingController();
  final _allergyCtrl   = TextEditingController();

  // Values
  String _bloodGroup  = 'O+';
  String _gender      = 'Other';
  int _age            = 25;
  List<String> _allergies = [];

  static const _bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  static const _genders     = ['Male', 'Female', 'Other'];

  late AnimationController _slideCtrl;
  late Animation<Offset> _slideAnim;

  @override
  void initState() {
    super.initState();
    _slideCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 350));
    _slideAnim = Tween<Offset>(begin: const Offset(0.08, 0), end: Offset.zero)
        .animate(CurvedAnimation(parent: _slideCtrl, curve: Curves.easeOut));
    _slideCtrl.forward();
  }

  @override
  void dispose() {
    _slideCtrl.dispose();
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _emergencyCtrl.dispose();
    _allergyCtrl.dispose();
    super.dispose();
  }

  void _nextStep() {
    HapticFeedback.selectionClick();
    if (_step < _totalSteps - 1) {
      _slideCtrl.reset();
      setState(() => _step++);
      _slideCtrl.forward();
    } else {
      _save();
    }
  }

  void _prevStep() {
    if (_step > 0) {
      HapticFeedback.selectionClick();
      _slideCtrl.reset();
      setState(() => _step--);
      _slideCtrl.forward();
    }
  }

  Future<void> _save() async {
    final profile = {
      'name':              _nameCtrl.text.trim(),
      'phone':             _phoneCtrl.text.trim(),
      'bloodGroup':        _bloodGroup,
      'age':               _age,
      'gender':            _gender,
      'allergies':         _allergies,
      'medications':       <String>[],
      'conditions':        <String>[],
      'emergencyContacts': [_emergencyCtrl.text.trim()],
    };

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('medical_profile', jsonEncode(profile));

    if (mounted) Navigator.pushReplacementNamed(context, '/home');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg1,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            Expanded(
              child: Form(
                key: _formKey,
                child: SlideTransition(
                  position: _slideAnim,
                  child: _buildStep(),
                ),
              ),
            ),
            _buildFooter(),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Top bar
          Row(
            children: [
              if (_step > 0)
                IconButton(
                  icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18),
                  onPressed: _prevStep,
                  style: IconButton.styleFrom(foregroundColor: AppColors.textSecondary),
                )
              else
                const SizedBox(width: 40),
              const Spacer(),
              TextButton(
                onPressed: () => Navigator.pushReplacementNamed(context, '/home'),
                child: Text(
                  'Skip for now',
                  style: GoogleFonts.inter(fontSize: 13, color: AppColors.textMuted),
                ),
              ),
            ],
          ),

          const SizedBox(height: 4),

          // Step progress — aiBlue, NOT red.
          // Progress bars signal advancement (informational/positive).
          // Red progress bars trigger subconscious stress on EVERY step
          // because users conditioned [red = danger]. Blue = "you are moving
          // forward calmly." (Nielsen Norman Group, 2016, progress indicators)
          Row(
            children: List.generate(_totalSteps, (i) {
              return Expanded(
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 300),
                  margin: const EdgeInsets.only(right: 4),
                  height: 3,
                  decoration: BoxDecoration(
                    color: i <= _step ? AppColors.aiBlue : AppColors.bg4,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              );
            }),
          ),

          const SizedBox(height: 20),

          // Step title
          Text(
            _stepTitle(),
            style: GoogleFonts.inter(
              fontSize: 24,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 5),
          Text(
            _stepSubtitle(),
            style: GoogleFonts.inter(fontSize: 13, color: AppColors.textSecondary, height: 1.4),
          ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  String _stepTitle() => switch (_step) {
    0 => 'Who are you?',
    1 => 'Medical Details',
    _ => 'Emergency Contacts',
  };

  String _stepSubtitle() => switch (_step) {
    0 => 'Basic info helps responders verify identity.',
    1 => 'Critical for first responders at the scene.',
    _ => 'These people get notified during an SOS.',
  };

  Widget _buildStep() {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: switch (_step) {
        0 => _buildStep0(),
        1 => _buildStep1(),
        _ => _buildStep2(),
      },
    );
  }

  Widget _buildStep0() {
    return Column(
      children: [
        _InputField(
          label: 'Full Name',
          controller: _nameCtrl,
          hint: 'John Doe',
          icon: Icons.person_outline_rounded,
          required: true,
        ),
        const SizedBox(height: 16),
        _InputField(
          label: 'Phone Number',
          controller: _phoneCtrl,
          hint: '+91 98765 43210',
          icon: Icons.phone_outlined,
          keyboardType: TextInputType.phone,
          required: true,
        ),
        const SizedBox(height: 24),

        // Age slider
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('Age', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.redSurface,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                '$_age yrs',
                style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.redBright),
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Slider(
          value: _age.toDouble(),
          min: 1, max: 100,
          divisions: 99,
          label: '$_age',
          onChanged: (v) => setState(() => _age = v.round()),
        ),

        const SizedBox(height: 20),

        // Gender
        Text('Gender', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
        const SizedBox(height: 10),
        Row(
          children: _genders.map((g) {
            final selected = _gender == g;
            return Expanded(
              child: Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ChoiceChip(
                  label: Text(g),
                  selected: selected,
                  onSelected: (_) => setState(() => _gender = g),
                  showCheckmark: false,
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildStep1() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Blood Group', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: _bloodGroups.map((bg) {
            final selected = _bloodGroup == bg;
            return ChoiceChip(
              label: Text(bg, style: GoogleFonts.inter(fontWeight: FontWeight.w700)),
              selected: selected,
              onSelected: (_) => setState(() => _bloodGroup = bg),
              showCheckmark: false,
            );
          }).toList(),
        ),

        const SizedBox(height: 24),

        // Known Allergies
        Text('Known Allergies', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
        const SizedBox(height: 10),

        if (_allergies.isNotEmpty)
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _allergies.map((a) => Chip(
              label: Text(a),
              deleteIcon: const Icon(Icons.close_rounded, size: 14),
              onDeleted: () => setState(() => _allergies.remove(a)),
            )).toList(),
          ),

        const SizedBox(height: 10),

        Row(
          children: [
            Expanded(
              child: TextFormField(
                controller: _allergyCtrl,
                style: GoogleFonts.inter(fontSize: 14, color: AppColors.textPrimary),
                decoration: const InputDecoration(hintText: 'e.g. Penicillin, Latex…'),
              ),
            ),
            const SizedBox(width: 10),
            IconButton.filled(
              onPressed: () {
                final val = _allergyCtrl.text.trim();
                if (val.isNotEmpty && !_allergies.contains(val)) {
                  setState(() => _allergies.add(val));
                  _allergyCtrl.clear();
                }
              },
              icon: const Icon(Icons.add_rounded),
              style: IconButton.styleFrom(
                backgroundColor: AppColors.bg3,
                foregroundColor: AppColors.textPrimary,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ],
        ),

        const SizedBox(height: 16),

        // aiBlue info card — privacy/security info is informational, not alarming
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.aiBlue.withOpacity(0.06),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.aiBlue.withOpacity(0.2)),
          ),
          child: Row(
            children: [
              const Icon(Icons.info_outline_rounded, color: AppColors.aiBlue, size: 18),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'This information is stored securely on-device and is only shared with verified emergency responders.',
                  style: GoogleFonts.inter(fontSize: 12, color: AppColors.aiBlue, height: 1.4),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildStep2() {
    return Column(
      children: [
        _InputField(
          label: 'Emergency Contact Number',
          controller: _emergencyCtrl,
          hint: '+91 98765 43210',
          icon: Icons.contact_emergency_outlined,
          keyboardType: TextInputType.phone,
          required: true,
        ),
        const SizedBox(height: 20),

        // safeGreen — "you're almost ready" is a calm positive completion signal,
        // not a bright celebration. Keeps tone measured during setup.
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.safeGreen.withOpacity(0.08),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.safeGreen.withOpacity(0.3)),
          ),
          child: Column(
            children: [
              const Icon(Icons.check_circle_outline_rounded, color: AppColors.safeGreen, size: 36),
              const SizedBox(height: 12),
              Text(
                "You're almost ready!",
                style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 6),
              Text(
                'Your profile enables RescuEdge to provide critical medical info to first responders within seconds of an accident.',
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(fontSize: 13, color: AppColors.textSecondary, height: 1.4),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildFooter() {
    final isLast = _step == _totalSteps - 1;

    return Container(
      padding: EdgeInsets.fromLTRB(20, 16, 20, MediaQuery.of(context).padding.bottom + 16),
      decoration: const BoxDecoration(
        color: AppColors.bg1,
        border: Border(top: BorderSide(color: AppColors.divider)),
      ),
      child: SizedBox(
        width: double.infinity,
        height: 52,
        child: FilledButton(
          onPressed: _nextStep,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                isLast ? 'Complete Setup' : 'Continue',
                style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700),
              ),
              const SizedBox(width: 6),
              const Icon(Icons.arrow_forward_rounded, size: 18),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Input Field Component ───────────────────────────────────

class _InputField extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final String hint;
  final IconData icon;
  final TextInputType? keyboardType;
  final bool required;

  const _InputField({
    required this.label,
    required this.controller,
    required this.hint,
    required this.icon,
    this.keyboardType,
    this.required = false,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
        ),
        const SizedBox(height: 8),
        TextFormField(
          controller: controller,
          keyboardType: keyboardType,
          style: GoogleFonts.inter(fontSize: 14, color: AppColors.textPrimary),
          decoration: InputDecoration(
            hintText: hint,
            prefixIcon: Icon(icon, size: 18, color: AppColors.textMuted),
          ),
          validator: required
              ? (v) => (v == null || v.isEmpty) ? 'This field is required' : null
              : null,
        ),
      ],
    );
  }
}
