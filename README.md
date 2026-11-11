# CloudStead

Teman belajar di atas awan. Nyalakan timer fokus, putar musik YouTube-mu sendiri, dan lihat VMK
membangun pulau kecilnya: selama kamu fokus, dia menarik petak baru dari awan, menanam kebun, memasang
pondok, sampai membuka air terjun ke lautan awan. Pulaunya tidak pernah berubah sendiri; semua dibangun
VMK.

![CloudStead](public/share.jpg)

## Menjalankan

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # hasil di dist/
npm run preview
```

Butuh Node 20 atau lebih baru dan browser dengan WebGL. Tanpa WebGL, timer, musik, dan progres
tetap berjalan; hanya pulaunya yang tidak tergambar.

## Cara kerja

- **Timer fokus.** Pola 25/5 (4 putaran, istirahat panjang 15 menit) atau 50/10 (3 putaran,
  istirahat panjang 20 menit). VMK hanya bekerja selama fase fokus berjalan.
- **VMK yang membangun.** 28 proyek, dari bunga liar di menit ke-5 sampai air terjun di 23 jam
  20 menit; pulau mulai dari 9 petak dan menjadi 37. Selama fase fokus berjalan, VMK mengerjakan
  proyek berikutnya dan hasilnya naik sedikit demi sedikit sesuai persentasenya:
  - bangunan: dia mengangkut kayu dari peti di tempat duduknya lalu memalu;
  - tanaman: dia menggali lalu menyiram;
  - petak baru: dia menariknya dari awan dengan tali;
  - perlengkapan (bantal, syal, kupluk, mug, buku, headphone): dia membuatnya sambil duduk.

  Saat istirahat VMK ikut istirahat. Tanpa timer dia jalan-jalan, menyiram tanaman, mengecek
  proyeknya, atau main laptop, dan proyeknya berhenti di persentase terakhir. Daftar lengkapnya ada
  di panel **Pulau** dan di [src/sim/milestones.ts](src/sim/milestones.ts).
