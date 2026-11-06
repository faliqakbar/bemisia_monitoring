# Model Bemisia

Folder ini berisi model percobaan YOLO11n yang diekspor dari `best.pt` pengguna: `bemisia.onnx` dan metadata `model-info.json`. Kelas tunggal: `bemisia`. Versi awal: `bemisia-trial-v1` ditambah sidik jari SHA256 saat hasil disimpan.
Aktifkan ONNX di Settings. Model hilang, tidak kompatibel, atau inference gagal akan kembali ke Mock Detector dengan label SIMULATION MODE.
Untuk mengganti bobot, gunakan `scripts/export-model.py` dengan nama versi baru; script memasang kedua file sekaligus. Lihat `docs/MODEL_INTEGRATION.md`. Model dan WASM bukan bagian precache PWA agar pemasangan awal tetap ringan. Model percobaan belum divalidasi akurasinya pada foto lapangan.
