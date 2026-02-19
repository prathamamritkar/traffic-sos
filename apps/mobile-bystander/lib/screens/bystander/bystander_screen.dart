import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:geolocator/geolocator.dart';
import 'package:record/record.dart';
import 'package:path_provider/path_provider.dart';

import '../../models/rctf_models.dart';
import '../../services/ai_service.dart';
import '../../services/emergency_broadcast_service.dart';

class BystanderScreen extends StatefulWidget {
  const BystanderScreen({super.key});

  @override
  State<BystanderScreen> createState() => _BystanderScreenState();
}

class _BystanderScreenState extends State<BystanderScreen> {
  final _picker = ImagePicker();
  final _audioRecorder = AudioRecorder();
  final _intelligence = IntelligenceService();
  
  bool _isProcessing = false;
  Map<String, dynamic>? _aiResult;
  bool _nearbySosActive = false;
  String? _eta;

  @override
  void initState() {
    super.initState();
    _checkNearbySos();
  }

  Future<void> _checkNearbySos() async {
    // In a real app, this would query detection-service /api/sos/nearby
    // Simulated check:
    final pos = await Geolocator.getCurrentPosition();
    // Dummy condition for demo
    if (pos.latitude > 0) { 
      setState(() {
        _nearbySosActive = true;
        _eta = "4 minutes";
      });
    }
  }

  Future<void> _scanScene() async {
    final picked = await _picker.pickImage(source: ImageSource.camera);
    if (picked == null) return;

    setState(() => _isProcessing = true);
    
    final result = await _intelligence.analyzeScene(imageFile: File(picked.path));
    
    setState(() {
      _aiResult = result;
      _isProcessing = false;
    });

    // Upload to evidence stream legacy support
    // We use a dummy accidentId or fetch the nearby one
    EmergencyBroadcastService().startBroadcast("BYSTANDER_${DateTime.now().millisecondsSinceEpoch}");
  }

  Future<void> _recordAudio() async {
    if (await _audioRecorder.hasPermission()) {
      final temp = await getTemporaryDirectory();
      final path = "${temp.path}/bystander_audio.m4a";
      
      await _audioRecorder.start(const RecordConfig(), path: path);
      
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Recording 10s of ambient audio..."), duration: Duration(seconds: 10)),
      );

      await Future.delayed(const Duration(seconds: 10));
      final finalPath = await _audioRecorder.stop();
      
      if (finalPath != null) {
        setState(() => _isProcessing = true);
        final result = await _intelligence.analyzeAudio(audioFile: File(finalPath));
        setState(() {
          _aiResult = result;
          _isProcessing = false;
        });
      }
    }
  }

  Future<void> _callEmergency() async {
    final number = _aiResult?['recommendedServices']?.contains('AMBULANCE') ? '108' : '112';
    final uri = Uri.parse('tel:$number');
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0E1A),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                "EMERGENCY SCAN",
                style: GoogleFonts.inter(fontSize: 28, fontWeight: FontWeight.w900, color: Colors.white),
              ),
              const SizedBox(height: 8),
              Text(
                "Bystander Assistance Mode",
                style: GoogleFonts.inter(color: Colors.white70),
              ),
              
              const SizedBox(height: 32),
              
              if (_nearbySosActive)
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.green.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.green.withOpacity(0.5)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.check_circle, color: Colors.green),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          "HELP IS ON THE WAY. Responder ETA: $_eta",
                          style: const TextStyle(color: Colors.green, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                ),
                
              const SizedBox(height: 24),
              
              _buildBigButton(
                icon: Icons.camera_enhance,
                label: "SCAN SCENE",
                subLabel: "Analyze injuries & hazards",
                color: const Color(0xFFEF4444),
                onTap: _scanScene,
              ),
              
              const SizedBox(height: 16),
              
              _buildBigButton(
                icon: Icons.mic,
                label: "RECORD AUDIO",
                subLabel: "Listen for distress & keywords",
                color: const Color(0xFF3B82F6),
                onTap: _recordAudio,
              ),
              
              const Spacer(),
              
              if (_isProcessing)
                const Center(child: CircularProgressIndicator(color: Colors.red)),
                
              if (_aiResult != null)
                _buildAiAnalysisCard(),
              
              const Spacer(),
              
              SizedBox(
                height: 70,
                child: ElevatedButton.icon(
                  onPressed: _callEmergency,
                  icon: const Icon(Icons.phone_forwarded),
                  label: const Text("CALL EMERGENCY NOW", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: Colors.black,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBigButton({required IconData icon, required String label, required String subLabel, required Color color, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: color.withOpacity(0.4), width: 2),
        ),
        child: Row(
          children: [
            Icon(icon, size: 40, color: color),
            const SizedBox(width: 20),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Colors.white)),
                Text(subLabel, style: const TextStyle(color: Colors.white60, fontSize: 13)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAiAnalysisCard() {
    final severity = _aiResult?['injurySeverity'] ?? "UNKNOWN";
    final hazards = (_aiResult?['visibleHazards'] as List?)?.join(", ") ?? "None detected";
    final count = _aiResult?['victimCount'] ?? 0;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text("INTELLIGENCE ASSESSMENT", style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold, fontSize: 12)),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(color: Colors.red, borderRadius: BorderRadius.circular(4)),
                child: Text(severity, style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text("Victims: $count", style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Text("Hazards: $hazards", style: const TextStyle(color: Colors.white70, fontSize: 14)),
          const SizedBox(height: 12),
          const Text("SUGGESTED ACTIONS:", style: TextStyle(color: Colors.white38, fontSize: 10, fontWeight: FontWeight.bold)),
          ...(_aiResult?['suggestedActions'] as List? ?? []).map((a) => Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text("• $a", style: const TextStyle(color: Colors.white, fontSize: 14)),
          )),
        ],
      ),
    );
  }
}
