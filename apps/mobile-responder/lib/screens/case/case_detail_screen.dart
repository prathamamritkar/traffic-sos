// Case Detail Screen — full victim profile + navigation trigger
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../dashboard/dashboard_screen.dart' show SosAlert;

class CaseDetailScreen extends StatelessWidget {
  const CaseDetailScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final alert = ModalRoute.of(context)!.settings.arguments as SosAlert;

    return Scaffold(
      backgroundColor: const Color(0xFF0A0E1A),
      appBar: AppBar(
        title: Text('Case ${alert.accidentId}', style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 14)),
        leading: const BackButton(),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Emergency banner
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFEF4444).withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFEF4444).withOpacity(0.4)),
              ),
              child: Column(
                children: [
                  const Text('🚨', style: TextStyle(fontSize: 40)),
                  const SizedBox(height: 8),
                  Text('CONFIRMED CRASH', style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w900, color: const Color(0xFFEF4444), letterSpacing: 1)),
                  Text(alert.accidentId, style: GoogleFonts.jetBrainsMono(fontSize: 12, color: const Color(0xFF94A3B8))),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // Medical profile
            _Section(title: '🩺 Medical Profile', children: [
              _Row('Blood Group', alert.bloodGroup, highlight: true),
              _Row('G-Force', '${alert.gForce.toStringAsFixed(1)}g', alert: alert.gForce > 5),
              _Row('ML Confidence', '${(alert.mlConfidence * 100).toStringAsFixed(0)}%'),
              _Row('Rollover', alert.rollover ? 'YES ⚠️' : 'No', alert: alert.rollover),
            ]),

            const SizedBox(height: 16),

            // Location
            _Section(title: '📍 Location', children: [
              _Row('Latitude', alert.lat.toStringAsFixed(6)),
              _Row('Longitude', alert.lng.toStringAsFixed(6)),
            ]),

            const SizedBox(height: 24),

            // Navigate button
            SizedBox(
              width: double.infinity,
              height: 56,
              child: ElevatedButton.icon(
                onPressed: () => Navigator.pushNamed(context, '/navigation', arguments: alert),
                icon: const Icon(Icons.navigation, size: 20),
                label: Text('START NAVIGATION', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w800, letterSpacing: 1)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF22C55E),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
              ),
            ),

            const SizedBox(height: 12),

            SizedBox(
              width: double.infinity,
              height: 48,
              child: OutlinedButton(
                onPressed: () => Navigator.pop(context),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF94A3B8),
                  side: const BorderSide(color: Color(0x14FFFFFF)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: Text('Decline Case', style: GoogleFonts.inter(fontSize: 13)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  final String title;
  final List<Widget> children;
  const _Section({required this.title, required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF131D35),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0x14FFFFFF)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w700, color: const Color(0xFF94A3B8), letterSpacing: 0.5)),
          const SizedBox(height: 12),
          ...children,
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  final String label, value;
  final bool highlight, alert;
  const _Row(this.label, this.value, {this.highlight = false, this.alert = false});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: GoogleFonts.inter(fontSize: 13, color: const Color(0xFF94A3B8))),
          Text(value, style: GoogleFonts.inter(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: alert ? const Color(0xFFEF4444) : highlight ? const Color(0xFFEF4444) : Colors.white,
            fontFamily: 'JetBrains Mono',
          )),
        ],
      ),
    );
  }
}
