# PAAADEL

**Latihan padel di rumah biar kamu makin jago di lapangan.**

Web app (PWA) buat latihan shadow swing padel pakai sensor gerak HP. Pegang HP kayak gagang raket, ayunin, dan PAAADEL ngitung rep, ngira-ngira kecepatan raket & bola, muter ulang pukulan dalam 3D, sampai mandu drill pakai suara coach.

## Fitur
- **Latihan bebas** — tiap lecutan pergelangan yang cukup kencang = 1 rep. Speedometer kecepatan bola, raket, terbaik, plus sensitivitas Santai/Sedang/Kenceng.
- **Zona kecepatan** — latihan kontrol: set target kecepatan bola (preset Kontrol/Tempo/Power dari rekormu). Bunyi *tring* kalau masuk zona, *tuk* kalau meleset.
- **Skor konsistensi** — persentase ayunan dalam ±5 km/h dari median sesi, riwayat ayunan live, dan rata-rata 7 hari di Progres.
- **Analisis 3D** — tik, tik, ding, lalu satu pukulan (Forehand, Backhand, Voli, Bandeja, Víbora, Smash, Lob, Servis) diputar ulang di lapangan padel 3D: pita lintasan warna kecepatan, raket bayangan, titik kena, slow motion ¼× ½× 1×.
  Plus **sudut muka raket saat kena** (terbuka/tertutup) dibanding patokan tiap pukulan, tinggi kepala raket, dan waktu lecutan.
- **Program** — 7 drill padel siap pakai + bikin program sendiri. Suara coach bahasa Indonesia atau Inggris.
- **Progres** — total ayunan, hari beruntun, tren kecepatan, ayunan per hari/minggu/bulan, kalender 17 minggu, komposisi pukulan.
- **Backup & pulihkan** — simpan semua progres (statistik, rekor, program buatan, replay) ke satu file .json lewat Share → Save to Files/Drive, atau salin sebagai kode. Pulihkan dengan mode *Gabungin* (tanpa dobel hitung) atau *Timpa*. Ada pengingat backup setelah 100+ ayunan.
- **Kunci layar** otomatis pas ngayun, tema terang/gelap, satuan km/h atau mph.

## Pakai di iPhone
1. Buka link-nya di **Safari** (wajib https).
2. Tap **Gas latihan bebas** → pilih **Izinkan** buat Gerakan & Orientasi.
3. Biar kayak aplikasi: Share → **Add to Home Screen**. Bisa dipakai offline juga.
4. Nyalain volume media (bunyi "pok" keluar dari speaker).

## Cara ayunan dideteksi
- Yang dihitung cuma **ayunan maju dengan layar HP (muka raket) di depan**: putaran di sumbu lebar layar, arah positif.
- **Ancang-ancang** (raket ditarik ke belakang) arahnya kebalikan, jadi nggak pernah dihitung.
- **Ayunan pendek** (sapuan < 15/25/35° untuk Santai/Sedang/Kenceng) dan **muter pergelangan** (putaran di sumbu panjang HP) ditolak tanpa bunyi, dan aplikasinya ngasih tahu alasannya.
- Urutan sumbu giroskop beda antara iPhone dan Android, jadi PAAADEL mengkalibrasi sendiri dengan membandingkan giroskop dan sensor orientasi beberapa detik pertama (cek di Pengaturan → Tes sensor).

## Arah bola (Analisis 3D)
Setelah titik kena, bola diluncurkan dari perkiraan arah muka raket (70%) dan arah ayunan (30%) dengan kecepatan bola ≈, lalu dihitung lintasannya (gravitasi + hambatan udara): masuk, nyangkut net, kepanjangan, atau melebar. Kamera bisa Auto, Ayunan, Samping (buat lihat sudut muka raket), atau Lapangan.

## Kecepatan
Kecepatan raket = kecepatan putar giroskop × tuas 0,62 m. Kecepatan bola ≈ raket × 1,35. Buat bandingin progres sendiri, bukan pengganti radar; bisa dikalibrasi di Pengaturan.

## Teknis
HTML/CSS/JS murni, three.js r149 buat replay 3D, font Inter + Plus Jakarta Sans (self-hosted). Data disimpan di `localStorage` HP. Tanpa server, tanpa akun. Bisa di-hosting di hosting statis apa pun yang https (GitHub Pages, Netlify, hosting website biasa).
