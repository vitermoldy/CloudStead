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
