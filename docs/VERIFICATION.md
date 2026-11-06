# Hasil verifikasi MVP

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
