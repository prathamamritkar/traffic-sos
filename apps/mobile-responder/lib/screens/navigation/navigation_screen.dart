// Navigation Screen — flutter_map with live location sharing
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:geolocator/geolocator.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../dashboard/dashboard_screen.dart' show SosAlert;

class NavigationScreen extends StatefulWidget {
  const NavigationScreen({super.key});

  @override
  State<NavigationScreen> createState() => _NavigationScreenState();
}

class _NavigationScreenState extends State<NavigationScreen> {
  Position? _position;
  Timer? _locationTimer;
  final _mapController = MapController();
  bool _arrived = false;

  @override
  void initState() {
    super.initState();
    _startLocationSharing();
  }

  Future<void> _startLocationSharing() async {
    final permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      await Geolocator.requestPermission();
    }

    _locationTimer = Timer.periodic(const Duration(seconds: 3), (_) async {
      try {
        final pos = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
        if (mounted) setState(() => _position = pos);
        await _shareLocation(pos);
      } catch (_) {}
    });
  }

  Future<void> _shareLocation(Position pos) async {
    final alert = ModalRoute.of(context)?.settings.arguments as SosAlert?;
    if (alert == null) return;

    try {
      await http.post(
        Uri.parse('http://localhost:3001/api/track/location'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'entityId':   'RSP-DEMO-001',
          'entityType': 'AMBULANCE',
          'accidentId': alert.accidentId,
          'location': {
            'lat':     pos.latitude,
            'lng':     pos.longitude,
            'speed':   pos.speed,
            'heading': pos.heading,
          },
          'timestamp': DateTime.now().toIso8601String(),
        }),
      ).timeout(const Duration(seconds: 3));
    } catch (_) {}
  }

  @override
  void dispose() {
    _locationTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final alert = ModalRoute.of(context)!.settings.arguments as SosAlert;
    final destination = LatLng(alert.lat, alert.lng);
    final myPos = _position != null ? LatLng(_position!.latitude, _position!.longitude) : null;

    return Scaffold(
      backgroundColor: const Color(0xFF0A0E1A),
      appBar: AppBar(
        title: Text('En Route', style: GoogleFonts.inter(fontWeight: FontWeight.w700)),
        leading: const BackButton(),
        actions: [
          if (!_arrived)
            TextButton(
              onPressed: () => setState(() => _arrived = true),
              child: Text('ARRIVED', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w700, color: const Color(0xFF22C55E))),
            ),
        ],
      ),
      body: Stack(
        children: [
          // Map
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: destination,
              initialZoom: 14,
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
                subdomains: const ['a', 'b', 'c', 'd'],
              ),
              MarkerLayer(markers: [
                // Accident location
                Marker(
                  point: destination,
                  width: 48, height: 48,
                  child: Container(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: const Color(0xFFEF4444),
                      boxShadow: [BoxShadow(color: const Color(0xFFEF4444).withOpacity(0.6), blurRadius: 16, spreadRadius: 4)],
                    ),
                    child: const Center(child: Text('🚨', style: TextStyle(fontSize: 22))),
                  ),
                ),
                // My location
                if (myPos != null)
                  Marker(
                    point: myPos,
                    width: 40, height: 40,
                    child: Container(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: const Color(0xFF3B82F6),
                        boxShadow: [BoxShadow(color: const Color(0xFF3B82F6).withOpacity(0.6), blurRadius: 12, spreadRadius: 3)],
                      ),
                      child: const Center(child: Text('🚑', style: TextStyle(fontSize: 18))),
                    ),
                  ),
              ]),
            ],
          ),

          // Bottom info card
          Positioned(
            bottom: 0, left: 0, right: 0,
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: const BoxDecoration(
                color: Color(0xFF0F1629),
                borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      const Text('🎯', style: TextStyle(fontSize: 24)),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Accident Location', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white)),
                            Text('${alert.lat.toStringAsFixed(5)}, ${alert.lng.toStringAsFixed(5)}', style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF94A3B8))),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEF4444).withOpacity(0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text('BG: ${alert.bloodGroup}', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w800, color: const Color(0xFFEF4444))),
                      ),
                    ],
                  ),

                  if (_arrived) ...[
                    const SizedBox(height: 16),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFF22C55E).withOpacity(0.15),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFF22C55E).withOpacity(0.4)),
                      ),
                      child: Text('✅ Arrived at scene — location sharing active', style: GoogleFonts.inter(fontSize: 13, color: const Color(0xFF22C55E), fontWeight: FontWeight.w600), textAlign: TextAlign.center),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
