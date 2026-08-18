# 📱 Alora Mobile — PT Waschen Alora Indonesia

Aplikasi Mobile Web & SuperApp Manajemen SDM, Presensi GPS, Profil Karyawan, Biometrik WebAuthn, dan Layanan Operasional Pegawai untuk **PT Waschen Alora Indonesia (Alora Group Indonesia)**.

---

## 🌟 Fitur Utama

- 🔒 **Autentikasi & Biometrik WebAuthn**: 
  - Login kredensial aman & autentikasi biometrik (Fingerprint / Face ID) menggunakan standar `@simplewebauthn`.
- 📍 **Presensi & Rekap Kehadiran GPS**: 
  - Pencatatan kehadiran real-time berbasis GPS lokasi, foto selfie masuk/keluar, serta rekapitulasi status harian.
- 👤 **Profil Karyawan & Edit Profil Real-Time**: 
  - Pengelolaan data pribadi, pekerjaan, rekening bank, serta dokumen pendukung (KTP, KK, NPWP, BPJS, Ijazah, dll) yang terhubung langsung ke database MySQL `mainPool`.
- 🏃 **Alora Bugar & Informasi Aktivitas**: 
  - Pemantauan kesehatan & kebugaran harian pegawai serta pengumuman aktivitas internal.
- 🎨 **Alora Deep Navy Theme**: 
  - Tampilan antarmuka mobile ultra-premium, responsif, dan elegan khas Alora Group (`#050B14`, `#0E203B`).

---

## 🛠️ Teknologi yang Digunakan

### Frontend
- **Framework & Build Tool**: React 18, Vite
- **Styling**: Tailwind CSS
- **Ikon**: Lucide React, React Icons (`react-icons/fa`)
- **Biometrik**: `@simplewebauthn/browser`
- **HTTP Client**: Axios

### Backend
- **Server**: Express.js (Node.js)
- **Database**: MySQL (`mysql2/promise` with connection pooling)
- **Biometrik Server**: `@simplewebauthn/server`
- **Keamanan**: JSON Web Token (JWT), Cors, Dotenv

---

## 📂 Struktur Project

```text
├── api/
│   ├── controllers/      # Controller logika bisnis (login, profile)
│   ├── db/               # Koneksi database MySQL mainPool
│   ├── middleware/       # Middleware autentikasi & file upload
│   ├── routes/           # Routing API (/api/auth, /api/profile, /api/employee)
│   └── index.js          # Entrypoint Serverless Function Vercel
├── src/
│   ├── assets/           # Logo & aset gambar (aloramobile-white.png)
│   ├── components/       # Komponen UI (MobileContainer, Modal, ConfirmModal, BottomNavbar)
│   ├── hooks/            # Custom hooks React (useDocumentTitle)
│   ├── pages/            # Halaman utama (Home, Profil, EditProfile, Riwayat, Login)
│   └── utils/            # Helper & Formatter (FormatName)
├── server.js             # Entrypoint server Express standalone (Local & Hostinger)
├── vercel.json           # Konfigurasi routing Vercel Serverless
├── vite.config.js        # Konfigurasi Vite
└── package.json          # Dependency & script npm
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

---

## 🌐 Deployment Compatibility

Aplikasi ini dirancang dengan arsitektur **Hybrid Dual-Compatibility**:
- **Hostinger / Node.js Standalone Server**: Menjalankan `server.js` (`npm start` atau PM2).
- **Vercel Serverless Functions**: Menggunakan `api/index.js` dan pengalihan rute via `vercel.json`.

---

&copy; 2026 **PT Waschen Alora Indonesia**. All Rights Reserved.
