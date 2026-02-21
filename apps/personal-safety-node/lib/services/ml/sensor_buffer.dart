import 'dart:collection';
import 'dart:typed_data';

class SensorBuffer {
  final int capacity;
  final Queue<List<double>> _buffer;

  SensorBuffer({this.capacity = 50}) : _buffer = Queue<List<double>>();

  void add(double x, double y, double z) {
    if (_buffer.length >= capacity) {
      _buffer.removeFirst();
    }
    _buffer.add([x, y, z]);
  }

  /// Returns a flattened Float32List for TFLite inference.
  /// Format: [x1, y1, z1, x2, y2, z2, ...]
  Float32List getBufferAsFloat32List() {
    final List<double> flatList = [];
    for (var sample in _buffer) {
      flatList.addAll(sample);
    }
    // Pad with zeros if buffer is not full yet (handle early crashes)
    while (flatList.length < capacity * 3) {
      flatList.addAll([0.0, 0.0, 0.0]);
    }
    return Float32List.fromList(flatList);
  }
  
  /// Returns a Uint8List version if model expects byte buffer
  Uint8List getBufferAsUint8List() {
    return getBufferAsFloat32List().buffer.asUint8List();
  }

  bool get isFull => _buffer.length >= capacity;
  
  void clear() {
    _buffer.clear();
  }
}
