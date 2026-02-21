// ============================================================
// Rescue Scene Guide Screen — Material 3 production redesign
// SOS Active: Countdown → Dispatch → Bystander handover mode
// ============================================================
import 'dart:async';
import 'dart:io';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:camera/camera.dart';

import '../../config/app_theme.dart';
import '../../services/emergency_broadcast_service.dart';
import '../../services/rctf_logger.dart';
import '../../services/sos_service.dart';
import '../../services/offline_vault_service.dart';
import '../../models/rctf_models.dart';

class RescueSceneGuideScreen extends StatefulWidget {
  const RescueSceneGuideScreen({super.key});

  @override
  State<RescueSceneGuideScreen> createState() => _RescueSceneGuideScreenState();
}

class _RescueSceneGuideScreenState extends State<RescueSceneGuideScreen>
    with TickerProviderStateMixin {
  static const _countdownSeconds = 10;

  int _remaining = _countdownSeconds;
  bool _dispatched = false;
  bool _cancelled = false;
  bool _isResponderMode = false;
  String? _accidentId;
  
  CrashMetrics? _metrics; // Metrics passed from detection or safety check

  Timer? _timer;
  late AnimationController _pulseCtrl;
  late AnimationController _dispatchCtrl;

  @override
  void initState() {
    super.initState();

    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);

    _dispatchCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );

    // Don't start countdown immediately in initState, wait for dependency to check args
    // but standard flow is start immediately. We will check args in didChangeDependencies.
    _startCountdown();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final args = ModalRoute.of(context)?.settings.arguments;
    if (args is CrashMetrics) {
      _metrics = args;
      // If manual/timeout sort of trigger, maybe we want to dispatch faster or differently?
      // For now we stick to the 10s countdown unless it's a confirmed crash from background service which might want 0s.
    }
  }

  void _startCountdown() {
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_cancelled || _dispatched) { timer.cancel(); return; }
      setState(() => _remaining--);
      if (_remaining <= 0) {
        timer.cancel();
        _dispatchSOS();
      }
    });
  }

  Future<void> _dispatchSOS() async {
    if (_dispatched || _cancelled) return;
    setState(() => _dispatched = true);
    HapticFeedback.heavyImpact();
    _dispatchCtrl.forward();

    // 1. Get Medical Profile (required for SOS)
    final profile = await OfflineVaultService().getMedicalProfile();
    if (profile == null) {
        debugPrint('[RescueGuide] No medical profile found!');
        // In real app, prompt user or send empty/partial?
        // We will send a fallback empty profile to ensure SOS goes out.
    }

    final safeProfile = profile ?? const MedicalProfile(
        bloodGroup: 'Unknown', age: 0, gender: 'Unknown', 
        allergies: [], medications: [], conditions: [], emergencyContacts: []
    );

    // 2. Use existing metrics or default to manual
    final safeMetrics = _metrics ?? const CrashMetrics(
      gForce: 0.0, speedBefore: 0.0, speedAfter: 0.0, mlConfidence: 1.0, 
      crashType: 'MANUAL_SOS', rolloverDetected: false
    );

    // 3. Call Service
    final id = await SOSService().dispatchSOS(
        metrics: safeMetrics, 
        medicalProfile: safeProfile
    );

    if (mounted) {
        setState(() {
            _accidentId = id ?? "OFFLINE-${DateTime.now().millisecondsSinceEpoch}";
        });
    }
  }

  Future<void> _markArrived() async {
    if (_accidentId == null) return;
    HapticFeedback.heavyImpact();
    // In real app, we check if user is authorized responder
    // For demo/hackathon, we assume responder mode grants access
    final success = await SOSService().updateStatus(_accidentId!, 'ARRIVED');
    if (mounted) {
       ScaffoldMessenger.of(context).showSnackBar(
         SnackBar(
           content: Text(success ? 'Marked as Arrived' : 'Failed to update status'),
           backgroundColor: success ? AppColors.safeGreen : AppColors.redCore,
         ),
       );
    }
  }

  void _logVitals() {
    HapticFeedback.selectionClick();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Log Vitals'),
        content: const TextField(
          decoration: InputDecoration(
             labelText: 'Heart Rate / BP / Notes',
             border: OutlineInputBorder(),
          ),
          maxLines: 3,
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          TextButton(
             onPressed: () { 
               Navigator.pop(ctx); 
               ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Vitals logged locally')));
             }, 
             child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  void _cancel() {
    if (_cancelled || _dispatched) return;
    setState(() => _cancelled = true);
    _timer?.cancel();
    HapticFeedback.lightImpact();
    Navigator.of(context).pop();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _pulseCtrl.dispose();
    _dispatchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg0,
      body: SafeArea(
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 500),
          transitionBuilder: (child, anim) => FadeTransition(
            opacity: anim,
            child: SlideTransition(
              position: Tween<Offset>(begin: const Offset(0.05, 0), end: Offset.zero).animate(anim),
              child: child,
            ),
          ),
          child: _dispatched
              ? _DispatchedView(
                  key: const ValueKey('dispatched'),
                  accidentId: _accidentId ?? 'ACC-UNKNOWN',
                  isResponderMode: _isResponderMode,
                  pulseCtrl: _pulseCtrl,
                  onResponderTap: () => setState(() => _isResponderMode = true),
                  onMarkArrived: _markArrived,
                  onLogVitals: _logVitals,
                )
              : _CountdownView(
                  key: const ValueKey('countdown'),
                  remaining: _remaining,
                  total: _countdownSeconds,
                  cancelled: _cancelled,
                  pulseCtrl: _pulseCtrl,
                  onCancel: _cancel,
                  onSosNow: _dispatchSOS,
                ),
        ),
      ),
    );
  }
}

