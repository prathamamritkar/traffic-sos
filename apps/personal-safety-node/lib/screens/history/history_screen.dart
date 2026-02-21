// ============================================================
// History Screen — Activity log of past SOS triggers
// ============================================================
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../config/app_theme.dart';
import '../../services/offline_vault_service.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  // Currently offline vault only stores pending requests, not a full history log.
  // We'll simulate history or use pending + some mock "resolved" ones.
  // In a real app we'd query backend for history or store locally.
  // For hackathon, we can just show "Recent Activations".
  
  List<Map<String, dynamic>> _history = [];

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    // 1. Get pending
    final pending = await OfflineVaultService().getPendingRequests();
    
    // 2. Mock resolved
    final resolved = [
      {
        'id': 'ACC-2024-TEST1',
        'status': 'RESOLVED',
        'timestamp': DateTime.now().subtract(const Duration(days: 2)).toIso8601String(),
        'type': 'MANUAL_SOS',
      },
      {
        'id': 'ACC-2024-TEST2',
        'status': 'CANCELLED',
        'timestamp': DateTime.now().subtract(const Duration(hours: 5)).toIso8601String(),
        'type': 'SAFETY_CHECK_TIMEOUT',
      },
    ];

    if (mounted) {
      setState(() {
        _history = [
          ...pending.map((p) {
             final meta = p['meta'] as Map<String, dynamic>;
             final payload = p['payload'] as Map<String, dynamic>;
             final metrics = payload['metrics'] as Map<String, dynamic>;
             return {
                'id': meta['requestId'],
                'status': 'PENDING',
                'timestamp': meta['timestamp'],
                'type': metrics['crashType'],
             };
          }),
          ...resolved,
        ];
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg1,
      appBar: AppBar(
        title: Text('Activity History', style: GoogleFonts.inter(fontWeight: FontWeight.w700)),
        centerTitle: true,
        automaticallyImplyLeading: false, 
      ),
      body: _history.isEmpty
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.history_toggle_off_rounded, size: 48, color: AppColors.textMuted),
                  const SizedBox(height: 16),
                  Text(
                    'No recent activity',
                    style: GoogleFonts.inter(fontSize: 16, color: AppColors.textSecondary),
                  ),
                ],
              ),
            )
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _history.length,
              itemBuilder: (context, index) {
                final item = _history[index];
                final status = item['status'] as String;
                final type = item['type'] as String;
                final time = DateTime.tryParse(item['timestamp'] as String) ?? DateTime.now();

                Color color;
                IconData icon;
                
                switch (status) {
                  case 'RESOLVED':
                    color = AppColors.safeGreen;
                    icon = Icons.check_circle_outline_rounded;
                    break;
                  case 'CANCELLED':
                    color = AppColors.textMuted; // or grey
                    icon = Icons.cancel_outlined;
                    break;
                  case 'PENDING':
                    color = AppColors.warnAmber;
                    icon = Icons.cloud_upload_outlined;
                    break;
                  default: // DETECTED etc
                    color = AppColors.redCore;
                    icon = Icons.warning_amber_rounded;
                }

                return Card(
                  elevation: 0,
                  margin: const EdgeInsets.only(bottom: 12),
                  color: AppColors.bg2,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16), 
                    side: const BorderSide(color: AppColors.surfaceOutline),
                  ),
                  child: ListTile(
                    leading: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: color.withOpacity(0.12),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(icon, color: color, size: 20),
                    ),
                    title: Text(
                      type.replaceAll('_', ' '),
                      style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 14),
                    ),
                    subtitle: Text(
                      '${item['id']}\n${time.toString().substring(0, 16)}',
                      style: GoogleFonts.inter(fontSize: 11, color: AppColors.textSecondary),
                    ),
                    trailing: AppBadge(label: status, color: color),
                  ),
                );
              },
            ),
    );
  }
}
