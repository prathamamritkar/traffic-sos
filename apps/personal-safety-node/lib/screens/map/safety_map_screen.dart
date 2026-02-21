// ============================================================
// Safety Map — Safe Routes & Risk Zones
// ============================================================
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../config/app_theme.dart';

class SafetyMapScreen extends StatefulWidget {
  const SafetyMapScreen({super.key});

  @override
  State<SafetyMapScreen> createState() => _SafetyMapScreenState();
}

class _SafetyMapScreenState extends State<SafetyMapScreen> {
  LatLng _center = const LatLng(18.5204, 73.8567); // Pune
  bool _loading = true;
  final MapController _mapController = MapController();

  @override
  void initState() {
    super.initState();
    _locateUser();
  }

  Future<void> _locateUser() async {
    try {
      final pos = await Geolocator.getCurrentPosition();
      if (mounted) {
        setState(() {
          _center = LatLng(pos.latitude, pos.longitude);
          _loading = false;
        });
        _mapController.move(_center, 14.0);
      }
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Safety Map', style: GoogleFonts.inter(fontWeight: FontWeight.w700)),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.my_location_rounded),
            onPressed: _locateUser,
          ),
        ],
      ),
      body: Stack(
        children: [
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _center,
              initialZoom: 13.0,
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.example.rescuedge',
                // Dark mode tiles would be better but standard OSM is free/easy
              ),
              
              // Mock Accident Hotspots
              CircleLayer(
                circles: [
                  CircleMarker(
                    point: const LatLng(18.5300, 73.8500),
                    color: AppColors.redCore.withOpacity(0.3),
                    borderStrokeWidth: 2,
                    borderColor: AppColors.redCore,
                    useRadiusInMeter: true,
                    radius: 500, // 500m danger zone
                  ),
                  CircleMarker(
                    point: const LatLng(18.5100, 73.8600),
                    color: AppColors.warnAmber.withOpacity(0.3),
                    borderStrokeWidth: 2,
                    borderColor: AppColors.warnAmber,
                    useRadiusInMeter: true,
                    radius: 300,
                  ),
                ],
              ),

              // User Marker
              MarkerLayer(
                markers: [
                  Marker(
                    point: _center,
                    width: 60,
                    height: 60,
                    child: const Icon(Icons.navigation_rounded, color: AppColors.aiBlue, size: 40),
                  ),
                ],
              ),
            ],
          ),
          
          if (_loading)
            const Center(child: CircularProgressIndicator()),

          // Legend
          Positioned(
            bottom: 30,
            left: 20,
            right: 20,
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.bg2.withOpacity(0.95),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.surfaceOutline),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                   Row(
                    children: [
                      Container(width: 12, height: 12, decoration: const BoxDecoration(color: AppColors.redCore, shape: BoxShape.circle)),
                      const SizedBox(width: 8),
                      Text('High Accident Zone', style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                    ],
                   ),
                   const SizedBox(height: 8),
                   Row(
                    children: [
                      Container(width: 12, height: 12, decoration: const BoxDecoration(color: AppColors.warnAmber, shape: BoxShape.circle)),
                      const SizedBox(width: 8),
                      Text('Moderate Risk Zone', style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                    ],
                   ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
