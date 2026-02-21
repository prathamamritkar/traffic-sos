// ============================================================
// Auth Service — Google Sign-In + Phone OTP
// ============================================================
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../models/rctf_models.dart';

class AuthService {
  static final AuthService _instance = AuthService._();
  factory AuthService() => _instance;
  AuthService._();

  final _googleSignIn = GoogleSignIn(scopes: ['email', 'profile']);
  late final FirebaseAuth _firebaseAuth;
  final _storage      = const FlutterSecureStorage();

  RCTFAuth? _currentAuth;
  RCTFAuth? get currentAuth => _currentAuth;

  bool get isAuthenticated => _currentAuth != null;

  /// Initializes Firebase Auth lazily (safe for demo mode without Firebase)
  void _ensureFirebaseInitialized() {
    try {
      _firebaseAuth = FirebaseAuth.instance;
    } catch (e) {
      debugPrint('[AuthService] Firebase not initialized: $e');
      // In demo mode, Firebase won't be available
      rethrow;
    }
  }

  // ── Google Sign-In ────────────────────────────────────────
  Future<RCTFAuth?> signInWithGoogle() async {
    try {
      _ensureFirebaseInitialized();
      final googleUser = await _googleSignIn.signIn();
      if (googleUser == null) return null;

      final googleAuth = await googleUser.authentication;
      final credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken:     googleAuth.idToken,
      );

      final userCredential = await _firebaseAuth.signInWithCredential(credential);
      final user           = userCredential.user;
      if (user == null) return null;

      final token = await user.getIdToken() ?? '';
      final auth  = RCTFAuth(
        userId: 'U-${user.uid.toUpperCase()}',
        role:   'USER',
        token:  token,
      );

      _currentAuth = auth;
      await _persistAuth(auth);
      return auth;
    } catch (e) {
      debugPrint('[AuthService] Google sign-in error: $e');
      return null;
    }
  }

  // ── Phone OTP ─────────────────────────────────────────────
  Future<void> sendOTP(String phoneNumber, {
    required Function(String verificationId) onCodeSent,
    required Function(String error) onError,
  }) async {
    try {
      await _firebaseAuth.verifyPhoneNumber(
        phoneNumber:          phoneNumber,
        timeout:              const Duration(seconds: 60),
        verificationCompleted: (credential) async {
          await _firebaseAuth.signInWithCredential(credential);
        },
        verificationFailed: (e) => onError(e.message ?? 'Verification failed'),
        codeSent:           (verificationId, _) => onCodeSent(verificationId),
        codeAutoRetrievalTimeout: (_) {},
      );
    } catch (e) {
      onError(e.toString());
    }
  }

  Future<RCTFAuth?> verifyOTP(String verificationId, String smsCode) async {
    try {
      final credential = PhoneAuthProvider.credential(
        verificationId: verificationId,
        smsCode:        smsCode,
      );
      final userCredential = await _firebaseAuth.signInWithCredential(credential);
      final user           = userCredential.user;
      if (user == null) return null;

      final token = await user.getIdToken() ?? '';
      final auth  = RCTFAuth(
        userId: 'U-${user.uid.toUpperCase()}',
        role:   'USER',
        token:  token,
      );

      _currentAuth = auth;
      await _persistAuth(auth);
      return auth;
    } catch (e) {
      debugPrint('[AuthService] OTP verify error: $e');
      return null;
    }
  }

  // ── Demo auth (for hackathon demo without Firebase) ───────
  Future<RCTFAuth> signInDemo({String role = 'USER'}) async {
    final auth = RCTFAuth(
      userId: 'U-DEMO-${DateTime.now().millisecondsSinceEpoch.toString().substring(8)}',
      role:   role,
      token:  'demo-token-${DateTime.now().millisecondsSinceEpoch}',
    );
    _currentAuth = auth;
    await _persistAuth(auth);
    return auth;
  }

  Future<void> signOut() async {
    await _googleSignIn.signOut();
    await _firebaseAuth.signOut();
    await _storage.delete(key: 'rctf_auth');
    _currentAuth = null;
  }

  Future<RCTFAuth?> restoreSession() async {
    try {
      final stored = await _storage.read(key: 'rctf_auth');
      if (stored == null) return null;
      final json = jsonDecode(stored) as Map<String, dynamic>;
      _currentAuth = RCTFAuth(
        userId: json['userId'] as String,
        role:   json['role'] as String,
        token:  json['token'] as String,
      );
      return _currentAuth;
    } catch (_) { return null; }
  }

  Future<void> _persistAuth(RCTFAuth auth) async {
    await _storage.write(
      key:   'rctf_auth',
      value: jsonEncode(auth.toJson()),
    );
  }
}
