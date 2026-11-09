# Deploy: server AI (Modal / Cloud Run) + aplikasi (GitHub Pages / Cloudflare Pages)

Urutannya: server AI dulu (untuk mendapatkan URL-nya), lalu aplikasi.
GitHub Actions menjalankan pemeriksaan (typecheck, test, build) dan, untuk sementara, men-deploy ke GitHub Pages pada setiap push ke `main`. Setelah Cloudflare Pages aktif, hapus job `deploy` di `.github/workflows/ci.yml`.

## 0. Server AI di Modal (dipakai sekarang)

Google Cloud belum bisa dipakai (akun billing ditahan), jadi server AI berjalan di
[Modal](https://modal.com): tanpa kartu kredit, kredit gratis bulanan, ditagih per detik saat dipakai.
Konfigurasinya `modal_app.py`: 4 CPU, RAM 4 GB, maksimal 2 container, satu foto per container,
siaga 5 menit setelah dipakai. URL: <https://faliqakbar--bemisia-ai-serve.us-east.modal.run>
(`/health` menampilkan versi model).

```sh
.tools/python/cpython-3.11.18-windows-x86_64-none/python.exe -m venv .venv-modal
.venv-modal/Scripts/python.exe -m pip install modal
.venv-modal/Scripts/modal.exe token new          # sekali, login lewat browser
.venv-modal/Scripts/modal.exe deploy modal_app.py
```

**Saat model diganti**, jalankan ulang `modal deploy modal_app.py` setelah `scripts/export-model.py`,
agar server dan web memakai versi model yang sama. Workflow GitHub memakai URL di atas sebagai
`VITE_AI_SERVER_URL`, kecuali repository variable dengan nama itu diisi.

## 1. Server AI di Google Cloud Run (alternatif)

Server ada di `server/` dan dibangun dari `Dockerfile` di root repository. Docker tidak
perlu dipasang di komputer: Cloud Build membangun image di cloud.

1. Buat project di <https://console.cloud.google.com> dan aktifkan **Billing** (kartu kredit
   diperlukan walaupun pemakaian masih dalam kuota gratis).
2. Pasang Google Cloud CLI: <https://cloud.google.com/sdk/docs/install> (Windows installer).
3. Di terminal, dari folder `bemisia-monitoring`:

```sh
gcloud auth login
gcloud config set project ID_PROJECT_ANDA
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
gcloud run deploy bemisia-ai --source . --region asia-southeast2 --allow-unauthenticated --cpu 4 --memory 4Gi --concurrency 1 --max-instances 2 --timeout 300 --cpu-boost
```

- `asia-southeast2` = Jakarta.
- `--concurrency 1`: satu foto per instance, karena analisis memakai semua CPU.
- `--max-instances 2`: batas biaya. Server terbuka untuk siapa saja; batas ini mencegah
  tagihan membengkak bila URL disalahgunakan. Permintaan yang melebihi kapasitas ditolak
  dan aplikasi otomatis memakai model di HP.
- Tanpa permintaan, instance turun ke 0 sehingga tidak ditagih. Permintaan pertama setelah
  diam beberapa detik lebih lambat (*cold start*, memuat model).

Perintah terakhir mencetak **Service URL**, misalnya `https://bemisia-ai-xxxxx.a.run.app`.
Cek dengan membuka `<Service URL>/health`: harus tampil `{"ok":true,"modelVersion":"bemisia-trial-v1-…"}`.

Opsional, batasi pemanggil hanya dari situs Anda:

```sh
gcloud run services update bemisia-ai --region asia-southeast2 --update-env-vars "ALLOWED_ORIGINS=https://NAMA-PROJECT.pages.dev"
```

Ini hanya membatasi browser; skrip di luar browser tetap bisa memanggil server.

**Saat model diganti** (`scripts/export-model.py`), jalankan ulang `gcloud run deploy ...`
agar server memakai model yang sama dengan aplikasi; versi model tercatat di setiap hasil.

## 2. Aplikasi di Cloudflare Pages

1. <https://dash.cloudflare.com> → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git** → pilih repository `bemisia_monitoring`.
2. Build settings:
   - Framework preset: **None**
   - Build command: `npm run build`
   - Build output directory: `dist`
3. Environment variables (Production):
   - `VITE_BASE_PATH` = `/`
   - `VITE_AI_SERVER_URL` = Service URL Cloud Run (tanpa `/` di akhir)
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (opsional; kosong = Demo Mode)
4. **Save and Deploy**. Situs tersedia di `https://NAMA-PROJECT.pages.dev`. Setiap push ke
   `main` men-deploy ulang otomatis.

Versi Node diambil dari `.node-version` (22). `public/_headers` mengaktifkan
*cross-origin isolation* sehingga model di HP berjalan multi-thread saat offline.

## 3. Pakai di HP

Buka situs Cloudflare → Settings → centang **Gunakan model ONNX jika tersedia** dan
**Analisis di server AI saat online** → Simpan Pengaturan.

- Online: foto asli dikirim ke server, hasil kembali dalam hitungan detik. Foto tidak
  disimpan di server.
- Offline / server gagal: otomatis memakai model di HP (diunduh sekali, lalu dari cache).
- Server dan HP memakai model, tiling, resize, dan NMS yang sama, sehingga hasilnya
  sebanding dan memakai versi model yang sama di riwayat.

Situs lama di GitHub Pages tidak diperbarui lagi. Data offline di browser terikat ke alamat
situs, jadi sinkronkan atau ekspor data dari alamat lama sebelum pindah.
