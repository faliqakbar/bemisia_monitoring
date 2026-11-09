# Hasil verifikasi MVP

## Server AI di Modal — 9 November 2026

- Deploy `modal_app.py` (4 CPU, 4 GB). `/health` menampilkan `bemisia-trial-v2-e1af752e74de`, sama dengan web.
- Cold start sekitar 5,6 detik; foto sintetis 12MP (221 tiles) sekitar 15 detik inference, 17,5 detik total termasuk unggah dari Indonesia ke region us-east.
- CORS preflight dari GitHub Pages: 204 dengan `Access-Control-Allow-Origin: *`.
- `sharp` dinaikkan ke 0.35.5 (perbaikan celah libvips) dan `adm-zip` dipaksa ke 0.6.1; `npm audit` server 0 kerentanan. Hasil deteksi identik sebelum/sesudah (71 deteksi, confidence rata-rata sama).

## Model bemisia-trial-v2 — 9 November 2026

- Sumber: `best_v2.pt` (sha256 `cf2d396a…`), YOLO11n satu kelas `bemisia`, dilatih pada `bemisia_tiled_320` (imgsz 640, 100 epoch). Metrik pelatihan: precision 0,769, recall 0,613, mAP50 0,72, mAP50-95 0,266; `val/cls_loss` 14,0 (jauh di atas `best (1).pt`: 1,13).
- Ekspor ONNX lulus parity PyTorch/ONNX (selisih maksimum 0,00012). Versi hasil: `bemisia-trial-v2-e1af752e74de`.
- Pada foto sintetis (elips putih di kartu kuning) v1 mendeteksi 71/70 dan 307/300, v2 mendeteksi 0: confidence tertinggi per tile hanya 0,003–0,036. Bisa berarti v2 menolak objek tiruan, atau confidence v2 secara umum terlalu rendah untuk ambang 0,25. **Belum diuji pada foto lapangan asli**; dipasang atas permintaan pengguna untuk pemeriksaan manual.
- Hasil v2 memulai baseline tren baru (tidak dibandingkan dengan v1).
- 9 November 2026: pengguna memeriksa v2 secara manual pada foto yellow trap asli di web; model mendeteksi Bemisia. Nol deteksi pada foto sintetis berarti v2 menolak objek tiruan, bukan gagal mendeteksi. Akurasi terhadap hitungan manual belum diukur secara sistematis.

## Server AI Cloud Run & Cloudflare Pages — 7 November 2026

- Server Node (onnxruntime-node + sharp) memakai `src/ai` yang sama dengan aplikasi (tiling, decoder YOLO, NMS).
- Eksperimen foto noise 1200px: browser 39 deteksi; server dengan resize libvips 20, dengan JPEG 0.92 75–95, dengan resize bilinear gaya canvas + file asli 38. Karena itu server memakai `resizeTileBilinear` dan aplikasi mengirim file asli (PNG lossless untuk frame kamera live).
- Foto sintetis 12MP (221 tiles): sekitar 24 detik di laptop pengujian 4 thread; browser PC satu thread sekitar 0,6 detik/tile.
- Ukuran hasil decode server dicek terhadap ukuran canvas aplikasi (409 bila berbeda, aplikasi kirim ulang PNG).
- Cross-origin isolation (`public/_headers`) mengaktifkan ONNX multi-thread di browser: 25 tiles sekitar 9 detik (sebelumnya sekitar 15 detik).
- 45 unit tests lulus; typecheck aplikasi & server; browser test model asli, Mock, dan end-to-end via server lokal lulus. Image Docker dan Cloud Run belum diuji karena belum ada akun GCP; dibangun oleh Cloud Build saat deploy pertama.

## Perbaikan tren & offline ONNX — 6 November 2026

