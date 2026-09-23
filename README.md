# 📱 Alora Mobile — PT Waschen Alora Indonesia

Aplikasi Mobile Web & SuperApp Manajemen SDM, Presensi GPS, Profil Karyawan, Biometrik WebAuthn, dan Layanan Operasional Pegawai untuk **PT Waschen Alora Indonesia (Alora Group Indonesia)**.

---

## 🌟 Fitur Utama

- 🔒 **Autentikasi & Login Wajah**: 
  - Login kredensial aman & **Masuk dengan Wajah** — kamera auto-scan, masuk otomatis tanpa tombol.
  - Matching ketat euclidean distance + 2 sampel verifikasi; hanya wajah terdaftar di Profil yang lolos.
- 📍 **Presensi & Rekap Kehadiran GPS**: 
  - Pencatatan kehadiran real-time berbasis GPS lokasi, foto selfie masuk/keluar, serta rekapitulasi status harian.
- 👤 **Profil Karyawan & Edit Profil Real-Time**: 
  - Pengelolaan data pribadi, pekerjaan, rekening bank, serta dokumen pendukung (KTP, KK, NPWP, BPJS, Ijazah, dll) yang terhubung langsung ke database MySQL `mainPool`.
- 🏃 **Alora Bugar & Informasi Aktivitas**: 
  - Pilih fokus (diet / maintenance), lalu tracking lari atau sepeda (GPS) dengan sesi tersimpan di `alora_mobile`. Pengumuman aktivitas internal.
- 🎨 **Alora Deep Navy Theme**: 
  - Tampilan antarmuka mobile ultra-premium, responsif, dan elegan khas Alora Group (`#050B14`, `#0E203B`).

---

## 🛠️ Teknologi yang Digunakan

### Frontend
- **Framework & Build Tool**: React 18, Vite
- **Styling**: Tailwind CSS
- **Ikon**: Lucide React, React Icons (`react-icons/fa`)
- **Face recognition**: `@vladmandic/face-api` (browser ML, model di `public/models/face-api/`)
- **HTTP Client**: Axios

### Backend
- **Server**: Express.js (Node.js)
- **Database**: MySQL (`mysql2/promise` with connection pooling)
- **Keamanan**: JSON Web Token (JWT), Cors, Dotenv, AES-256-GCM untuk embedding wajah

---

## 📂 Struktur Project

Organisasi **per fitur** (Bulletproof-style). Detail lengkap: [`docs/alora-mobile-structure.md`](docs/alora-mobile-structure.md).

```text
├── api/
│   ├── db/pool.js           # Dual MySQL pool (shared, bukan milik fitur)
│   ├── shared/              # middleware, upload, utils lintas fitur
│   ├── modules/             # auth, home, absensi, perizinan, bugar, …
│   └── index.js             # Mount /api/* (URL publik tidak berubah)
├── src/
│   ├── app/                 # App.jsx + router
│   ├── components/          # Shared shell UI
│   ├── features/            # Satu folder per domain (pages, components, utils)
│   ├── hooks/ utils/        # Shared tipis
│   └── assets/
├── server.js
├── vercel.json
├── vite.config.js
└── package.json
```

---

## 🚀 Cara Menjalankan Project

### 1. Prasyarat & Instalasi
```bash
# Clone repository
git clone <repo-url>
cd alora-mobile

# Install seluruh dependency
npm install
```

### 2. Konfigurasi Environment Variable (`.env`)
Buat berkas `.env` di root direktori dengan template berikut:
```env
PORT=1001
DB_HOST=your_database_host
DB_PORT=3306
DB_USER=your_database_user
DB_PASS=your_database_password
DB_NAME=your_database_name
JWT_SECRET=your_jwt_secret_key
```

#### Prisma (`alora_mobile`) — tooling lokal saja

Prisma dipakai **hanya di mesin developer** untuk migrate schema ke `alora_mobile`. Folder `prisma/` dan `generated/` tidak ikut deploy Git.

**Runtime production (Hostinger / `npm start`)** memakai `mysql2` via `aloraMobilePool` — **tidak perlu** `prisma generate` di server.

Runtime mysql2: `mainPool` = `DB_*` (`waschen`); `aloraMobilePool` = `DB_ALORA_MOBILE_*` (`alora_mobile`) — keduanya di `api/db/pool.js`.

Absensi: POST /api/attendance/check-in dan check-out (foto + GPS). Dalam radius 2 km HO-ALR label lokasi "HO Alora"; di luar tetap tersimpan dengan label "Lokasi diluar jangkauan". Foto hari ini bisa diganti (`PUT /api/attendance/photo-in` dan `photo-out`) tanpa mengubah jam/GPS. `DELETE` photo-in/out menghapus punch terkait (jam + GPS + foto) untuk hari yang sama; tidak bisa hapus masuk setelah sudah keluar.

