# Bemisia Yellow Trap Monitoring

Prototype R&D mobile-first React + TypeScript strict + Vite + Tailwind CSS. Gratis, tanpa backend FastAPI, server GPU, atau API komersial. Berjalan dengan **DEMO MODE** dan **SIMULATION MODE** tanpa Supabase atau model AI.

## Menjalankan lokal

Node.js 22.12+ direkomendasikan (Node 24 juga didukung).

```sh
cd bemisia-monitoring
npm install
npm run dev
```

Jika PowerShell memblokir `npm.ps1`, gunakan `npm.cmd install` dan `npm.cmd run dev`. Buka alamat Local dari Vite. Kamera dan service worker membutuhkan HTTPS atau localhost. Untuk HP fisik gunakan hosting HTTPS; akses IP LAN HTTP hanya cocok untuk upload galeri dan bukan pengujian kamera/PWA penuh.

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

PWA diaktifkan pada build produksi. Buka sekali secara online, tunggu service worker aktif, kemudian halaman dan Mock Detector dapat dipakai offline. Model ONNX (sekitar 10.7 MB) dan runtime WASM (sekitar 12 MB) tidak di-precache; keduanya disimpan ke cache setelah satu analisis ONNX online saat service worker sudah aktif (buka ulang aplikasi sekali setelah kunjungan pertama). Saat online model selalu diambil ulang dari server sehingga penggantian model langsung terpakai. Install melalui menu browser. Navigasi memakai hash sehingga refresh route tidak membutuhkan rewrite pada GitHub Pages.

## Fitur

- Dashboard ringkas, filter greenhouse, alert berdasarkan rate, Chart.js dan riwayat per trap.
- Pilih GH/trap atau scan QR `BEMISIA|GH12|T03` via ZXing; input manual bila kamera tidak tersedia.
- Live camera dengan panduan bingkai, input capture kamera perangkat, atau upload galeri.
- Quality check: resolusi, variance of Laplacian, luminansi, estimasi highlight. Status GOOD/WARNING/RETAKE; RETAKE memblokir analisis.
- Mock deterministic dari piksel, tiling 320/25%, global NMS, model version, progress per tile.
- **Analyze di latar & lanjut**: foto masuk antrean (tersimpan di IndexedDB) dan dianalisis satu per satu selama aplikasi terbuka, sementara pengguna memotret trap berikutnya. Hasil muncul di panel Antrean analisis (Monitoring, dengan angka di menu) untuk direview lalu disimpan. Antrean yang terputus dilanjutkan saat aplikasi dibuka lagi. "Analyze & tunggu hasil" tetap tersedia.
- Banner "Versi baru aplikasi tersedia" dengan tombol Muat ulang; aplikasi memeriksa versi baru tiap 30 menit dan saat kembali dibuka.
- Review foto asli dengan zoom, pan, toggle box/nomor/confidence; feedback dan catatan.
- Normalisasi Bemisia/hari berdasarkan lama pemasangan, histori, dan ambang Watch/High configurable.
- CRUD greenhouse/trap (tambah GH, tambah/edit/nonaktifkan trap); QR PNG dapat diunduh.
- IndexedDB menyimpan hasil & foto terkompresi secara atomik. Cloud memakai antrean PENDING SYNC yang bertahan setelah reload, retry manual/online, ID idempoten.
- Foto cloud WebP 0.82, longest side 1920px; foto asli hanya dipakai saat proses/review di perangkat. Foto tersimpan dalam riwayat adalah salinan terkompresi.
- Export catatan JSON (foto tidak termasuk), login Supabase, reset settings, PWA manifest & icons.

## Demo dan penggunaan

Demo awal: GH12 (T01–T03), GH15 (T01–T02), GH19 (T01), empat riwayat simulasi per trap. Tanggal relatif terhadap hari pertama aplikasi dibuka. Data seed hanya dibuat sekali. Tambahan monitoring bertahan setelah reload. Data mock tidak boleh dipakai sebagai kesimpulan pengamatan nyata.

