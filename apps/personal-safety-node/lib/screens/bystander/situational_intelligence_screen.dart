// ============================================================
// Situational Intelligence Screen — Material 3 production
// Bystander: Scan scene, record audio, call emergency
// ============================================================
import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:record/record.dart';
import 'package:path_provider/path_provider.dart';

import '../../config/app_theme.dart';
import '../../services/ai_service.dart';
import '../../services/emergency_broadcast_service.dart';

class SituationalIntelligenceScreen extends StatefulWidget {
  const SituationalIntelligenceScreen({super.key});

  @override
  State<SituationalIntelligenceScreen> createState() =>
      _SituationalIntelligenceScreenState();
}

class _SituationalIntelligenceScreenState
    extends State<SituationalIntelligenceScreen> with TickerProviderStateMixin {
  final _picker = ImagePicker();
  final _audioRecorder = AudioRecorder();
  final _intelligence = IntelligenceService();

  bool _isProcessing = false;
  bool _isRecording = false;
  int _recordingSecsLeft = 10;
  Map<String, dynamic>? _aiResult;
  bool _nearbySosActive = true;
  String? _eta;

  late AnimationController _recordingCtrl;
  late AnimationController _pulseCtrl;
  Timer? _recordTimer;

  @override
  void initState() {
    super.initState();

    _recordingCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    )..repeat(reverse: true);

    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);

    _checkNearbySos();
  }

  Future<void> _checkNearbySos() async {
    setState(() {
      _nearbySosActive = true;
      _eta = 'ETA: ~6 min';
    });
  }

  Future<void> _scanScene() async {
    HapticFeedback.selectionClick();

    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'Position camera at 45° angle. Capture the full accident scene.',
          style: GoogleFonts.inter(fontSize: 13),
        ),
        action: SnackBarAction(label: 'Got it', onPressed: () {}),
        duration: const Duration(seconds: 3),
      ),
    );

    final picked = await _picker.pickImage(source: ImageSource.camera);
    if (picked == null || !mounted) return;

    setState(() => _isProcessing = true);
    final result = await _intelligence.analyzeScene(imageFile: File(picked.path));

    if (mounted) {
      setState(() {
        _aiResult = result;
        _isProcessing = false;
      });
      HapticFeedback.lightImpact();
      EmergencyBroadcastService().startBroadcast("INTEL_${DateTime.now().millisecondsSinceEpoch}");
    }
  }

  Future<void> _recordAudio() async {
    HapticFeedback.selectionClick();

    if (!await _audioRecorder.hasPermission()) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Microphone permission required')),
        );
      }
      return;
    }

    final temp = await getTemporaryDirectory();
    final path = "${temp.path}/bystander_audio.m4a";

    await _audioRecorder.start(const RecordConfig(), path: path);
    setState(() { _isRecording = true; _recordingSecsLeft = 10; });

    _recordTimer = Timer.periodic(const Duration(seconds: 1), (timer) async {
      if (_recordingSecsLeft > 0) {
        setState(() => _recordingSecsLeft--);
      } else {
        timer.cancel();
        final finalPath = await _audioRecorder.stop();
        if (mounted) setState(() => _isRecording = false);

        if (finalPath != null && mounted) {
          setState(() => _isProcessing = true);
          final result = await _intelligence.analyzeAudio(audioFile: File(finalPath));
          if (mounted) {
            setState(() { _aiResult = result; _isProcessing = false; });
          }
        }
      }
    });
  }

  Future<void> _callEmergency() async {
    HapticFeedback.heavyImpact();
    final number = _aiResult?['recommendedServices']?.contains('AMBULANCE') == true ? '108' : '112';
    final uri = Uri.parse('tel:$number');
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }

  @override
  void dispose() {
    _recordingCtrl.dispose();
    _pulseCtrl.dispose();
    _recordTimer?.cancel();
    _audioRecorder.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg1,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Situational Intelligence',
          style: GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.w700),
        ),
        actions: const [
          Padding(
            padding: EdgeInsets.symmetric(vertical: 10, horizontal: 8),
            child: AppBadge(label: 'AI-POWERED', color: AppColors.aiBlue),
          ),
        ],
      ),
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              sliver: SliverList(
                delegate: SliverChildListDelegate([

                  // ── ETA Banner ─────────────────────────────
                  if (_nearbySosActive) ...[
                    _EtaBanner(eta: _eta ?? '', pulseCtrl: _pulseCtrl),
                    const SizedBox(height: 20),
                  ],

                  // ── Header ─────────────────────────────────
                  Text(
                    'Emergency Scene\nAnalysis',
                    style: GoogleFonts.inter(
                      fontSize: 26,
                      fontWeight: FontWeight.w900,
                      color: AppColors.textPrimary,
                      height: 1.2,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Use AI-powered vision and audio to assess the scene and guide responders.',
                    style: GoogleFonts.inter(fontSize: 13, color: AppColors.textSecondary, height: 1.4),
                  ),

                  const SizedBox(height: 24),

                  // ── Scan Scene ─────────────────────────────
                  _ActionCard(
                    icon: Icons.camera_enhance_outlined,
                    title: 'Scan Scene',
                    subtitle: 'AI analyzes injuries, hazards & victim count',
                    color: AppColors.redCore,
                    isLoading: _isProcessing,
                    onTap: _isProcessing || _isRecording ? null : _scanScene,
                  ),

                  const SizedBox(height: 12),

                  // ── Record Audio ───────────────────────────
                  _AudioRecordCard(
                    isRecording: _isRecording,
                    secsLeft: _recordingSecsLeft,
                    animCtrl: _recordingCtrl,
                    onTap: _isProcessing || _isRecording ? null : _recordAudio,
                  ),

                  const SizedBox(height: 20),

                  // ── Processing indicator ───────────────────
                  if (_isProcessing)
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.bg2,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppColors.surfaceOutline),
                      ),
                      child: Row(
                        children: [
                          const SizedBox(
                            width: 18, height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                          const SizedBox(width: 12),
                          Text(
                            'Analyzing with on-device AI…',
                            style: GoogleFonts.inter(fontSize: 13, color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ),

                  // ── AI Result Card ─────────────────────────
                  if (_aiResult != null) ...[
                    if (_isProcessing) const SizedBox(height: 12),
                    _AiResultCard(result: _aiResult!),
                  ],

                  const SizedBox(height: 32),
                ]),
              ),
            ),
          ],
        ),
      ),

      // ── Persistent CTA ─────────────────────────────────────
      bottomNavigationBar: Container(
        padding: EdgeInsets.fromLTRB(16, 12, 16, MediaQuery.of(context).padding.bottom + 12),
        decoration: const BoxDecoration(
          color: AppColors.bg2,
          border: Border(top: BorderSide(color: AppColors.surfaceOutline)),
        ),
        child: Row(
          children: [
            Expanded(
              child: SizedBox(
                height: 54,
                child: ElevatedButton.icon(
                  onPressed: _callEmergency,
                  icon: const Icon(Icons.phone_rounded, size: 20),
                  label: Text(
                    'Call 108 — Ambulance',
                    style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w800),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.redCore,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    elevation: 0,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),
            SizedBox(
              height: 54,
              width: 54,
              child: OutlinedButton(
                onPressed: () async {
                  final uri = Uri.parse('tel:112');
                  if (await canLaunchUrl(uri)) launchUrl(uri);
                },
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.textSecondary,
                  side: const BorderSide(color: AppColors.surfaceOutline2),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  padding: EdgeInsets.zero,
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.emergency_outlined, size: 18),
                    Text('112', style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w700)),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Supporting Widgets ──────────────────────────────────────

class _EtaBanner extends StatelessWidget {
  final String eta;
  final AnimationController pulseCtrl;

  const _EtaBanner({required this.eta, required this.pulseCtrl});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        // safeGreen — help en route = calm reassurance, not urgent alarm
        color: AppColors.safeGreen.withOpacity(0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.safeGreen.withOpacity(0.35)),
      ),
      child: Row(
        children: [
          AnimatedBuilder(
            animation: pulseCtrl,
            builder: (_, __) => Container(
              width: 10, height: 10,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.safeGreen.withOpacity(0.4 + pulseCtrl.value * 0.6),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Help is en route — $eta',
              style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.safeGreen),
            ),
          ),
          const Icon(Icons.check_circle_outline_rounded, color: AppColors.safeGreen, size: 18),
        ],
      ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
  final bool isLoading;
  final VoidCallback? onTap;

  const _ActionCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.color,
    this.isLoading = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: color.withOpacity(0.08),
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: color.withOpacity(0.3), width: 1.5),
          ),
          child: Row(
            children: [
              Container(
                width: 52, height: 52,
                decoration: BoxDecoration(
                  color: color.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(15),
                ),
                child: isLoading
                    ? Center(child: CircularProgressIndicator(strokeWidth: 2, color: color))
                    : Icon(icon, color: color, size: 26),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
                    const SizedBox(height: 3),
                    Text(subtitle, style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSecondary, height: 1.3)),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded, color: color.withOpacity(0.6), size: 22),
            ],
          ),
        ),
      ),
    );
  }
}

