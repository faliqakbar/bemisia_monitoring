# Dataset & koreksi box (Hugging Face + Label Studio)

Alur: **HP** (review, centang *Masukkan ke dataset*) → **server AI** → dataset privat
Hugging Face `liq30/bemisia-traps` → **Label Studio** di laptop (koreksi box) → ekspor YOLO →
training di Colab → `scripts/export-model.py` → `modal deploy modal_app.py`.

## Isi dataset

Setiap foto yang dikirim dari aplikasi menjadi dua file:

- `images/<YYYY-MM>/<id>.<jpg|png|webp>`: foto asli resolusi penuh (tanpa kompresi ulang).
- `labels/<id>.json`: trap, waktu, versi model, feedback (*Sesuai* / *Perlu Koreksi*),
  catatan, jumlah, durasi pemasangan, dan `predictions` (box model sebagai pecahan 0–1 dari
  foto tegak).

`<id>` sama dengan id monitoring di Supabase, jadi foto dapat ditelusuri balik.

## Sekali di awal: token Hugging Face di server

Token disimpan sebagai *secret* Modal bernama `bemisia-hf` (bukan di kode atau HP):
<https://modal.com/secrets> → **Create new secret** → **Custom**, nama `bemisia-hf`, isi
`HF_TOKEN` (token *write*) dan `HF_DATASET` = `liq30/bemisia-traps`. Lalu deploy ulang
server (`modal deploy modal_app.py`). Opsi *Masukkan ke dataset* baru muncul di aplikasi
setelah `/health` server menampilkan `"dataset": true`.

## Mengirim foto dari aplikasi

Di halaman hasil, pilih **⚠ Perlu Koreksi** (opsi dataset otomatis tercentang) atau centang
**Masukkan ke dataset** secara manual, lalu **Save Monitoring**. Pilih juga sebagian foto yang
*Sesuai* sebagai sampel, supaya dataset tidak hanya berisi kasus sulit.

## Koreksi box di Label Studio (laptop)

Sekali: `python -m venv .venv-label` lalu
`.venv-label/Scripts/python -m pip install label-studio huggingface_hub`.

1. Unduh dataset dan buat daftar tugas (PowerShell, dari folder `bemisia-monitoring`):

   ```powershell
   $env:HF_TOKEN = "hf_..."   # token baca/tulis Hugging Face
   .venv-label/Scripts/python scripts/labelstudio_tasks.py --root C:/bemisia-labeling
   ```

   Hasil: `C:/bemisia-labeling/bemisia-traps/` (foto + label) dan `C:/bemisia-labeling/tasks.json`,
   foto *Perlu Koreksi* di urutan pertama. Jalankan lagi kapan pun untuk mengambil foto baru.

2. Jalankan Label Studio:

   ```powershell
   $env:LABEL_STUDIO_LOCAL_FILES_SERVING_ENABLED = "true"
   $env:LABEL_STUDIO_LOCAL_FILES_DOCUMENT_ROOT = "C:/bemisia-labeling"
   .venv-label/Scripts/label-studio start
   ```

   Browser terbuka di <http://localhost:8080>; buat akun lokal (hanya di laptop ini).

3. **Create Project** → *Labeling Setup* → *Custom template* → tempel isi
   `scripts/labelstudio-config.xml`.
4. *Settings → Cloud Storage → Add Source Storage → Local files*, path
   `C:/bemisia-labeling/bemisia-traps`. **Jangan** tekan *Sync* (tugas diimpor dari `tasks.json`).
5. **Import** → pilih `C:/bemisia-labeling/tasks.json`. Box model muncul sebagai prediksi.
6. Koreksi: hapus box yang bukan Bemisia, gambar box untuk serangga yang terlewat (tombol
   `b`), rapikan posisi; zoom dengan scroll. *Submit* per foto.
7. **Export → YOLO** untuk training.

Saat mengimpor ulang setelah foto baru masuk, buat project baru atau impor hanya tugas baru
agar tidak dobel.

## Panduan anotasi

- Satu box per serangga Bemisia dewasa yang terlihat; box ketat mengelilingi tubuh dan sayap.
- Serangga terpotong tepi foto atau tertutup sebagian tetap diberi box bila masih dikenali.
- Serangga lain, debu, gelembung lem, pantulan: tanpa box.
- Ragu: tanpa box, beri catatan di *Comments* Label Studio.

## Training

- Simpan **set validasi tetap** (misalnya 30–50 foto yang dihitung teliti) dan jangan masukkan ke
  training, agar v2, v3, dst. dibandingkan secara adil.
- Pisahkan train/validasi **per foto (atau per trap/tanggal)** sebelum dipotong menjadi tile
  320 px, sehingga tile dari foto yang sama tidak muncul di dua sisi.
- Setelah training: `scripts/export-model.py best.pt --version bemisia-trial-v3`, commit, push,
  lalu `modal deploy modal_app.py`.
