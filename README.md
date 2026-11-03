# PAAADEL

**Latihan padel di rumah biar kamu makin jago di lapangan.**

Web app (PWA) buat latihan shadow swing padel pakai sensor gerak HP. Pegang HP kayak gagang raket, ayunin, dan PAAADEL ngitung rep, ngira-ngira kecepatan raket & bola, muter ulang pukulan dalam 3D, sampai mandu drill pakai suara coach.

## Fitur
- **Latihan bebas** — tiap lecutan pergelangan yang cukup kencang = 1 rep. Speedometer kecepatan bola, raket, terbaik, plus sensitivitas Santai/Sedang/Kenceng.
- **Zona kecepatan** — latihan kontrol: set target kecepatan bola (preset Kontrol/Tempo/Power dari rekormu). Bunyi *tring* kalau masuk zona, *tuk* kalau meleset.
- **Skor konsistensi** — persentase ayunan dalam ±5 km/h dari median sesi, riwayat ayunan live, dan rata-rata 7 hari di Progres.
- **Analisis 3D** — tik, tik, ding, lalu satu pukulan (Forehand, Backhand, Voli, Bandeja, Víbora, Smash, Lob, Servis) diputar ulang dari 2 detik sebelum kena sampai follow-through, di lapangan padel 3D (rumput biru, kaca, jaring): raket padel yang bergerak sesuai gerak tanganmu, raket bayangan, garis oranye di bagian paling kencang (tempat bola harusnya kena), bayangan di lantai, bola kuning + arah terbangnya, slow motion ¼× ½× 1×.
  Plus **sudut muka raket saat kena** (terbuka/tertutup) di sisi yang mukul (muka forehand/backhand), tinggi kepala raket, waktu lecutan, dan **spin** (slice, topspin, spin samping + rpm). Belum pas? Tombol **Ulangi** langsung rekam pukulan yang sama lagi.
- **Program** — 7 drill padel siap pakai + bikin program sendiri. Suara coach bahasa Indonesia atau Inggris.
- **Progres** — total ayunan, hari beruntun, tren kecepatan, ayunan per hari/minggu/bulan, kalender 17 minggu, komposisi pukulan.
- **Backup & pulihkan** — simpan semua progres (statistik, rekor, program buatan, replay) ke satu file .json lewat Share → Save to Files/Drive, atau salin sebagai kode. Pulihkan dengan mode *Gabungin* (tanpa dobel hitung) atau *Timpa*. Ada pengingat backup setelah 100+ ayunan.
- **Profil** — tinggi badan, berat badan (opsional), dan tangan dominan. Ditanya di beranda; tinggi badan bikin posisi bola & jangkauan tangan di Analisis 3D pas sama badanmu.
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
- **Overhead** (bandeja, víbora, smash = kepala raket jauh di atas tangan pas paling kencang): putaran lengan bawah (pronasi) víbora boleh, ngangkat raket ke posisi siap nggak dihitung, dan **raket jatuh di belakang punggung** sebelum smash nggak dihitung sebagai pukulan. Bandeja yang didorong lengan (raketnya muter pelan tapi tangannya cepat) tetap kehitung dari kecepatan kepala raketnya (tangan + lecutan). Kalau yang sempat kehitung ternyata cuma ancang-ancang dari pukulan yang jauh lebih kencang, angkanya diganti ke pukulan itu (hitungan tetap 1).
- Urutan sumbu giroskop dan tanda akselerometer beda antara iPhone dan Android, jadi PAAADEL mengkalibrasi sendiri (giroskop vs sensor orientasi, akselerometer vs gravitasi). Cek di Pengaturan → Tes sensor; di situ juga bisa **rekam data mentah 15 detik** buat dikirim kalau deteksinya masih aneh.

## Arah bola (Analisis 3D)
**Titik kena beda tiap pukulan.** Sensor HP cuma tahu bentuk ayunan, bukan posisi badanmu di lapangan, jadi bola ditaruh di titik kena yang umum buat tiap pukulan, lalu ayunan yang terekam digeser ke situ. Angka di bawah buat pemain 175 cm; semuanya (tinggi, jangkauan, bahu) ikut diskalakan sama **tinggi badan di Profil** (misal 184 cm → bandeja ±1,9 m, smash ±2,5 m):

| Pukulan | Tinggi bola | Posisi |
|---|---|---|
| Lob | ±0,55 m (lutut–paha) | samping, ikut sisi muka raket yang mukul |
| Servis | ±0,7 m (di bawah pinggang) | samping forehand |
| Backhand | ±0,9 m (pinggang) | sisi backhand |
| Forehand | ±0,95 m (pinggang) | sisi forehand |
| Voli | ±1,25 m (dada) | jauh di depan badan, ikut sisi muka raket |
| Bandeja | ±1,8 m (sejajar kepala) | sedikit di depan & samping |
| Víbora | ±1,95 m (sedikit di atas kepala) | lebih ke samping |
| Smash | ±2,35 m (tangan lurus ke atas) | hampir di atas kepala |

Arah raket, sudut muka, dan jalur tangan tetap dari sensor.

Pas kena, kecepatan kepala raket dibagi dua: bagian yang **ngedorong lurus muka raket** (bola ≈ 1,35× bagian itu) dan bagian yang **motong menyamping di muka raket** (slice bandeja, potongan samping víbora, low-to-high topspin). Bagian yang motong nambah sedikit laju ke arah itu dan bikin bola **berputar** (permukaan bola ≈ 0,6× kecepatan potongan). Lintasannya dihitung pakai gravitasi, hambatan udara, dan **efek Magnus**: backspin bikin bola melayang, topspin bikin cepat turun, spin samping bikin melengkung. Buat overhead, tenaga bola lob yang datang ikut dihitung. Kalau masuk, bola mantul (74% kecepatan jatuhnya, gesekan sama spin: slice mantul rendah, víbora nendang ke samping) terus diikutin sampai kaca. Hasilnya: masuk, nyangkut net, kepanjangan, atau melebar, plus spin dan tinggi pantulan. Titik kena diambil di antara dua data sensor (bukan cuma data terdekat) biar sudut muka raketnya stabil. Lapangan diputar supaya bola keluar ke arah net. Kamera bisa Auto, Belakang (kayak dilihat dari belakang pemain), Samping (buat lihat sudut muka raket), atau Lapangan.

## Kecepatan
Kecepatan kepala raket = **kecepatan tangan** (akselerometer, dijumlahin sepanjang ayunan, di-nol-in tiap HP sempat diam) **+ lecutan** (putaran giroskop × 32 cm, jarak tangan ke tengah kepala raket), di detik paling kencang. HP tanpa akselerometer pakai giroskop aja (putaran × 0,62 m). Kecepatan bola ≈ raket × 1,35. Buat bandingin progres sendiri, bukan pengganti radar; bisa dikalibrasi di Pengaturan.

## Teknis
HTML/CSS/JS murni, three.js r149 buat replay 3D, font Inter + Plus Jakarta Sans (self-hosted). Data disimpan di `localStorage` HP. Tanpa server, tanpa akun. Bisa di-hosting di hosting statis apa pun yang https (GitHub Pages, Netlify, hosting website biasa).