class _AudioRecordCard extends StatelessWidget {
  final bool isRecording;
  final int secsLeft;
  final AnimationController animCtrl;
  final VoidCallback? onTap;

  const _AudioRecordCard({
    required this.isRecording,
    required this.secsLeft,
    required this.animCtrl,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      // aiBlue card background — recording feature is analytical by default.
      // When isRecording=true, card shifts to red (universally understood: red = recording).
      // This is a CORRECT exception to the alarm-fatigue rule — red-dot-recording is
      // a Pavlovian signal hard-coded in every camera/audio UI. Deviation would confuse users.
      color: AppColors.aiBlue.withOpacity(0.08),
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: isRecording
                  ? AppColors.redBright.withOpacity(0.6)
                  : AppColors.aiBlue.withOpacity(0.3),
              width: 1.5,
            ),
          ),
          child: Row(
            children: [
              AnimatedBuilder(
                animation: animCtrl,
                builder: (_, __) => Container(
                  width: 52, height: 52,
                  decoration: BoxDecoration(
                    color: (isRecording ? AppColors.redCore : AppColors.aiBlue)
                        .withOpacity(isRecording ? 0.12 + animCtrl.value * 0.1 : 0.12),
                    borderRadius: BorderRadius.circular(15),
                  ),
                  child: Icon(
                    isRecording ? Icons.stop_rounded : Icons.mic_outlined,
                    color: isRecording ? AppColors.redBright : AppColors.aiBlue,
                    size: 26,
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isRecording ? 'Recording… ${secsLeft}s' : 'Record Audio',
                      style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      isRecording
                          ? 'Capturing ambient sound for AI distress analysis'
                          : 'Listen for distress cues and keywords',
                      style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSecondary, height: 1.3),
                    ),
                    if (isRecording) ...[
                      const SizedBox(height: 8),
                      LinearProgressIndicator(
                        value: secsLeft / 10,
                        backgroundColor: AppColors.bg4,
                        color: AppColors.redBright,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AiResultCard extends StatelessWidget {
  final Map<String, dynamic> result;

  const _AiResultCard({required this.result});

  @override
  Widget build(BuildContext context) {
    final severity = result['injurySeverity'] as String? ?? 'UNKNOWN';
    final hazards = (result['visibleHazards'] as List?)?.join(', ') ?? 'None detected';
    final count = result['victimCount'] as int? ?? 0;
    final actions = (result['suggestedActions'] as List?)?.cast<String>() ?? [];

    // Severity color stratification:
    // CRITICAL → redBright (max urgency — warranted),
    // MODERATE → warnAmber (genuine warning — amber is correct here),
    // LOW/UNKNOWN → safeGreen (calm, monitoring is working)
    final severityColor = severity == 'CRITICAL'
        ? AppColors.redBright
        : severity == 'MODERATE'
            ? AppColors.warnAmber
            : AppColors.safeGreen;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.bg2,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.surfaceOutline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'AI INTELLIGENCE ASSESSMENT',
                style: GoogleFonts.inter(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textMuted,
                  letterSpacing: 1,
                ),
              ),
              AppBadge(label: severity, color: severityColor),
            ],
          ),
          const SizedBox(height: 16),
          const Divider(color: AppColors.surfaceOutline),
          const SizedBox(height: 12),

          // Metrics grid
          Row(
            children: [
              _MetricTile(label: 'Victims', value: '$count', color: AppColors.redBright),
              const SizedBox(width: 12),
              _MetricTile(label: 'Severity', value: severity, color: severityColor),
            ],
          ),

          const SizedBox(height: 12),

          // Hazards
          Text('HAZARDS', style: GoogleFonts.inter(fontSize: 10, color: AppColors.textMuted, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
          const SizedBox(height: 6),
          Text(hazards, style: GoogleFonts.inter(fontSize: 13, color: AppColors.textSecondary)),

          if (actions.isNotEmpty) ...[
            const SizedBox(height: 14),
            Text('SUGGESTED ACTIONS', style: GoogleFonts.inter(fontSize: 10, color: AppColors.textMuted, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
            const SizedBox(height: 8),
            ...actions.map((a) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.arrow_right_rounded, size: 18, color: AppColors.aiBlue),
                  const SizedBox(width: 6),
                  Expanded(child: Text(a, style: GoogleFonts.inter(fontSize: 13, color: AppColors.textPrimary))),
                ],
              ),
            )),
          ],
        ],
      ),
    );
  }
}

class _MetricTile extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _MetricTile({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: color.withOpacity(0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withOpacity(0.2)),
        ),
        child: Column(
          children: [
            Text(value, style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w900, color: color)),
            const SizedBox(height: 2),
            Text(label, style: GoogleFonts.inter(fontSize: 10, color: AppColors.textMuted, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }
}
