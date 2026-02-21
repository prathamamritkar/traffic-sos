// ============================================================
// Profile Screen — View and Edit Medical Profile
// ============================================================
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../config/app_theme.dart';
import '../../models/rctf_models.dart';
import '../../services/offline_vault_service.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _vault = OfflineVaultService();
  bool _loading = true;
  MedicalProfile? _profile;

  // Controllers
  final _ageCtrl = TextEditingController();
  final _bloodCtrl = TextEditingController(); // Basic dropdown or text
  final _allergyCtrl = TextEditingController();
  final _medsCtrl = TextEditingController();
  final _conditionsCtrl = TextEditingController();

  // Basic lists
  List<String> _allergies = [];
  List<String> _medications = [];
  List<String> _conditions = [];

  String _gender = 'Other';
  String _bloodGroup = 'O+';
  static const _bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  static const _genders = ['Male', 'Female', 'Other'];

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    final profile = await _vault.getMedicalProfile();
    if (mounted) {
      setState(() {
        _profile = profile;
        _loading = false;
        if (profile != null) {
          _ageCtrl.text = profile.age.toString();
          _bloodGroup = profile.bloodGroup;
          _gender = profile.gender;
          _allergies = List.from(profile.allergies);
          _medications = List.from(profile.medications);
          _conditions = List.from(profile.conditions);
        }
      });
    }
  }

  Future<void> _saveProfile() async {
    if (_profile == null) return;

    final newProfile = MedicalProfile(
      bloodGroup: _bloodGroup,
      age: int.tryParse(_ageCtrl.text) ?? 25,
      gender: _gender,
      allergies: _allergies,
      medications: _medications,
      conditions: _conditions,
      emergencyContacts: _profile!.emergencyContacts, // Preserve contacts
    );

    await _vault.saveMedicalProfile(newProfile);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profile updated successfully')),
      );
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        backgroundColor: AppColors.bg1,
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.bg1,
      appBar: AppBar(
        title: Text('Medical Profile', style: GoogleFonts.inter(fontWeight: FontWeight.w700)),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.save_rounded, color: AppColors.primary),
            onPressed: _saveProfile,
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildSectionHeader('Personal Info'),
            const SizedBox(height: 16),
            _buildAgeGenderRow(),
            const SizedBox(height: 24),
            
            _buildSectionHeader('Medical Details'),
            const SizedBox(height: 16),
            _buildBloodGroupSelector(),
            const SizedBox(height: 24),
            
            _buildChipList('Allergies', _allergies, _allergyCtrl, 'Add allergy...'),
            const SizedBox(height: 24),
            
            _buildChipList('Medications', _medications, _medsCtrl, 'Add medication...'),
            const SizedBox(height: 24),

            _buildChipList('Medical Conditions', _conditions, _conditionsCtrl, 'Add condition...'),
            const SizedBox(height: 32),

            _buildEmergencyContactsLink(),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Text(
      title,
      style: GoogleFonts.inter(
        fontSize: 18,
        fontWeight: FontWeight.w800,
        color: AppColors.textPrimary,
      ),
    );
  }

  Widget _buildAgeGenderRow() {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Age', style: GoogleFonts.inter(color: AppColors.textSecondary, fontSize: 13, fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              TextField(
                controller: _ageCtrl,
                keyboardType: TextInputType.number,
                style: GoogleFonts.inter(color: AppColors.textPrimary),
                decoration: InputDecoration(
                  filled: true,
                  fillColor: AppColors.bg2,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Gender', style: GoogleFonts.inter(color: AppColors.textSecondary, fontSize: 13, fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                initialValue: _genders.contains(_gender) ? _gender : 'Other',
                items: _genders.map((g) => DropdownMenuItem(value: g, child: Text(g))).toList(),
                onChanged: (v) => setState(() => _gender = v!),
                dropdownColor: AppColors.bg3,
                style: GoogleFonts.inter(color: AppColors.textPrimary),
                decoration: InputDecoration(
                  filled: true,
                  fillColor: AppColors.bg2,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildBloodGroupSelector() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Blood Group', style: GoogleFonts.inter(color: AppColors.textSecondary, fontSize: 13, fontWeight: FontWeight.w600)),
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
              selectedColor: AppColors.redSurface,
              labelStyle: TextStyle(color: selected ? AppColors.redCore : AppColors.textPrimary),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildChipList(String label, List<String> list, TextEditingController ctrl, String hint) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: GoogleFonts.inter(color: AppColors.textSecondary, fontSize: 13, fontWeight: FontWeight.w600)),
        const SizedBox(height: 10),
        if (list.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: list.map((item) => Chip(
                label: Text(item),
                deleteIcon: const Icon(Icons.close_rounded, size: 14),
                onDeleted: () => setState(() => list.remove(item)),
                backgroundColor: AppColors.bg2,
                labelStyle: GoogleFonts.inter(color: AppColors.textPrimary),
              )).toList(),
            ),
          ),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: ctrl,
                style: GoogleFonts.inter(color: AppColors.textPrimary),
                decoration: InputDecoration(
                  hintText: hint,
                  filled: true,
                  fillColor: AppColors.bg2,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                ),
              ),
            ),
            const SizedBox(width: 8),
            IconButton.filled(
              onPressed: () {
                final val = ctrl.text.trim();
                if (val.isNotEmpty && !list.contains(val)) {
                  setState(() => list.add(val));
                  ctrl.clear();
                }
              },
              icon: const Icon(Icons.add),
              style: IconButton.styleFrom(
                backgroundColor: AppColors.bg3,
                foregroundColor: AppColors.textPrimary,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildEmergencyContactsLink() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.bg2,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.surfaceOutline),
      ),
      child: InkWell(
        onTap: () => Navigator.pushNamed(context, '/contacts'),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.safeGreen.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.contact_emergency_rounded, color: AppColors.safeGreen),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Emergency Contacts', style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 15, color: AppColors.textPrimary)),
                  Text('Manage people to notify', style: GoogleFonts.inter(color: AppColors.textSecondary, fontSize: 12)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
          ],
        ),
      ),
    );
  }
}