- Grafik tren hanya menampilkan versi model terbaru beserta catatan jumlah pengamatan versi lain yang disembunyikan.
- Pembanding = pengamatan terakhir trap yang sama dengan versi model yang sama; fallback Mock di antaranya tidak memutus perbandingan ONNX.
- Service worker: `/models/*.onnx|json` NetworkFirst (cache `bemisia-model`), `assets/*.wasm` CacheFirst (cache `onnx-runtime`). Model tersimpan setelah satu analisis ONNX online saat halaman sudah dikontrol service worker.
- 36 unit tests lulus; typecheck dan production build berhasil.
- Browser test model asli lulus termasuk inference ONNX dalam kondisi network offline; browser test fallback Mock tetap lulus.

## Model percobaan — 6 November 2026

- Sumber: `C:\Users\ASUS\Downloads\best.pt`, YOLO11n, 1 kelas `bemisia`, training input 640.
- Ekspor CPU: opset 17, float32, input `[1,3,640,640]`, output `[1,5,8400]`, tanpa embedded NMS.
- ONNX checker dan perbandingan PyTorch/ONNX lulus. Selisih absolut maksimum 0.0001831; selisih confidence maksimum 0.000000117 pada tensor deterministik.
- Versi hasil: `bemisia-trial-v1-3f577990f777`; hash lengkap dan provenance ada di `public/models/model-info.json`.
- 34 unit tests lulus; TypeScript strict dan production build berhasil.
- Chrome CPU/WASM: foto sintetis 1200×1200 diproses menjadi 25 tiles; inference sekitar 19–22 detik pada komputer pengujian, bukan jaminan waktu di HP.
- Browser smoke test model asli lulus: upload, quality gate, inference, label versi, viewer, feedback, simpan, persistensi, serta reload PWA offline. Pengujian terpisah model hilang memastikan fallback mock tetap berfungsi.
- Saat versi model berubah, hasil menjadi baseline baru; perubahan count/rate tidak dibandingkan dengan versi sebelumnya. Unit test dan browser memverifikasi mock → model asli tidak menghasilkan alert perubahan populasi palsu.
- Smoke test memakai repository demo terisolasi; tidak menulis ke Supabase pengguna. Screenshot: `test-results/result-onnx-mobile.png`.
- Ini verifikasi integrasi, bukan validasi akurasi. Foto yellow trap nyata dengan hitungan pembanding belum disediakan untuk evaluasi model.

## Verifikasi awal

Diverifikasi pada 5 November 2026 di Windows, Node.js 24, Chrome headless.

- `npm install`: berhasil; lockfile disertakan.
- `npm run typecheck`: berhasil, TypeScript strict tanpa error.
- `npm test`: 24 tests lulus pada 3 file dengan Vitest 5.1.0.
- `npm run build`: berhasil, service worker dan precache PWA dihasilkan.
- `npm run dev`: berhasil, HTTP 200 pada localhost:5173.
- Browser desktop 1440px dan mobile 390px: dashboard tampil, tidak ada overflow horizontal mobile.
- Pengaturan tersimpan, QR invalid ditangani, payload QR valid memilih trap.
- Foto 1200px diterima; foto 200px ditolak dan tombol analisis dinonaktifkan.
- Model ONNX hilang: peringatan terlihat dan Mock Detector berhasil dijalankan.
- Canvas review tetap 1200px, feedback tersimpan bersama monitoring, data bertahan setelah reload.
- Reload build PWA dalam kondisi network offline berhasil.
- Tidak ada uncaught browser exception pada alur smoke test.

Script: `scripts/browser-check.mjs`. Screenshot lokal: `test-results/dashboard-desktop.png`, `dashboard-mobile.png`, `result-mobile.png` (diabaikan Git).

Belum diverifikasi menggunakan kamera HP fisik, instalasi PWA di Android/iOS, proyek Supabase nyata, atau bobot ONNX final. Uji sinkronisasi memakai respons cloud simulasi: kegagalan upload/database mempertahankan antrean, retry memakai ID yang sama, dan akun lain tidak memproses antrean pemilik.

Audit terakhir setelah perbaikan kompatibel: 0 critical/high; 5 advisory low/moderate pada dependency build Workbox (bukan runtime browser). Rincian dan batas prototype dijelaskan dalam README.
