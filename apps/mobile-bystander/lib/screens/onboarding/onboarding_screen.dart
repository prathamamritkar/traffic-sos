// Onboarding Screen — collect user medical profile
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _formKey = GlobalKey<FormState>();
  int _step = 0;

  // Form fields
  final _nameCtrl        = TextEditingController();
  final _phoneCtrl       = TextEditingController();
  final _emergencyCtrl   = TextEditingController();
  String _bloodGroup     = 'O+';
  String _gender         = 'MALE';
  int _age               = 25;
  List<String> _allergies = [];
  final _allergyCtrl     = TextEditingController();

  final _bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;

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
      backgroundColor: const Color(0xFF0A0E1A),
      appBar: AppBar(
        title: Text('Setup Profile', style: GoogleFonts.inter(fontWeight: FontWeight.w700)),
        automaticallyImplyLeading: false,
      ),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Your medical profile helps responders provide better care', style: GoogleFonts.inter(fontSize: 13, color: const Color(0xFF94A3B8), height: 1.4)),
              const SizedBox(height: 24),

              _field('Full Name', _nameCtrl, hint: 'John Doe'),
              const SizedBox(height: 16),
              _field('Phone Number', _phoneCtrl, hint: '+91 XXXXX XXXXX', keyboardType: TextInputType.phone),
              const SizedBox(height: 16),
              _field('Emergency Contact', _emergencyCtrl, hint: '+91 XXXXX XXXXX', keyboardType: TextInputType.phone),
              const SizedBox(height: 16),

              // Age
              Text('Age', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: const Color(0xFF94A3B8))),
              const SizedBox(height: 8),
              Slider(
                value: _age.toDouble(),
                min: 1, max: 100,
                divisions: 99,
                activeColor: const Color(0xFFEF4444),
                label: '$_age years',
                onChanged: (v) => setState(() => _age = v.round()),
              ),

              const SizedBox(height: 16),

              // Blood Group
              Text('Blood Group', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: const Color(0xFF94A3B8))),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: _bloodGroups.map((bg) => ChoiceChip(
                  label: Text(bg),
                  selected: _bloodGroup == bg,
                  onSelected: (_) => setState(() => _bloodGroup = bg),
                  selectedColor: const Color(0xFFEF4444),
                  backgroundColor: const Color(0xFF131D35),
                  labelStyle: GoogleFonts.inter(fontSize: 12, color: _bloodGroup == bg ? Colors.white : const Color(0xFF94A3B8)),
                )).toList(),
              ),

              const SizedBox(height: 16),

              // Gender
              Text('Gender', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: const Color(0xFF94A3B8))),
              const SizedBox(height: 8),
              Row(
                children: ['MALE', 'FEMALE', 'OTHER'].map((g) => Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(g, style: GoogleFonts.inter(fontSize: 11)),
                      selected: _gender == g,
                      onSelected: (_) => setState(() => _gender = g),
                      selectedColor: const Color(0xFFEF4444),
                      backgroundColor: const Color(0xFF131D35),
                    ),
                  ),
                )).toList(),
              ),

              const SizedBox(height: 32),

              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  onPressed: _save,
                  child: Text('Save & Continue', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700)),
                ),
              ),

              const SizedBox(height: 12),

              Center(
                child: TextButton(
                  onPressed: () => Navigator.pushReplacementNamed(context, '/home'),
                  child: Text('Skip for now', style: GoogleFonts.inter(fontSize: 13, color: const Color(0xFF475569))),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _field(String label, TextEditingController ctrl, {String? hint, TextInputType? keyboardType}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: const Color(0xFF94A3B8))),
        const SizedBox(height: 6),
        TextFormField(
          controller: ctrl,
          keyboardType: keyboardType,
          style: GoogleFonts.inter(fontSize: 14, color: Colors.white),
          decoration: InputDecoration(hintText: hint),
          validator: (v) => v == null || v.isEmpty ? 'Required' : null,
        ),
      ],
    );
  }
}
