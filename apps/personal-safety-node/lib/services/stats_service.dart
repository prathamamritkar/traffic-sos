// ============================================================
// StatsService — Mock dashboard statistics for demo analytics
// Provides real incident data matching dashboard INITIAL_CASES
// ============================================================
import 'package:flutter/foundation.dart';
import '../models/rctf_models.dart';

class SystemStats {
  final double avgGForce;      // Average G-force from recent crashes
  final double avgSpeed;       // Average speed (km/h)
  final int totalIncidents;    // Total incidents in system
  final int activeIncidents;   // Currently active incidents
  final int resolvedIncidents; // Resolved incidents
  final String systemStatus;   // Safe / Monitoring / Alert
  final double responseTime;   // Average response time (minutes)

  const SystemStats({
    required this.avgGForce,
    required this.avgSpeed,
    required this.totalIncidents,
    required this.activeIncidents,
    required this.resolvedIncidents,
    required this.systemStatus,
    required this.responseTime,
  });
}

class StatsService {
  static final StatsService _instance = StatsService._();
  factory StatsService() => _instance;
  StatsService._();

  // Mock dashboard data mirroring dashboard INITIAL_CASES
  static const List<Map<String, dynamic>> _mockIncidents = [
    {
      'accidentId': 'ACC-DMO-003',
      'status': 'DETECTED',
      'gForce': 3.2,
      'speedBefore': 40,
      'severity': 'MODERATE',
    },
    {
      'accidentId': 'ACC-DMO-001',
      'status': 'DISPATCHED',
      'gForce': 4.8,
      'speedBefore': 65,
      'severity': 'CRITICAL',
    },
    {
      'accidentId': 'ACC-DMO-002',
      'status': 'EN_ROUTE',
      'gForce': 5.2,
      'speedBefore': 55,
      'severity': 'HIGH',
    },
    {
      'accidentId': 'ACC-2026-X12J92',
      'status': 'RESOLVED',
      'gForce': 2.1,
      'speedBefore': 35,
      'severity': 'LOW',
    },
    {
      'accidentId': 'ACC-2026-L92K11',
      'status': 'RESOLVED',
      'gForce': 3.8,
      'speedBefore': 48,
      'severity': 'MEDIUM',
    },
  ];

  /// Load system statistics from dashboard mock data
  /// Returns instantly with pre-computed stats
  Future<SystemStats> loadSystemStats() async {
    // Simulate brief network latency for realism
    await Future.delayed(const Duration(milliseconds: 300));

    final totalIncidents = _mockIncidents.length;
    final activeIncidents = _mockIncidents
        .where((i) => ['DETECTED', 'DISPATCHED', 'EN_ROUTE'].contains(i['status']))
        .length;
    final resolvedIncidents = _mockIncidents
        .where((i) => i['status'] == 'RESOLVED')
        .length;

    // Calculate averages from real mock data
    double totalGForce = 0.0;
    double totalSpeed = 0.0;
    for (final incident in _mockIncidents) {
      totalGForce += (incident['gForce'] as num).toDouble();
      totalSpeed += (incident['speedBefore'] as num).toDouble();
    }

    final avgGForce = totalGForce / totalIncidents;
    final avgSpeed = totalSpeed / totalIncidents;

    // Determine system status based on active incidents
    String systemStatus = 'Safe';
    if (activeIncidents > 0) {
      systemStatus = 'Alert';
    }

    // Mock response time (11.4 minutes from dashboard analytics)
    const responseTime = 11.4;

    return SystemStats(
      avgGForce: double.parse(avgGForce.toStringAsFixed(1)),
      avgSpeed: double.parse(avgSpeed.toStringAsFixed(1)),
      totalIncidents: totalIncidents,
      activeIncidents: activeIncidents,
      resolvedIncidents: resolvedIncidents,
      systemStatus: systemStatus,
      responseTime: responseTime,
    );
  }

  /// Get formatted status indicator
  String getStatusIndicator(SystemStats stats) {
    if (stats.activeIncidents == 0) return 'Safe';
    if (stats.activeIncidents == 1) return 'Monitoring';
    return 'Alert';
  }

  /// Get color indicator for status
  /// Returns a color code string for UI (green, amber, red)
  String getStatusColor(SystemStats stats) {
    if (stats.activeIncidents == 0) return 'safe_green';
    if (stats.activeIncidents == 1) return 'warn_amber';
    return 'sos_red';
  }
}