Absensi Management (role management): `GET /api/auth/leader-role`, `GET /api/management-attendance/today`, `POST /api/management-attendance/punch-selfie`, `POST /api/management-attendance/delete-punch` — selfie wajib, tanpa GPS, label "Alora Management", hapus punch penuh untuk absen ulang.
Foto absensi diambil lewat kamera in-app (bukan pilih file galeri).

Alora Bugar: API `/api/bugar` (profil, sesi, statistik, peringkat). Onboarding tubuh → fokus → ringkasan; target km/minggu otomatis (maintenance 12, diet 20, lari+sepeda). Mode haid (gender P) menurunkan target km 50% dan kalori sesi ×0,85; konfirmasi mingguan pasca-periode. Sesi lari menyimpan langkah (`step_count`); live dari sensor HP, fallback estimasi jarak+tinggi jika izin sensor ditolak. Peringkat bulanan WIB dengan podium top 3; pilih bulan/tahun. Progress mingguan dari sesi GPS. GPS tracking di klien. Data di tabel `tr_worker_bugar_profile` dan `tr_worker_bugar_session` pada `alora_mobile`. **Bukan** Firebase.

Tabel app: `mst_location_absen`, `tr_worker_attendance`, `tr_worker_leaves`, `tr_worker_bugar_profile`, `tr_worker_bugar_session` (`employee_id` dari login Alora).

```env
DB_ALORA_MOBILE_HOST=your_database_host
DB_ALORA_MOBILE_PORT=3306
DB_ALORA_MOBILE_USER=your_database_user
DB_ALORA_MOBILE_PASS=your_database_password
DB_ALORA_MOBILE_NAME=alora_mobile
```

Perintah:

- `npm run prisma:generate` — generate Prisma Client
- `npm run prisma:deploy` — apply migration ke `alora_mobile`
- `npm run prisma:migrate` — buat migration baru saat ada model (butuh shadow DB)
- `npm run prisma:studio` — buka Prisma Studio

Alur tambah tabel nanti: edit `prisma/schema.prisma` → `npm run prisma:migrate -- --name <nama>` **atau** jika `migrate dev` gagal karena shadow DB: `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script` lalu taruh SQL di folder migration baru → `npm run prisma:deploy`.

Jangan arahkan Prisma ke `waschen`.

#### Login Wajah (face recognition)

Env:

```env
FACE_EMBEDDING_SECRET=<64-char-hex>
FACE_MATCH_MAX_DISTANCE=0.45
FACE_PROBE_MAX_DISTANCE=0.50
FACE_LOGIN_SAMPLES=2
FACE_MATCH_GAP=0.15
FACE_MODEL_VERSION=face-api-v1
```

Download model ML:

```bash
npm run face:models
```

**Alur login:** tap **Masuk dengan Wajah** → kamera fullscreen → tahan wajah di oval → sistem auto-scan 2 sampel → masuk otomatis (tanpa tombol).

**Alur daftar:** login password → Profil → **Daftar Login Wajah** (3 sampel manual).

Privasi: embedding terenkripsi di `user_face_credentials`, bukan foto. Foto layar wajah terdaftar masih bisa lolos v1 (liveness belum ada).

Sesuaikan ketat/longgar via `FACE_MATCH_MAX_DISTANCE` (default 0.45, naikkan ke 0.50 jika wajah asli sering ditolak).

### 3. Jalankan Mode Development
```bash
# Jalankan backend Express (port 1001) & frontend Vite (port 1000) secara bersamaan
npm run dev
```

---

## 📜 Scripts npm

| Perintah | Deskripsi |
| :--- | :--- |
| `npm run dev` | Menjalankan server Express & client Vite bersamaan (`concurrently`) |
| `npm run dev:server` | Menjalankan server backend Express saja dengan `nodemon` |
| `npm run dev:client` | Menjalankan server frontend React saja dengan `vite` |
| `npm run build` | Melakukan build bundel frontend production ke folder `dist/` |
| `npm start` | Menjalankan server Express mode production |
| `npm run prisma:generate` | Generate Prisma Client untuk `alora_mobile` |
| `npm run prisma:migrate` | Buat & apply migration development (`prisma migrate dev`) |
| `npm run prisma:deploy` | Apply migration ke `alora_mobile` (`prisma migrate deploy`) |
| `npm run prisma:studio` | Buka Prisma Studio |

---

## 🌐 Deployment Compatibility

Aplikasi ini dirancang dengan arsitektur **Hybrid Dual-Compatibility**:
- **Hostinger / Node.js Standalone Server**: Menjalankan `server.js` (`npm start`). Setelah push Git, cukup `npm install` + `npm run build` di server (atau build lokal lalu commit `dist/` jika workflow Anda begitu). **Tidak perlu** `prisma generate`.
- **Vercel Serverless Functions**: Menggunakan `api/index.js` dan pengalihan rute via `vercel.json`.

---

&copy; 2026 **PT Waschen Alora Indonesia**. All Rights Reserved.
