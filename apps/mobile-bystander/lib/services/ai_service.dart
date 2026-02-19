import 'dart:convert';
import 'dart:io';
import 'package:google_generative_ai/google_generative_ai.dart';
import '../config/app_config.dart';

class IntelligenceService {
  static final IntelligenceService _instance = IntelligenceService._();
  factory IntelligenceService() => _instance;
  IntelligenceService._();

  String get _apiKey => AppConfig.geminiApiKey;

  Future<Map<String, dynamic>> analyzeScene({required File imageFile}) async {
    final model = GenerativeModel(
      model: 'gemini-1.5-flash',
      apiKey: _apiKey,
    );

    final prompt = TextPart("""
      Conduct a comprehensive analysis of this emergency scene. Output a structured JSON response:
      {
        "injurySeverity": "CRITICAL|MODERATE|MINOR",
        "victimCount": number,
        "visibleHazards": ["hazard1", "hazard2"],
        "recommendedServices": ["AMBULANCE", "FIRE", "POLICE"],
        "urgencyLevel": "IMMEDIATE|HIGH|NORMAL",
        "suggestedActions": ["action1", "action2"]
      }
      If the situation is stable, provide a neutral situational assessment.
    """);

    final imageBytes = await imageFile.readAsBytes();
    final content = [
      Content.multi([
        prompt,
        DataPart('image/jpeg', imageBytes),
      ])
    ];

    try {
      final response = await model.generateContent(content);
      final text = response.text;
      if (text == null) throw Exception("Empty response from analysis engine");
      
      final jsonString = text.contains("```") 
          ? text.split("```json")[1].split("```")[0].trim()
          : text.trim();
          
      return jsonDecode(jsonString);
    } catch (e) {
      return {
        "injurySeverity": "UNKNOWN",
        "victimCount": 0,
        "visibleHazards": ["Processing error — manual review required"],
        "recommendedServices": ["AMBULANCE"],
        "urgencyLevel": "HIGH",
        "suggestedActions": ["Perform manual field assessment", "Initiate secondary emergency protocols"]
      };
    }
  }

  Future<Map<String, dynamic>> analyzeAudio({required File audioFile}) async {
    final model = GenerativeModel(
      model: 'gemini-1.5-flash',
      apiKey: _apiKey,
    );

    final prompt = TextPart("Process this emergency audio input. Detect distress patterns, injury indicators, and situational urgency. Return structured JSON as defined for the visual assessment.");

    final audioBytes = await audioFile.readAsBytes();
    final content = [
      Content.multi([
        prompt,
        DataPart('audio/mp3', audioBytes),
      ])
    ];

    try {
      final response = await model.generateContent(content);
      final text = response.text;
      if (text == null) throw Exception("Empty response from analysis engine");
      
      final jsonString = text.contains("```") 
          ? text.split("```json")[1].split("```")[0].trim()
          : text.trim();
          
      return jsonDecode(jsonString);
    } catch (e) {
      return {"urgencyLevel": "HIGH", "suggestedActions": ["Provide immediate victim assistance", "Direct responders to scene"]};
    }
  }
}