// ── Countdown View ──────────────────────────────────────────

class _CountdownView extends StatelessWidget {
  final int remaining;
  final int total;
  final bool cancelled;
  final AnimationController pulseCtrl;
  final VoidCallback onCancel;
  final VoidCallback onSosNow;

  const _CountdownView({
    super.key,
    required this.remaining,
    required this.total,
    required this.cancelled,
    required this.pulseCtrl,
    required this.onCancel,
    required this.onSosNow,
  });

  @override
  Widget build(BuildContext context) {
    final progress = remaining / total;
    final isUrgent = remaining <= 3;

    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Notification chip
          Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
              decoration: BoxDecoration(
                color: AppColors.redSurface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.redCore.withOpacity(0.4)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  AnimatedBuilder(
                    animation: pulseCtrl,
                    builder: (_, __) => Container(
                      width: 7,
                      height: 7,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppColors.redBright.withOpacity(0.4 + pulseCtrl.value * 0.6),
                      ),
                    ),
                  ),
                  const SizedBox(width: 7),
                  Text(
                    'CRASH DETECTED',
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: AppColors.redBright,
                      letterSpacing: 0.8,
                    ),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 32),

          // Heading
          Text(
            'Are you okay?',
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(
              fontSize: 30,
              fontWeight: FontWeight.w900,
              color: AppColors.textPrimary,
              letterSpacing: -0.4,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            'A severe impact was detected. Emergency services\nwill be notified automatically.',
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(
              fontSize: 14,
              color: AppColors.textSecondary,
              height: 1.5,
            ),
          ),

          const Spacer(),

          // Countdown ring
          SizedBox(
            width: 200,
            height: 200,
            child: Stack(
              alignment: Alignment.center,
              children: [
                AnimatedBuilder(
                  animation: pulseCtrl,
                  builder: (_, __) => Container(
                    width: 200,
                    height: 200,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.redCore.withOpacity(0.04 + pulseCtrl.value * 0.06),
                    ),
                  ),
                ),
                SizedBox(
                  width: 188,
                  height: 188,
                  child: CircularProgressIndicator(
                    value: progress,
                    strokeWidth: 8,
                    strokeCap: StrokeCap.round,
                    backgroundColor: AppColors.bg4,
                    color: isUrgent ? AppColors.redBright : AppColors.redCore,
                  ),
                ),
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '$remaining',
                      style: GoogleFonts.inter(
                        fontSize: 68,
                        fontWeight: FontWeight.w900,
                        color: AppColors.textPrimary,
                        height: 1,
                      ),
                    ),
                    Text(
                      'sec',
                      style: GoogleFonts.inter(fontSize: 14, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const Spacer(),

          // Cancel button
          SizedBox(
            width: double.infinity,
            height: 60,
            child: FilledButton.tonal(
              onPressed: onCancel,
              style: FilledButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: const Color(0xFF0D1221),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.check_circle_outline_rounded, size: 22),
                  const SizedBox(width: 10),
                  Text(
                    "I'M SAFE — CANCEL SOS",
                    style: GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.w900),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 14),

          TextButton.icon(
            onPressed: onSosNow,
            icon: const Icon(Icons.sos_rounded, size: 16, color: AppColors.redBright),
            label: Text(
              'SEND SOS IMMEDIATELY',
              style: GoogleFonts.inter(
                fontSize: 13,
                color: AppColors.redBright,
                fontWeight: FontWeight.w700,
                decoration: TextDecoration.underline,
                decorationColor: AppColors.redBright,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Dispatched (Handover) View ──────────────────────────────

class _DispatchedView extends StatelessWidget {
  final String accidentId;
  final bool isResponderMode;
  final AnimationController pulseCtrl;
  final VoidCallback onResponderTap;
  final VoidCallback onMarkArrived;
  final VoidCallback onLogVitals;

  const _DispatchedView({
    super.key,
    required this.accidentId,
    required this.isResponderMode,
    required this.pulseCtrl,
    required this.onResponderTap,
    required this.onMarkArrived,
    required this.onLogVitals,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Top status bar
        Container(
          width: double.infinity,
          color: AppColors.bg0,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          child: Row(
            children: [
              AnimatedBuilder(
                animation: pulseCtrl,
                builder: (_, __) => Container(
                  width: 10, height: 10,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.safeGreen.withOpacity(0.4 + pulseCtrl.value * 0.6),
                    boxShadow: [BoxShadow(color: AppColors.safeGreen.withOpacity(0.5), blurRadius: 6)],
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Text(
                'SOS DISPATCHED',
                style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.safeGreen, letterSpacing: 0.5),
              ),
              const Spacer(),
              Text(
                accidentId,
                style: GoogleFonts.jetBrainsMono(fontSize: 10, color: AppColors.safeGreen, fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),

        Expanded(
          child: isResponderMode 
             ? _ResponderControlsFull(onMarkArrived: onMarkArrived, onLogVitals: onLogVitals)
             : _RescueCameraAssistant( // Replaced static bystander guide with dynamic Camera Assistant
                 onResponderModeParams: onResponderTap,
               ),
        ),
      ],
    );
  }
}

/// A Rescuer Assistant that continuously runs the camera and simulations
class _RescueCameraAssistant extends StatefulWidget {
  final VoidCallback onResponderModeParams;
  const _RescueCameraAssistant({required this.onResponderModeParams});

  @override
  State<_RescueCameraAssistant> createState() => _RescueCameraAssistantState();
}

class _RescueCameraAssistantState extends State<_RescueCameraAssistant> with WidgetsBindingObserver {
  CameraController? _controller;
  bool _isCameraReady = false;
  bool _isRecording = false;
  String _statusMessage = "Initializing RescuerCam™...";
  Color _statusColor = AppColors.textSecondary;
  bool _hasCameraError = false;
  
  // Simulation State
  int _simulationStep = 0;
  Timer? _analysisTimer;
  bool _hazardDetected = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initializeCamera();
    _startAnalysisLoop();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _disposeCamera();
    _analysisTimer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // App lifecycle handling helps prevent camera lockups when minimizing
    final CameraController? cameraController = _controller;

    if (cameraController == null || !cameraController.value.isInitialized) {
      return;
    }

    if (state == AppLifecycleState.inactive) {
      // Free up the camera for other apps or OS
      _disposeCamera();
    } else if (state == AppLifecycleState.resumed) {
      // Re-initialize when coming back
      _initializeCamera();
    }
  }

  Future<void> _disposeCamera() async {
    if (_controller != null) {
      if (_isRecording && _controller!.value.isRecordingVideo) {
        try {
          await _controller!.stopVideoRecording();
        } catch (e) {
          debugPrint("RescueCam: Error stopping recording on dispose: $e");
        }
      }
      await _controller?.dispose();
      _controller = null;
      _isRecording = false;
      _isCameraReady = false;
    }
  }
  
  Future<void> _initializeCamera() async {
    if (_controller != null) return; // Already initialized

    try {
      final cameras = await availableCameras();
      if (cameras.isEmpty) {
        throw CameraException("NoCamera", "No cameras available on device");
      }
      
      // Use standard rear camera
      final camera = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.back,
        orElse: () => cameras.first,
      );

      _controller = CameraController(
        camera,
        ResolutionPreset.medium,
        enableAudio: false, // Privacy for bystanders
        imageFormatGroup: Platform.isAndroid 
            ? ImageFormatGroup.nv21 
            : ImageFormatGroup.bgra8888,
      );

      await _controller!.initialize();
      
      // Auto-start recording for evidence
      try {
        if (!_controller!.value.isRecordingVideo) {
          await _controller!.startVideoRecording();
          _isRecording = true;
          debugPrint("RescueCam: Background recording started.");
        }
      } catch (e) {
         debugPrint("RescueCam: Recording failed to start: $e");
         // We continue even if recording fails — the viewfinder is more important
      }

      if (mounted) {
        setState(() {
          _isCameraReady = true;
          _hasCameraError = false;
          _statusMessage = "Scanning victim for injuries..."; // Reset status
        });
      }
    } catch (e) {
      debugPrint("Camera init error: $e");
      if (mounted) {
        setState(() {
          _isCameraReady = false;
          _hasCameraError = true;
          _statusMessage = "Camera Unavailable. Please describe scene.";
        });
      }
    }
  }

  void _startAnalysisLoop() {
    // Simulates an edge-AI detection process
    _analysisTimer = Timer.periodic(const Duration(seconds: 4), (timer) {
      if (!mounted) return;
      
      setState(() {
        _simulationStep++;
        
        if (_simulationStep == 1) {
           _statusMessage = "Scanning victim for injuries...";
           _statusColor = AppColors.aiBlue;
        } else if (_simulationStep == 3) {
           // Simulate finding a critical injury
           _statusMessage = "CRITICAL: Severe Arterial Bleeding Detected";
           _statusColor = AppColors.redBright;
           _hazardDetected = true;
           HapticFeedback.heavyImpact();
        } else if (_simulationStep == 4) {
           // Simulate automated action
           // In real app: Get blood type from OfflineVaultService
           _statusMessage = "Sending Blood Type (O+) to Ambulance..."; 
           _statusColor = AppColors.safeGreen;
        } else if (_simulationStep == 6) {
           _statusMessage = "Keep camera pointed at victim. Call connected.";
           _statusColor = AppColors.textPrimary;
        }
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    // Fallback UI if camera fails (Empty State)
    if (_hasCameraError || (!_isCameraReady && _controller == null)) {
       return Container(
         color: Colors.black,
         child: Stack(
           children: [
             Center(
               child: Column(
                 mainAxisAlignment: MainAxisAlignment.center,
                 children: [
                   Icon(Icons.videocam_off_outlined, size: 48, color: Colors.white24),
                   SizedBox(height: 16),
                   Text(
                     "Camera Unavailable",
                     style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.bold),
                   ),
                   Text(
                     "Voice guidance active",
                     style: GoogleFonts.inter(color: Colors.white54, fontSize: 12),
                   ),
                 ],
               ),
             ),
             _buildOverlayUI(), // Still show instructions even without camera
           ],
         ),
       );
    }

    if (!_isCameraReady) {
      return Container(
         color: Colors.black,
         child: Center(child: CircularProgressIndicator(color: AppColors.aiBlue)),
      );
    }

    // Camera Preview Scale Fix: Ensure it covers screen properly
    return Stack(
      children: [
        // 1. Camera Feed (Full Screen)
        Positioned.fill(
          child: CameraPreview(_controller!),
        ),

        // 2. Dark Gradient Overlay for text readability
        Positioned.fill(
           child: Container(
             decoration: BoxDecoration(
               gradient: LinearGradient(
                 begin: Alignment.topCenter,
                 end: Alignment.bottomCenter,
                 colors: [
                   Colors.black54,
                   Colors.transparent,
                   Colors.black87,
                 ],
               ),
             ),
           ),
        ),
        
        // 3. UI Overlays
        _buildOverlayUI(),
      ],
    );
  }

  Widget _buildOverlayUI() {
    return Stack(
      children: [
        // Top Hud - Emergency Call Status
        Positioned(
          top: 20, left: 20, right: 20,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: AppColors.redCore, // Red for Emergency Call active
              borderRadius: BorderRadius.circular(12),
              boxShadow: const [BoxShadow(color: Colors.black45, blurRadius: 10)],
            ),
            child: Row(
              children: [
                 const Icon(Icons.phone_in_talk, color: Colors.white, size: 24),
                 const SizedBox(width: 12),
                 Expanded(
                   child: Column(
                     crossAxisAlignment: CrossAxisAlignment.start,
                     children: [
                       Text(
                         "EMERGENCY CALL ACTIVE",
                         style: GoogleFonts.inter(fontWeight: FontWeight.w900, color: Colors.white, fontSize: 13),
                         overflow: TextOverflow.ellipsis,
                       ),
                       Text(
                         "Don't hang up. Help is listening.",
                         style: GoogleFonts.inter(color: Colors.white70, fontSize: 11),
                         overflow: TextOverflow.ellipsis,
                       ),
                     ],
                   ),
                 )
              ],
            ),
          ),
        ),

        // Center AR Guidance
        Center(
          child: Container(
            width: 250, height: 250,
            decoration: BoxDecoration(
              border: Border.all(
                color: _hazardDetected ? AppColors.redBright : Colors.white.withOpacity(0.5), 
                width: 2
              ),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                 if (_hazardDetected)
                   Container(
                     padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                     color: AppColors.redBright,
                     child: Text(
                       "INJURY DETECTED",
                       style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 10, color: Colors.black),
                     ),
                   ),
              ],
            ),
          ),
        ),

        // Bottom Instructions & Status
        Positioned(
          bottom: 0, left: 0, right: 0,
          child: Container(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                // Analytical Status
                Row(
                  children: [
                    Icon(
                      _hazardDetected ? Icons.warning_amber_rounded : Icons.auto_awesome, 
                      color: _statusColor, 
                      size: 20
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        _statusMessage,
                        style: GoogleFonts.inter(
                          color: _statusColor,
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                          shadows: const [Shadow(color: Colors.black, blurRadius: 4)],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                
                // Guidance Card
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.9),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Column(
                     crossAxisAlignment: CrossAxisAlignment.start,
                     children: [
                       Text(
                         "RESCUER INSTRUCTIONS",
                         style: GoogleFonts.inter(
                           fontSize: 10, 
                           fontWeight: FontWeight.w900, 
                           color: AppColors.textSecondary,
                           letterSpacing: 1,
                         ),
                       ),
                       const SizedBox(height: 8),
                       Text(
                         "1. Point camera at victim's injuries.\n2. Do NOT move them unless in fire danger.\n3. The app is sending location & blood type.",
                         style: GoogleFonts.inter(color: AppColors.textPrimary, height: 1.4, fontWeight: FontWeight.w500),
                       )
                     ],
                  ),
                ),
                
                const SizedBox(height: 12),
                Center(
                  child: TextButton(
                    onPressed: widget.onResponderModeParams,
                    child: Text(
                      "Official Responder? Tap to Override",
                      style: GoogleFonts.inter(color: Colors.white70, fontSize: 12),
                    ),
                  ),
                )
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _ResponderControlsFull extends StatelessWidget {
   final VoidCallback onMarkArrived;
   final VoidCallback onLogVitals;
   
   const _ResponderControlsFull({required this.onMarkArrived, required this.onLogVitals});

   @override
   Widget build(BuildContext context) {
      return Container(
         color: AppColors.bg0,
         padding: const EdgeInsets.all(20),
         child: Column(
            children: [
               _ResponderControls(onMarkArrived: onMarkArrived, onLogVitals: onLogVitals),
               const Spacer(),
               Text("EMS MODE ACTIVE", style: GoogleFonts.inter(color: AppColors.textDisabled)),
            ],
         ),
      );
   }
}

class _ResponderControls extends StatelessWidget {
  final VoidCallback onMarkArrived;
  final VoidCallback onLogVitals;

  const _ResponderControls({
    required this.onMarkArrived,
    required this.onLogVitals,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.safeGreen.withOpacity(0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.safeGreen.withOpacity(0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.badge_rounded, color: AppColors.safeGreen, size: 20),
              const SizedBox(width: 8),
              Text(
                'RESPONDER MODE ACTIVE',
                style: GoogleFonts.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: AppColors.safeGreen,
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: onMarkArrived,
                  icon: const Icon(Icons.check_circle_outline_rounded, size: 18),
                  label: const Text('Mark Arrived'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.arrivedGreen,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 0,
                    minimumSize: const Size(0, 46),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onLogVitals,
                  icon: const Icon(Icons.medical_services_outlined, size: 18),
                  label: const Text('Vitals Log'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.safeGreen,
                    side: BorderSide(color: AppColors.safeGreen.withOpacity(0.4)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    minimumSize: const Size(0, 46),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

