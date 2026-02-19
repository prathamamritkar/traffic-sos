// ============================================================
// Responder Dashboard — Incoming SOS alerts + accept/decline
// ============================================================
import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;

// Shared models (copy from user-app or use a shared package)
class SosAlert {
  final String accidentId;
  final double lat, lng;
  final String bloodGroup;
  final double gForce;
  final double mlConfidence;
  final bool rollover;
  final String status;
  final DateTime createdAt;

  const SosAlert({
    required this.accidentId,
    required this.lat,
    required this.lng,
    required this.bloodGroup,
    required this.gForce,
    required this.mlConfidence,
    required this.rollover,
    required this.status,
    required this.createdAt,
  });

  factory SosAlert.fromJson(Map<String, dynamic> json) {
    final loc = json['location'] as Map<String, dynamic>? ?? {};
    final mp  = json['medicalProfile'] as Map<String, dynamic>? ?? {};
    final m   = json['metrics'] as Map<String, dynamic>? ?? {};
    return SosAlert(
      accidentId:   json['accidentId'] as String? ?? 'UNKNOWN',
      lat:          (loc['lat'] as num?)?.toDouble() ?? 18.5204,
      lng:          (loc['lng'] as num?)?.toDouble() ?? 73.8567,
      bloodGroup:   mp['bloodGroup'] as String? ?? 'O+',
      gForce:       (m['gForce'] as num?)?.toDouble() ?? 0,
      mlConfidence: (m['mlConfidence'] as num?)?.toDouble() ?? 0,
      rollover:     m['rolloverDetected'] as bool? ?? false,
      status:       json['status'] as String? ?? 'DETECTED',
      createdAt:    DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
    );
  }
}

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  List<SosAlert> _alerts = _demoAlerts();
  bool _available = true;
  Timer? _pollTimer;

  static List<SosAlert> _demoAlerts() => [
    SosAlert(
      accidentId:   'ACC-2026-DEMO1',
      lat:          18.5204,
      lng:          73.8567,
      bloodGroup:   'O+',
      gForce:       6.2,
      mlConfidence: 0.94,
      rollover:     false,
      status:       'DETECTED',
      createdAt:    DateTime.now().subtract(const Duration(minutes: 3)),
    ),
    SosAlert(
      accidentId:   'ACC-2026-DEMO2',
      lat:          18.5074,
      lng:          73.8077,
      bloodGroup:   'A+',
      gForce:       4.8,
      mlConfidence: 0.87,
      rollover:     true,
      status:       'DISPATCHED',
      createdAt:    DateTime.now().subtract(const Duration(minutes: 8)),
    ),
  ];

  @override
  void initState() {
    super.initState();
    _pollTimer = Timer.periodic(const Duration(seconds: 10), (_) => _pollAlerts());
  }

  Future<void> _pollAlerts() async {
    try {
      final response = await http.get(
        Uri.parse('http://localhost:3001/api/sos'),
        headers: {'Authorization': 'Bearer demo-token'},
      ).timeout(const Duration(seconds: 5));
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        final cases = data['payload']?['cases'] as List<dynamic>? ?? [];
        if (mounted) {
          setState(() => _alerts = cases.map((c) => SosAlert.fromJson(c as Map<String, dynamic>)).toList());
        }
      }
    } catch (_) { /* use demo data */ }
  }

  Future<void> _acceptCase(SosAlert alert) async {
    HapticFeedback.heavyImpact();
    Navigator.pushNamed(context, '/case', arguments: alert);
  }

  @override
  void dispose() { _pollTimer?.cancel(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final active = _alerts.where((a) => a.status == 'DETECTED' || a.status == 'DISPATCHED').toList();

    return Scaffold(
      backgroundColor: const Color(0xFF0A0E1A),
      appBar: AppBar(
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('🚑 ', style: TextStyle(fontSize: 20)),
            Text('Responder', style: GoogleFonts.inter(fontWeight: FontWeight.w800)),
          ],
        ),
        actions: [
          // Availability toggle
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: Row(
              children: [
                Text(_available ? 'ON DUTY' : 'OFF DUTY', style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w700, color: _available ? const Color(0xFF22C55E) : const Color(0xFF475569))),
                const SizedBox(width: 6),
                Switch(
                  value: _available,
                  onChanged: (v) => setState(() => _available = v),
                  activeColor: const Color(0xFF22C55E),
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
              ],
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          // Stats row
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            color: const Color(0xFF0F1629),
            child: Row(
              children: [
                _StatChip(label: 'Active', value: '${active.length}', color: const Color(0xFFEF4444)),
                const SizedBox(width: 12),
                _StatChip(label: 'Total', value: '${_alerts.length}', color: const Color(0xFF3B82F6)),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: _available ? const Color(0xFF22C55E).withOpacity(0.15) : const Color(0xFF475569).withOpacity(0.15),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: _available ? const Color(0xFF22C55E).withOpacity(0.4) : const Color(0xFF475569).withOpacity(0.4)),
                  ),
                  child: Row(
                    children: [
                      Container(width: 6, height: 6, decoration: BoxDecoration(shape: BoxShape.circle, color: _available ? const Color(0xFF22C55E) : const Color(0xFF475569))),
                      const SizedBox(width: 4),
                      Text(_available ? 'Available' : 'Unavailable', style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600, color: _available ? const Color(0xFF22C55E) : const Color(0xFF475569))),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Alert list
          Expanded(
            child: _alerts.isEmpty
                ? Center(child: Text('No active alerts', style: GoogleFonts.inter(color: const Color(0xFF475569))))
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _alerts.length,
                    itemBuilder: (_, i) => _AlertCard(
                      alert: _alerts[i],
                      onAccept: _available ? () => _acceptCase(_alerts[i]) : null,
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  final String label, value;
  final Color color;
  const _StatChip({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(value, style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w800, color: color)),
        const SizedBox(width: 4),
        Text(label, style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF94A3B8))),
      ],
    );
  }
}

class _AlertCard extends StatelessWidget {
  final SosAlert alert;
  final VoidCallback? onAccept;
  const _AlertCard({required this.alert, this.onAccept});

  @override
  Widget build(BuildContext context) {
    final isNew = alert.status == 'DETECTED';
    final elapsed = DateTime.now().difference(alert.createdAt);
    final mins = elapsed.inMinutes;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF131D35),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isNew ? const Color(0xFFEF4444).withOpacity(0.5) : const Color(0x14FFFFFF),
          width: isNew ? 1.5 : 1,
        ),
        boxShadow: isNew ? [BoxShadow(color: const Color(0xFFEF4444).withOpacity(0.1), blurRadius: 12, spreadRadius: 2)] : null,
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Row(
              children: [
                Text(isNew ? '🚨' : '📡', style: const TextStyle(fontSize: 20)),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(alert.accidentId, style: GoogleFonts.jetBrainsMono(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white)),
                      Text('${alert.lat.toStringAsFixed(4)}, ${alert.lng.toStringAsFixed(4)}', style: GoogleFonts.inter(fontSize: 11, color: const Color(0xFF94A3B8))),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: isNew ? const Color(0xFFEF4444).withOpacity(0.15) : const Color(0xFF3B82F6).withOpacity(0.15),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(alert.status, style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w700, color: isNew ? const Color(0xFFEF4444) : const Color(0xFF3B82F6))),
                    ),
                    const SizedBox(height: 4),
                    Text('${mins}m ago', style: GoogleFonts.inter(fontSize: 10, color: const Color(0xFF475569))),
                  ],
                ),
              ],
            ),

            const SizedBox(height: 12),
            const Divider(color: Color(0x14FFFFFF), height: 1),
            const SizedBox(height: 12),

            // Metrics
            Row(
              children: [
                _Metric(label: 'G-Force', value: '${alert.gForce.toStringAsFixed(1)}g', alert: alert.gForce > 5),
                _Metric(label: 'ML Conf', value: '${(alert.mlConfidence * 100).toStringAsFixed(0)}%'),
                _Metric(label: 'Blood', value: alert.bloodGroup, highlight: true),
                if (alert.rollover) _Metric(label: 'Rollover', value: '⚠️ YES', alert: true),
              ],
            ),

            const SizedBox(height: 12),

            // Accept button
            if (onAccept != null)
              SizedBox(
                width: double.infinity,
                height: 44,
                child: ElevatedButton(
                  onPressed: onAccept,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: isNew ? const Color(0xFFEF4444) : const Color(0xFF3B82F6),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: Text(
                    isNew ? '🚑  ACCEPT CASE' : 'VIEW CASE',
                    style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w800, letterSpacing: 0.5),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  final String label, value;
  final bool alert, highlight;
  const _Metric({required this.label, required this.value, this.alert = false, this.highlight = false});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(value, style: GoogleFonts.inter(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: alert ? const Color(0xFFEF4444) : highlight ? const Color(0xFFEF4444) : Colors.white,
          )),
          Text(label, style: GoogleFonts.inter(fontSize: 10, color: const Color(0xFF94A3B8))),
        ],
      ),
    );
  }
}
