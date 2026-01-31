document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('meteor-container');

  function spawnMeteor() {
    const meteor = document.createElement('div');
    meteor.classList.add('meteor');

    // posisi awal di kanan atas
    const startX = window.innerWidth + Math.random() * 200; // di luar kanan layar
    const startY = -100 - Math.random() * 50; // sedikit acak atas layar

    meteor.style.left = startX + 'px';
    meteor.style.top = startY + 'px';

    container.appendChild(meteor);

    // durasi jatuh
    const duration = 4000 + Math.random() * 2000; // 4-6 detik

    // posisi akhir → kiri bawah diagonal jelas
    const endX = -100 - Math.random() * 200; // keluar layar kiri
    const endY = window.innerHeight + 200 + Math.random() * 100; // keluar bawah layar

    // animasi smooth linear
    setTimeout(() => {
      meteor.style.transition = `top ${duration}ms linear, left ${duration}ms linear, opacity ${duration}ms linear`;
      meteor.style.top = endY + 'px';
      meteor.style.left = endX + 'px';
      meteor.style.opacity = 0;
    }, 50);

    // hapus meteor setelah animasi selesai
    setTimeout(() => meteor.remove(), duration + 200);
  }

  // spawn meteor setiap 2–3 detik random
  function spawnRandom() {
    spawnMeteor();
    const next = 1000 + Math.random() * 1000; // delay 2-3 detik
    setTimeout(spawnRandom, next);
  }

  spawnRandom();
});
