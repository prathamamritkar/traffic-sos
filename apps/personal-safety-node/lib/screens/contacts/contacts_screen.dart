// ============================================================
// Contacts Screen — Manage Emergency Contacts
// ============================================================
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../config/app_theme.dart';
import '../../models/rctf_models.dart';
import '../../services/offline_vault_service.dart';

class ContactsScreen extends StatefulWidget {
  const ContactsScreen({super.key});

  @override
  State<ContactsScreen> createState() => _ContactsScreenState();
}

class _ContactsScreenState extends State<ContactsScreen> {
  final _vault = OfflineVaultService();
  bool _loading = true;
  MedicalProfile? _profile;
  List<String> _contacts = [];
  final _phoneCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final profile = await _vault.getMedicalProfile();
    if (mounted) {
      setState(() {
        _profile = profile;
        _contacts = profile != null ? List.from(profile.emergencyContacts) : [];
        _loading = false;
      });
    }
  }

  Future<void> _addContact() async {
    final phone = _phoneCtrl.text.trim();
    if (phone.isEmpty || _contacts.contains(phone)) return;

    setState(() {
      _contacts.add(phone);
      _phoneCtrl.clear();
    });
    
    await _save();
  }

  Future<void> _removeContact(String phone) async {
    setState(() {
      _contacts.remove(phone);
    });
    await _save();
  }

  Future<void> _save() async {
    if (_profile == null) return;
    
    // Clone existing profile but update contacts
    final newProfile = MedicalProfile(
      bloodGroup: _profile!.bloodGroup,
      age: _profile!.age,
      gender: _profile!.gender,
      allergies: _profile!.allergies,
      medications: _profile!.medications,
      conditions: _profile!.conditions,
      emergencyContacts: _contacts,
    );

    await _vault.saveMedicalProfile(newProfile);
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
        title: Text('Emergency Contacts', style: GoogleFonts.inter(fontWeight: FontWeight.w700)),
        centerTitle: true,
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            // Info card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.safeGreen.withOpacity(0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.safeGreen.withOpacity(0.2)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.info_outline, color: AppColors.safeGreen),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'These contacts will be notified automatically via SMS/App notification when an SOS is triggered.',
                      style: GoogleFonts.inter(fontSize: 13, color: AppColors.safeGreen, height: 1.4),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Input
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _phoneCtrl,
                    keyboardType: TextInputType.phone,
                    style: GoogleFonts.inter(color: AppColors.textPrimary),
                    decoration: InputDecoration(
                      hintText: '+91 98765 43210',
                      filled: true,
                      fillColor: AppColors.bg2,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      prefixIcon: const Icon(Icons.phone_outlined, color: AppColors.textMuted),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                IconButton.filled(
                  onPressed: _addContact,
                  icon: const Icon(Icons.person_add_rounded),
                  style: IconButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: AppColors.onPrimary,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // List
            Expanded(
              child: _contacts.isEmpty
                  ? Center(
                      child: Text(
                        'No contacts added yet',
                        style: GoogleFonts.inter(color: AppColors.textMuted),
                      ),
                    )
                  : ListView.separated(
                      itemCount: _contacts.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (context, index) {
                        final phone = _contacts[index];
                        return Container(
                          decoration: BoxDecoration(
                            color: AppColors.bg2,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: AppColors.surfaceOutline),
                          ),
                          child: ListTile(
                            leading: const CircleAvatar(
                              backgroundColor: AppColors.bg3,
                              child: Icon(Icons.person, color: AppColors.textSecondary),
                            ),
                            title: Text(phone, style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                            trailing: IconButton(
                              icon: const Icon(Icons.delete_outline_rounded, color: AppColors.redCore),
                              onPressed: () => _removeContact(phone),
                            ),
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
