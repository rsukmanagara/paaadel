# PAAADEL

**Latihan padel di rumah biar kamu makin jago di lapangan.**

Web app (PWA) buat latihan shadow swing padel pakai sensor gerak HP. Pegang HP kayak gagang raket, ayunin, dan PAAADEL ngitung rep, ngira-ngira kecepatan raket & bola, muter ulang pukulan dalam 3D, sampai mandu drill pakai suara coach.

## Fitur
- **Latihan bebas** — tiap lecutan pergelangan yang cukup kencang = 1 rep. Speedometer kecepatan bola, raket, terbaik, plus sensitivitas Santai/Sedang/Kenceng.
- **Zona kecepatan** — latihan kontrol: set target kecepatan bola (preset Kontrol/Tempo/Power dari rekormu). Bunyi *tring* kalau masuk zona, *tuk* kalau meleset.
- **Skor konsistensi** — persentase ayunan dalam ±5 km/h dari median sesi, riwayat ayunan live, dan rata-rata 7 hari di Progres.
- **Analisis 3D** — tik, tik, ding, lalu satu pukulan (Forehand, Backhand, Voli, Bandeja, Víbora, Smash, Lob, Servis) diputar ulang dari 2 detik sebelum kena sampai follow-through, di lapangan padel 3D (rumput biru, kaca, jaring): raket padel yang bergerak sesuai gerak tanganmu, raket bayangan, garis oranye di bagian paling kencang (tempat bola harusnya kena), bayangan di lantai, bola kuning + arah terbangnya, slow motion ¼× ½× 1×.
  Plus **sudut muka raket saat kena** (terbuka/tertutup) di sisi yang mukul (muka forehand/backhand), tinggi kepala raket, dan waktu lecutan.
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
- Yang dibaca: putaran yang **bikin kepala raket bergerak** (bukan putaran pergelangan di sumbu panjang HP). Layar HP = muka forehand, belakang HP = muka backhand, jadi **forehand dan backhand dua-duanya kehitung**.
- Satu "dorongan" = kepala raket bergerak ke satu arah sampai melambat atau balik arah. Dihitung kalau cukup kencang (Santai/Sedang/Kenceng), sapuannya cukup panjang (≥ 18/28/38°), dan bukan kebanyakan muter pergelangan.
- **Ancang-ancang**: dorongan ke belakang yang disusul dorongan lebih kencang ke depan. Pukulan yang keluar langsung dari ancang-ancang dihitung saat itu juga; dorongan yang berdiri sendiri ditunggu ±0,2–0,4 detik buat lihat apa yang nyusul.
- Setelah beberapa pukulan, PAAADEL tahu arah "depan" (ke net) dan **nggak ngitung dorongan ke belakang** (ancang-ancang, balik ke posisi siap), walau ada jeda sebelum ngayun.
- Urutan sumbu giroskop dan tanda akselerometer beda antara iPhone dan Android, jadi PAAADEL mengkalibrasi sendiri (giroskop vs sensor orientasi, akselerometer vs gravitasi). Cek di Pengaturan → Tes sensor; di situ juga bisa **rekam data mentah 15 detik** buat dikirim kalau deteksinya masih aneh.

## Arah bola (Analisis 3D)
Setelah titik kena, bola diluncurkan dari perkiraan arah muka raket (70%) dan arah ayunan (30%) dengan kecepatan bola ≈, lalu dihitung lintasannya (gravitasi + hambatan udara): masuk, nyangkut net, kepanjangan, atau melebar. Lapangan diputar supaya arah gerak kepala raket pas kena = ke net, jadi forehand dan backhand sama-sama ngadep depan. Kamera bisa Auto, Belakang (kayak dilihat dari belakang pemain), Samping (buat lihat sudut muka raket), atau Lapangan.

## Kecepatan
Kecepatan kepala raket = **kecepatan tangan** (akselerometer, dijumlahin sepanjang ayunan, di-nol-in tiap HP sempat diam) **+ lecutan** (putaran giroskop × 32 cm, jarak tangan ke tengah kepala raket), di detik paling kencang. HP tanpa akselerometer pakai giroskop aja (putaran × 0,62 m). Kecepatan bola ≈ raket × 1,35. Buat bandingin progres sendiri, bukan pengganti radar; bisa dikalibrasi di Pengaturan.

## Teknis
HTML/CSS/JS murni, three.js r149 buat replay 3D, font Inter + Plus Jakarta Sans (self-hosted). Data disimpan di `localStorage` HP. Tanpa server, tanpa akun. Bisa di-hosting di hosting statis apa pun yang https (GitHub Pages, Netlify, hosting website biasa).