Pilih Monitoring → GH/trap → ambil/upload foto → periksa kualitas → Analyze Bemisia → periksa durasi pemasangan dan hasil → feedback → Save Monitoring. Review Detection mempertahankan resolusi canvas asli. Untuk trap yang diganti, edit tanggal pemasangan sebelum monitoring berikutnya; durasi juga bisa dikoreksi saat menyimpan.

Bemisia/hari = count / exposure_days. Durasi <=0 ditolak. Jika pembanding nol/tidak ada, persentase null (ditampilkan “Belum sebanding”), bukan Infinity. Alert hanya menggunakan perubahan rate, sehingga count dengan exposure tidak diketahui tidak diberi alert menyesatkan. Default Normal <20%, Watch 20–50%, High >50%. Contoh 40.4% adalah Watch, mengikuti aturan threshold. Perbandingan dan grafik tren hanya memakai pengamatan dengan versi model yang sama: pengamatan pertama setelah ganti model menjadi data awal, dan hasil fallback Mock di antaranya tidak memutus perbandingan ONNX. **Threshold epidemiological/action level belum divalidasi dan hanya untuk prototype.**

## Environment dan Supabase

Salin `.env.example` ke `.env.local`:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_BASE_PATH=/
```

Kedua nilai Supabase diperlukan. Hanya gunakan anon/publishable key, **jangan service role key**. Vite memasukkan env frontend ke bundle; ini bukan tempat secret server.

1. Buat proyek Supabase Free dan jalankan `supabase/migrations/001_initial_schema.sql` melalui SQL editor.
2. Buat akun staff di Authentication (email/password). Tidak ada signup publik di aplikasi ini.
3. Isi environment, restart/build, masuk lewat Settings, lalu buat GH & trap di Kelola Trap.
4. Simpan monitoring → Sync Data. Hasil dipersist ke IndexedDB sebelum request cloud. Bila jaringan/auth/storage gagal, item tetap PENDING SYNC.

Migration mengaktifkan RLS untuk semua tabel. Master data dibagi antar staff authenticated; monitoring/detections/foto dibatasi pemilik. Policy insert/update diperlukan untuk pengelolaan dan retry idempoten. Bucket `monitoring` privat, maksimum 10MB, hanya image WebP/JPEG/PNG; path `{GH}/{TRAP}/{session-uuid}.webp` (UUID stabil menggantikan timestamp agar retry tidak membuat file ganda). URL record adalah object path privat, diunduh lewat SDK authenticated.

Repository Supabase terpisah dari React; tabel master dicache untuk offline. Pengelolaan master cloud perlu koneksi. Demo dan setiap proyek cloud menggunakan database IndexedDB berbeda; record cloud terikat akun dan antrean hanya disinkron oleh pemiliknya. Riwayat cloud hanya menampilkan pengamatan akun saat ini. Keluar akun menyembunyikan data monitoring, tetapi cache tetap di browser agar antrean tidak hilang; gunakan perangkat/profil browser pribadi. Jika env belum tersedia, otomatis Local Repository.

Rujukan RLS Storage: [Supabase access control](https://supabase.com/docs/guides/storage/security/access-control).

## AI Model

Model percobaan `bemisia-trial-v2` (dari `best_v2.pt`, YOLO11n, satu kelas `bemisia`, sekitar 10.7 MB) terpasang di `public/models/bemisia.onnx` dan di server AI. **Gunakan model ONNX jika tersedia** dan **Analisis di server AI saat online** aktif secara bawaan, jadi perangkat baru langsung memakai model tanpa menyimpan pengaturan; hapus centang ONNX hanya untuk Simulation Mode. Pengaturan disimpan per perangkat. Hasil menampilkan `ONNX · EXPERIMENTAL` dan versi model. Jika model tidak tersedia/tidak kompatibel/gagal inference, fallback Mock dengan peringatan yang jelas.

Lihat [MODEL_INTEGRATION.md](docs/MODEL_INTEGRATION.md) untuk ekspor model pengganti menggunakan `scripts/export-model.py`. Script memperbarui ONNX dan `public/models/model-info.json`; versi ditambah fingerprint SHA256 otomatis, tanpa mengubah source UI. Model percobaan belum divalidasi akurasinya pada foto lapangan; hasil lama tidak berubah saat model diganti.

## Struktur

`src/components` UI reusable; `src/pages` tujuh halaman; `src/ai` adapter, tiling, preprocessing dan NMS; `src/imageQuality` kualitas; `src/database` interface/repository; `src/offline` IndexedDB & sync; `src/utils` tren, image, tanggal; `supabase/migrations` schema/RLS; `tests` unit tests; `.github/workflows/deploy.yml` CI Pages; `public` manifest/icons/model ONNX; `scripts/export-model.py` ekspor dan verifikasi model pengganti.

## Deploy

Langkah lengkap ada di [docs/DEPLOY.md](docs/DEPLOY.md): server AI di **Google Cloud Run** (`server/`, `Dockerfile`) dan aplikasi di **Cloudflare Pages**. Workflow GitHub Actions kini hanya CI (typecheck, test, build aplikasi & server).

## Server AI (Cloud Run)

Bila `VITE_AI_SERVER_URL` diisi dan opsi **Analisis di server AI saat online** aktif, foto asli dikirim ke server lalu dianalisis dengan model, tiling, resize bilinear gaya canvas, dan NMS yang sama dengan aplikasi; hasil memakai versi model yang sama sehingga tetap sebanding di tren. Offline atau server gagal: otomatis model di perangkat. Server lokal: `npm install --prefix server`, `npm run build --prefix server`, lalu `MODEL_DIR=public/models node server/dist/index.mjs` (port 8080).

## Catatan lama: GitHub Pages / Cloudflare Pages

Jadikan isi folder **bemisia-monitoring** sebagai root repository GitHub, commit termasuk `package-lock.json`, push branch main. Aktifkan Settings → Pages → GitHub Actions. Workflow menjalankan `npm ci`, typecheck, tests, build, lalu deploy `dist`. `VITE_BASE_PATH` otomatis `/{nama-repository}/`; set repository variable `/` untuk custom domain/user Pages. Isi dua repository variables Supabase jika ingin cloud; kosongkan untuk demo.

Cloudflare Pages: build command `npm run build`, output `dist`, Node 22, `VITE_BASE_PATH=/`. Tidak diperlukan Worker atau paid API. Deployment tidak dijalankan otomatis dari workspace tanpa repository/hosting tujuan.

## Batas prototype

Coverage trap & sudut kamera UNKNOWN; tidak ada klaim AI perspektif. Kamera memerlukan izin. Foto dibatasi 50MP untuk membatasi alokasi memori, tetapi HP rendah memori tetap perlu foto lebih kecil. Proses banyak tile dapat lambat; jangan tutup tab saat inference/simpan. Offline local bukan backup permanen: menghapus data browser menghapus cache/antrean. Error kuota storage ditampilkan, hasil tetap di halaman untuk coba simpan lagi. Pastikan sinkronisasi/ekspor sebelum membersihkan browser.

Unit tests memeriksa tiling, remap, NMS, tren, kualitas, dan persistensi lokal. Pengujian hardware kamera, install PWA di HP, serta integrasi akun Supabase dan bobot ONNX final perlu perangkat/kredensial/model tersebut.

Pengujian browser lokal memakai build terisolasi `npm run build -- --mode browser-test --outDir test-results/model-build`, kemudian `npm run preview -- --outDir test-results/model-build --port 4173` dan `npm run test:browser` di terminal lain. Mode ini tidak memakai akun Supabase Anda. Untuk menguji model asli, set `$env:TEST_REAL_MODEL = '1'` di PowerShell sebelum test; default sengaja mensimulasikan model hilang. Script memakai Chrome/Edge terpasang; set `CHROME_PATH` bila lokasinya berbeda. Screenshot hasil pengujian berada di `test-results/`. Pemeriksaan mencakup upload → quality gate → deteksi → simpan → reload, QR manual, dan reload PWA offline; dengan model asli juga inference ONNX saat offline. `npm run format` merapikan source.

Audit dependency: kerentanan critical pada test runner sudah diperbaiki dengan Vitest 5. Dependency build Workbox masih membawa advisory low/moderate pada glob/minimatch/deepmerge meskipun `npm audit fix` kompatibel telah dijalankan; dependency tersebut tidak ikut runtime browser. Periksa kembali `npm audit` saat memperbarui toolchain.
