# PAAADEL

Web app (PWA) latihan *shadow swing* khusus padel. Pengguna memegang HP seperti gagang raket dan mengayunkannya; aplikasi mendeteksi ayunan lewat sensor gerak HP, menghitung rep, memperkirakan kecepatan raket & bola, memutar ulang pukulan dalam 3D, dan memandu drill dengan suara coach.

Tagline: **"Latihan padel di rumah biar kamu makin jago di lapangan."**

README.md berisi penjelasan lengkap fitur, cara deteksi ayunan, model kecepatan, dan arah bola. Baca itu dulu sebelum mengubah logika deteksi atau fisika bola, dan perbarui README kalau perilakunya berubah.

## Status
- Versi `1.3` (konstanta `VERSION` di app.js). Tahap uji coba pribadi, dipakai pemilik sendiri untuk latihan.
- Hosting: GitHub Pages dari repo publik `rsukmanagara/paaadel` (branch default, root folder). Ada `.nojekyll`.
- Belum diputuskan: nanti dijadikan aplikasi yang bisa diunduh (store), atau cukup dibagikan lewat link (PWA).

## Pengguna, bahasa & desain
- Mayoritas anak muda. Semua teks UI dan suara coach pakai bahasa Indonesia santai, tidak kaku (contoh gaya: "Gas latihan bebas", "Kenceng", "nggak dihitung"). Suara coach juga punya opsi bahasa Inggris.
- Terinspirasi ShadowSwing, tapi tampilan harus jelas berbeda: sporty, warna netral gender (aksen hijau toska `#0B6B60`), tema terang/gelap.
- Font self-hosted: Inter + Plus Jakarta Sans (folder `fonts/`).

## Struktur & teknologi
- HTML/CSS/JS murni, tanpa build step, tanpa framework, tanpa server, tanpa akun.
- `index.html` — kerangka kosong; seluruh UI dirender oleh `app.js` ke `#app`.
- `app.js` (~2.600 baris, satu IIFE) — semua logika. Dibagi per bagian dengan komentar `/* ===== nama ===== */`: constants, storage, audio, coach voice, wake lock, motion sensors, swing detection, racket-head speed, screen lock, routing, screens (home, free hitting, how to hold, shot analysis, replay 3D, workouts, progress, backup & restore, settings, sensor test), swing geometry & ball flight, 3D replay engine, boot.
- `style.css` — semua gaya. `vendor/three.min.js` (three.js r149) dimuat saat replay 3D dibuka.
- `sw.js` — service worker offline. App shell *network-first*; `vendor/`, `icons/`, `fonts/` *cache-first*. Naikkan `CACHE` (sekarang `paaadel-v5`) kalau mengganti file di folder-folder itu.
- `manifest.webmanifest` — PWA (standalone, portrait).
- Data hanya di `localStorage` HP: kunci `paaadel.v1` (pengaturan, statistik, rekor, program) dan `paaadel.replays.v1` (replay). Jaga kompatibilitas data lama: setiap pengaturan baru harus punya default di `DEFAULTS` dan data lama dimigrasi saat load, bukan dihapus.
- `window.PALA_PREVIEW` = mode pratinjau desain (tanpa sensor, ayunan simulasi).

## Cara deteksi ayunan (ringkas)
- Berdasarkan rotasi yang menggerakkan kepala raket (`|ω × y|`), bukan putaran pergelangan di sumbu panjang HP. Layar = muka forehand, belakang HP = muka backhand.
- Sensitivitas Santai/Sedang/Kenceng: ambang kecepatan dan sapuan minimum `MIN_SWEEP` 18/28/38°. Ayunan yang kebanyakan muter pergelangan (twist) ditolak.
- Ancang-ancang, balik ke posisi siap, dan raket jatuh di belakang punggung sebelum smash tidak dihitung. Overhead (bandeja, víbora, smash) punya aturan sendiri.
- Posisi bola di analisis 3D: titik kena per pukulan (`CONTACT` di app.js, tabel di README), jalur ayunan digeser ke titik itu.
- Kecepatan kepala raket = kecepatan tangan (akselerometer, diintegrasikan) + lecutan (giroskop × `R_HEAD` 0,32 m). Tanpa akselerometer: giroskop × `LEVER` 0,62 m. Bola ≈ raket × `BALL_RATIO` 1,35.
- Sumbu giroskop/akselerometer beda antara iPhone dan Android; app mengkalibrasi sendiri. Debug: Pengaturan → Tes sensor (bisa rekam data mentah 15 detik), dan `window.__detLog` mencatat event deteksi.

## Fitur yang sudah jadi
Latihan bebas (speedometer, sensitivitas), zona kecepatan, skor konsistensi, analisis & replay 3D satu pukulan (8 jenis pukulan, sudut muka raket, spin, lintasan bola dengan efek Magnus, pantulan), 7 program drill + program buatan sendiri dengan suara coach, progres (streak, tren, kalender 17 minggu), backup & pulihkan (.json / kode, mode Gabungin/Timpa), kunci layar otomatis, satuan km/h atau mph.

## Aturan kerja
- Sensor gerak butuh HTTPS, dan di iPhone izin `DeviceMotionEvent.requestPermission()` harus dipicu tap pengguna. Alur share/backup harus tetap sinkron sampai `navigator.share` (aturan iOS).
- Selalu uji di HP asli (iPhone Safari dan Android Chrome), bukan hanya di desktop.
- Jalankan `node --check app.js` sebelum commit. Untuk tes lokal di browser: `python3 -m http.server` lalu buka lewat HTTPS/tunnel di HP.
- Perubahan kecil dan terarah; jangan merombak struktur satu-file kecuali diminta.

## Berikutnya / prioritas
- (belum ditentukan pemilik)
