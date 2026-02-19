// ============================================================
// IntelligenceService — Gemini multimodal scene analysis
// Fixes:
//  • API key guard missing — calling Gemini with empty key crashes
//    with an unhelpful 400 error; now returns structured fallback
//  • JSON parsing: `text.split("```json")[1]` throws RangeError
//    if the model doesn't wrap in triple-backticks
//    → Use safer indexed access with fallback
//  • `analyzeAudio`: Gemini 1.5-flash accepts audio/mp4, audio/wav,
//    audio/ogg — NOT audio/mp3 as a DataPart MIME type
//    → Changed to audio/mp4 (m4a files produced by `record` package)
//  • Both methods rebuild a GenerativeModel on every call — moved to lazy init
// ============================================================
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:google_generative_ai/google_generative_ai.dart';

import '../config/app_config.dart';

class IntelligenceService {
  static final IntelligenceService _instance = IntelligenceService._();
  factory IntelligenceService() => _instance;
  IntelligenceService._();

  GenerativeModel? _model;

  GenerativeModel _getModel() {
    _model ??= GenerativeModel(
      model:  'gemini-1.5-flash',
      apiKey: AppConfig.geminiApiKey,
    );
    return _model!;
  }

  // ── Image Scene Analysis ───────────────────────────────────

  Future<Map<String, dynamic>> analyzeScene({required File imageFile}) async {
    if (AppConfig.geminiApiKey.isEmpty) {
      debugPrint('[IntelligenceService] Gemini API key not configured — using fallback');
      return _fallbackResponse();
    }

    try {
      final model      = _getModel();
      final prompt     = TextPart(_sceneAnalysisPrompt);
      final imageBytes = await imageFile.readAsBytes();

      final content = [
        Content.multi([prompt, DataPart('image/jpeg', imageBytes)]),
      ];

      final response = await model.generateContent(content);
      final text     = response.text;
      if (text == null || text.isEmpty) throw Exception('Empty response from analysis engine');

      return _extractJson(text);
    } catch (e) {
      debugPrint('[IntelligenceService] analyzeScene error: $e');
      return _fallbackResponse();
    }
  }

  // ── Audio Scene Analysis ───────────────────────────────────

  Future<Map<String, dynamic>> analyzeAudio({required File audioFile}) async {
    if (AppConfig.geminiApiKey.isEmpty) {
      debugPrint('[IntelligenceService] Gemini API key not configured — using fallback');
      return _audioFallback();
    }

    try {
      final model      = _getModel();
      final prompt     = TextPart(_audioAnalysisPrompt);
      final audioBytes = await audioFile.readAsBytes();

      // Gemini 1.5-flash supported audio MIME types: audio/mp4, audio/wav, audio/ogg
      // The `record` package produces .m4a files → audio/mp4 is correct
      final content = [
        Content.multi([prompt, DataPart('audio/mp4', audioBytes)]),
      ];

      final response = await model.generateContent(content);
      final text     = response.text;
      if (text == null || text.isEmpty) throw Exception('Empty response from audio analysis');

      return _extractJson(text);
    } catch (e) {
      debugPrint('[IntelligenceService] analyzeAudio error: $e');
      return _audioFallback();
    }
  }

  // ── Helpers ────────────────────────────────────────────────

  /// Safely extracts JSON from model output that may or may not be
  /// wrapped in ```json ... ``` fences. Guards against RangeError
  /// when split returns fewer segments than expected.
  Map<String, dynamic> _extractJson(String text) {
    try {
      String jsonString;
      if (text.contains('```json')) {
        final parts = text.split('```json');
        if (parts.length < 2) throw FormatException('Unexpected fencing');
        jsonString = parts[1].split('```').first.trim();
      } else if (text.contains('```')) {
        final parts = text.split('```');
        // Code fence without language tag: [before, content, after]
        jsonString = parts.length >= 2 ? parts[1].trim() : text.trim();
      } else {
        jsonString = text.trim();
      }

      return jsonDecode(jsonString) as Map<String, dynamic>;
    } catch (e) {
      debugPrint('[IntelligenceService] JSON parse error: $e');
      return _fallbackResponse();
    }
  }

  Map<String, dynamic> _fallbackResponse() => {
    'injurySeverity':      'UNKNOWN',
    'victimCount':         0,
    'visibleHazards':      ['Analysis unavailable — manual assessment required'],
    'recommendedServices': ['AMBULANCE'],
    'urgencyLevel':        'HIGH',
    'suggestedActions':    [
      'Perform manual field assessment',
      'Initiate secondary emergency protocols',
    ],
  };

  Map<String, dynamic> _audioFallback() => {
    'urgencyLevel':       'HIGH',
    'suggestedActions':   [
      'Provide immediate victim assistance',
      'Direct responders to scene',
    ],
  };

  static const _sceneAnalysisPrompt = '''
Conduct a comprehensive analysis of this emergency scene.
Output ONLY valid JSON — no markdown, no explanation:
{
  "injurySeverity": "CRITICAL|MODERATE|MINOR",
  "victimCount": <number>,
  "visibleHazards": ["hazard1", "hazard2"],
  "recommendedServices": ["AMBULANCE", "FIRE", "POLICE"],
  "urgencyLevel": "IMMEDIATE|HIGH|NORMAL",
  "suggestedActions": ["action1", "action2"]
}
If the situation is stable, provide a neutral situational assessment.
''';

  static const _audioAnalysisPrompt =
      'Detect distress patterns, injury indicators, and situational urgency from '
      'this emergency audio. Return ONLY valid JSON matching the scene analysis schema.';
}
