// ============================================================
// Notifications Screen — View alerts and updates
// ============================================================
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../config/app_theme.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    // Mock data for now
    final notifications = [
      {
        'title': 'Safety Check Complete',
        'body': 'You arrived safely. Timer stopped automatically.',
        'time': '2 mins ago',
        'icon': Icons.check_circle_outline,
        'color': AppColors.safeGreen,
      },
      {
        'title': 'Crash Detection Active',
        'body': 'RescuEdge is monitoring your journey.',
        'time': '1 hour ago',
        'icon': Icons.security_rounded,
        'color': AppColors.aiBlue,
      },
    ];

    return Scaffold(
      backgroundColor: AppColors.bg1,
      appBar: AppBar(
        title: Text('Notifications', style: GoogleFonts.inter(fontWeight: FontWeight.w700)),
        centerTitle: true,
      ),
      body: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: notifications.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (context, index) {
          final item = notifications[index];
          return Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.bg2,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.surfaceOutline),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: (item['color'] as Color).withOpacity(0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(item['icon'] as IconData, color: item['color'] as Color, size: 20),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(item['title'] as String, style: GoogleFonts.inter(fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                      const SizedBox(height: 4),
                      Text(
                        item['body'] as String,
                        style: GoogleFonts.inter(fontSize: 13, color: AppColors.textSecondary, height: 1.4),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        item['time'] as String,
                        style: GoogleFonts.inter(fontSize: 11, color: AppColors.textMuted),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
