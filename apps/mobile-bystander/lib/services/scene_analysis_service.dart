// ============================================================
// Bystander Scene Intelligence Service
// Unified inference engine for multimodal situational analysis
// ============================================================
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../models/rctf_models.dart';
import '../config/app_config.dart';

class SceneAnalysisService {
  static final SceneAnalysisService _instance = SceneAnalysisService._();
  factory SceneAnalysisService() => _instance;
  SceneAnalysisService._();

  Future<SceneAnalysis> analyzeScene(File imageFile) async {
    try {
      // Primary inference path
      if (AppConfig.geminiApiKey.isNotEmpty) {
        return await _analyzeWithPrimaryEngine(imageFile);
      }
      // Secondary inference path
      return await _analyzeWithSecondaryEngine(imageFile);
    } catch (e) {
      debugPrint('[SceneAnalysis] Error: $e');
      return _fallbackAnalysis();
    }
  }

  Future<SceneAnalysis> _analyzeWithPrimaryEngine(File imageFile) async {
    final imageBytes  = await imageFile.readAsBytes();
    final base64Image = base64Encode(imageBytes);
    final mimeType    = imageFile.path.endsWith('.png') ? 'image/png' : 'image/jpeg';

    final prompt = '''
You are a situational intelligence engine. Analyze this emergency scene image and return ONLY valid JSON.

Return this exact JSON structure:
{
  "injurySeverity": "CRITICAL|HIGH|MEDIUM|LOW",
  "victimCount": <number>,
  "hazards": ["list of hazards"],
  "recommendedServices": ["AMBULANCE", "FIRE", "POLICE"],
  "urgency": "CRITICAL|HIGH|MEDIUM|LOW",
  "suggestedActions": ["action 1", "action 2"],
  "confidence": <0.0-1.0>,
  "rawDescription": "brief situational assessment"
}

Be precise. Field responders rely on this assessment.
''';

    final response = await http.post(
      Uri.parse(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${AppConfig.geminiApiKey}',
      ),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'contents': [
          {
            'parts': [
              {'text': prompt},
              {
                'inlineData': {
                  'mimeType': mimeType,
                  'data':     base64Image,
                },
              },
            ],
          },
        ],
        'generationConfig': {
          'temperature':     0.1,
          'maxOutputTokens': 512,
        },
      }),
    ).timeout(const Duration(seconds: 30));

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      final text = data['candidates']?[0]?['content']?['parts']?[0]?['text'] as String? ?? '';

      final jsonMatch = RegExp(r'\{[\s\S]*\}').firstMatch(text);
      if (jsonMatch != null) {
        final parsed = jsonDecode(jsonMatch.group(0)!) as Map<String, dynamic>;
        return SceneAnalysis.fromJson(parsed);
      }
    }

    throw Exception('Inference request failed: ${response.statusCode}');
  }

  Future<SceneAnalysis> _analyzeWithSecondaryEngine(File imageFile) async {
    final imageBytes = await imageFile.readAsBytes();

    final response = await http.post(
      Uri.parse('https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large'),
      headers: {
        'Content-Type':  'application/octet-stream',
        if (AppConfig.huggingFaceToken.isNotEmpty)
          'Authorization': 'Bearer ${AppConfig.huggingFaceToken}',
      },
      body: imageBytes,
    ).timeout(const Duration(seconds: 30));

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final caption = (data is List ? data[0]['generated_text'] : data['generated_text']) as String? ?? '';

      return _parseCaption(caption);
    }

    return _fallbackAnalysis();
  }

  SceneAnalysis _parseCaption(String caption) {
    final lower = caption.toLowerCase();
    final isCritical = lower.contains('crash') || lower.contains('accident') || lower.contains('injured');

    return SceneAnalysis(
      injurySeverity:      isCritical ? 'HIGH' : 'MEDIUM',
      victimCount:         1,
      hazards:             isCritical ? ['Structural damage', 'Obstacle detected'] : [],
      recommendedServices: ['AMBULANCE'],
      urgency:             isCritical ? 'HIGH' : 'MEDIUM',
      suggestedActions:    ['Relay location data', 'Maintain visual on victims', 'Avoid moving injured'],
      confidence:          0.65,
      rawDescription:      caption,
    );
  }

  SceneAnalysis _fallbackAnalysis() {
    return const SceneAnalysis(
      injurySeverity:      'HIGH',
      victimCount:         1,
      hazards:             ['Hazards unknown — proceed with caution'],
      recommendedServices: ['AMBULANCE'],
      urgency:             'HIGH',
      suggestedActions:    ['Responders dispatched', 'Secure perimeter', 'Ensure bystander safety'],
      confidence:          0.5,
      rawDescription:      'Digital situational assessment unavailable — manual review required',
    );
  }
}
