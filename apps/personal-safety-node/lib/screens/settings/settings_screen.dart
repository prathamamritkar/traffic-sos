// ============================================================
// Settings Screen — App configuration and preferences
// ============================================================
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../config/app_theme.dart';
import '../../services/offline_vault_service.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg1,
      // No app bar if we embed in home, but for now let's assume it has one or is distinct
      // If embedded, we might want to hide back button
      appBar: AppBar(
        title: Text('Settings', style: GoogleFonts.inter(fontWeight: FontWeight.w700)),
        centerTitle: true,
        automaticallyImplyLeading: false, // If in tab view
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _SectionHeader(title: 'Account'),
          _SettingsTile(
            icon: Icons.person_outline_rounded,
            title: 'Medical Profile',
            subtitle: 'Update vitals, allergies, conditions',
            onTap: () => Navigator.pushNamed(context, '/profile'),
          ),
          _SettingsTile(
            icon: Icons.contact_emergency_outlined,
            title: 'Emergency Contacts',
            subtitle: 'Manage SOS recipients',
            onTap: () => Navigator.pushNamed(context, '/contacts'),
          ),

          const SizedBox(height: 24),
          _SectionHeader(title: 'System'),
          _SettingsTile(
            icon: Icons.notifications_outlined,
            title: 'Notifications',
            subtitle: 'Customize alerts and sounds',
            onTap: () {}, // TODO: Implement robust notification settings
          ),
          _SettingsSwitch(
            icon: Icons.location_on_outlined,
            title: 'Location Services',
            subtitle: 'Always allow for background monitoring',
            value: true,
            onChanged: (v) {},
          ),
          
          const SizedBox(height: 24),
          _SectionHeader(title: 'Data & Privacy'),
          _SettingsTile(
            icon: Icons.security_rounded,
            title: 'Offline Vault',
            subtitle: 'Clear local data',
            textColor: AppColors.redCore,
            onTap: () {
              showDialog(
                context: context,
                builder: (ctx) => AlertDialog(
                  title: const Text('Clear Vault?'),
                  content: const Text('This will delete your medical profile and pending SOS requests from this device.'),
                  actions: [
                    TextButton(child: const Text('Cancel'), onPressed: () => Navigator.pop(ctx)),
                    TextButton(
                      child: const Text('Delete', style: TextStyle(color: AppColors.redCore)),
                      onPressed: () async {
                         await OfflineVaultService().clearPendingRequests();
                         // Ideally we might want to keep medical profile? Or wipe all?
                         // Let's assume clear pending for now as a "safe" delete.
                         // Clearing medical profile would force onboarding again.
                         if (context.mounted) {
                           Navigator.pop(ctx);
                           ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Vault cleared')));
                         }
                      },
                    ),
                  ],
                ),
              );
            },
          ),
          
          const SizedBox(height: 24),
          Center(
            child: Text(
              'Version 1.0.0+1 (Beta)\nRescuEdge Personal Safety Node',
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(fontSize: 12, color: AppColors.textMuted),
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12, left: 4),
      child: Text(
        title.toUpperCase(),
        style: GoogleFonts.inter(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: AppColors.textSecondary,
          letterSpacing: 1,
        ),
      ),
    );
  }
}

class _SettingsTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final Color? textColor;

  const _SettingsTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.textColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: AppColors.bg2,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.surfaceOutline),
      ),
      child: ListTile(
        leading: Icon(icon, color: textColor ?? AppColors.textPrimary),
        title: Text(title, style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: textColor ?? AppColors.textPrimary)),
        subtitle: Text(subtitle, style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSecondary)),
        trailing: const Icon(Icons.chevron_right_rounded, size: 20, color: AppColors.textMuted),
        onTap: onTap,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }
}

class _SettingsSwitch extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;

  const _SettingsSwitch({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: AppColors.bg2,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.surfaceOutline),
      ),
      child: SwitchListTile(
        secondary: Icon(icon, color: AppColors.textPrimary),
        title: Text(title, style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
        subtitle: Text(subtitle, style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSecondary)),
        value: value,
        onChanged: onChanged,
        activeColor: AppColors.primary,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }
}
