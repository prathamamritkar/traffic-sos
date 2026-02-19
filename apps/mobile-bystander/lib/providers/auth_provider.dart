// Auth provider using Riverpod
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/rctf_models.dart';
import '../services/auth_service.dart';

final authProvider = StateNotifierProvider<AuthNotifier, RCTFAuth?>(
  (ref) => AuthNotifier(),
);

class AuthNotifier extends StateNotifier<RCTFAuth?> {
  AuthNotifier() : super(null) {
    _restore();
  }

  Future<void> _restore() async {
    final auth = await AuthService().restoreSession();
    state = auth;
  }

  Future<bool> signInWithGoogle() async {
    final auth = await AuthService().signInWithGoogle();
    state = auth;
    return auth != null;
  }

  Future<void> signInDemo() async {
    final auth = await AuthService().signInDemo();
    state = auth;
  }

  Future<void> signOut() async {
    await AuthService().signOut();
    state = null;
  }
}
