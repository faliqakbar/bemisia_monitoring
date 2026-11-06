# Integrasi YOLO11n → ONNX Runtime Web

Model training memakai tiny object detection: foto smartphone asli → tile 320×320 dengan overlap 25% → resize SETIAP tile ke 640×640 → YOLO11n → remap koordinat → global NMS (IoU 0.35). Jangan mengecilkan seluruh foto menjadi 640×640.

Model percobaan sekarang berasal dari `C:\Users\ASUS\Downloads\best.pt`: YOLO11n, satu kelas `bemisia`, training imgsz 640. File asli tidak diubah. Versi aplikasi untuk bobot ini adalah `bemisia-trial-v1-<12 karakter SHA256>`. Hasilnya adalah inference model asli, tetapi akurasi lapangan model lama belum divalidasi.

Saat versi model berubah, pengamatan pertama menjadi baseline baru: count/rate tidak langsung dibandingkan dengan model sebelumnya, termasuk peralihan dari Mock. Pengamatan berikutnya dengan versi model yang sama kembali menghasilkan tren. Riwayat lama tetap tersedia.

Untuk mengganti model, jalankan dari root proyek menggunakan environment Python ekspor yang sudah disiapkan:

```powershell
$env:YOLO_CONFIG_DIR = Join-Path (Get-Location) '.tools/ultralytics'
$env:YOLO_AUTOINSTALL = 'false'
& '.venv-model/Scripts/python.exe' scripts/export-model.py 'C:\lokasi\best-baru.pt' --version bemisia-trial-v2
npm.cmd run build
```

Script menyalin sumber ke `model-work/`, mengekspor ke ONNX dengan opset 17, memeriksa kontrak tensor, membandingkan output PyTorch/ONNX pada input deterministik, lalu memasang `public/models/bemisia.onnx` dan `public/models/model-info.json`. Bobot lama pada folder public diganti; riwayat monitoring tetap menyimpan versi sebelumnya. Beri nama versi berbeda untuk setiap eksperimen. Environment `.venv-model`, `.tools`, dan file kerja tidak ikut Git atau deployment.

Contoh ekspor dasar jika memakai environment Python lain:

```python
from ultralytics import YOLO
model = YOLO("best.pt")
model.export(format="onnx", imgsz=640, simplify=True, dynamic=False, opset=17, nms=False, device="cpu")
```

Aktifkan **Gunakan model ONNX jika tersedia** di Settings, lalu **Simpan Pengaturan**. Mock tetap default sampai pilihan tersebut diaktifkan. Settings menampilkan model percobaan yang tersedia. Saat berhasil, hasil menampilkan **ONNX · EXPERIMENTAL** dan versi `bemisia-trial-v1-...`, bukan `mock-v1`.

Adapter `src/ai/onnxDetector.ts` sudah menyiapkan inference WASM CPU per tile. Kontrak input: satu tensor float32 `[1,3,640,640]`, RGB CHW dibagi 255. Kontrak output: YOLO11 detect satu kelas Bemisia, raw `[1,5,N]` (cx,cy,w,h,confidence), tanpa embedded NMS, koordinat pixel 640. Export dengan output lain (multi-class, transposed, end-to-end NMS, quantized input) memerlukan penyesuaian decoder. Uji kontrak terhadap model final, jangan menganggap semua ekspor YOLO sama.

Versi dibaca dari `public/models/model-info.json` dan ditambah SHA256 bobot aktual agar histori bisa ditelusuri; tidak perlu mengedit source TypeScript. File ONNX dan metadata harus berasal dari ekspor yang sama. Jika checksum berbeda, analisis ONNX ditolak dengan pesan jelas dan fallback simulasi. Jika tidak ada metadata, identitas memakai `bemisia-onnx-<SHA256>`; adapter tetap khusus satu kelas Bemisia, sehingga pastikan model yang dipasang memang model Bemisia. Pipeline tetap sama. Potongan terakhir dijangkar ke tepi; foto lebih kecil daripada tile menggunakan dimensi crop aktual untuk remap. NMS dilakukan satu kali setelah semua tile, class-aware. Confidence rendah disaring lebih dahulu.

WASM dibundel Vite dari versi `onnxruntime-web` yang terkunci. Browser tidak perlu server GPU, backend inference, atau API komersial. Model & binary WASM besar sengaja tidak diprecache; ONNX offline belum dijamin, sedangkan Mock dan aplikasi utama tersedia offline setelah service worker aktif. Untuk ONNX offline produksi, tambahkan cache model dengan versioning dan kuota storage.

Jika pemuatan atau inference gagal, seluruh hasil diganti hasil mock, tidak dicampur. UI menampilkan peringatan dan model `mock-v1` disimpan pada record. Angka confidence mock bukan probabilitas terkalibrasi. Kualitas foto, threshold tren, dan waktu proses harus divalidasi dengan perangkat/foto lapangan. Deteksi coverage trap/sudut adalah `UNKNOWN`.

Rujukan: [ONNX Web deployment](https://onnxruntime.ai/docs/tutorials/web/deploy.html), [ONNX Runtime Web](https://onnxruntime.ai/docs/get-started/with-javascript/web.html).

## Uji browser terisolasi

Build smoke test menggunakan mode khusus agar tidak menyentuh data Supabase Anda:

```powershell
npm.cmd run build -- --mode browser-test --outDir test-results/model-build
npm.cmd run preview -- --outDir test-results/model-build --port 4173
```

Di terminal lain, uji model asli:

```powershell
$env:TEST_REAL_MODEL = '1'
npm.cmd run test:browser
```

Tanpa `TEST_REAL_MODEL=1`, script sengaja memblokir request model dengan respons 404 untuk memeriksa fallback. Foto uji dibuat secara sintetis; tes ini membuktikan inference, viewer, simpan versi, dan alur aplikasi bekerja, bukan mengukur akurasi deteksi lapangan.
