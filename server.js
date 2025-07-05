const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { randomUUID } = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname + '/public'));

const rooms = {};

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const categories = {
  benda: [
    { q: 'Benda apa yang digunakan untuk menulis di atas kertas?', a: 'pena', c: 'Berisi tinta dan punya ujung runcing.' },
    { q: 'Benda yang digunakan untuk menghapus tulisan pensil?', a: 'penghapus', c: 'Biasa berwarna putih atau merah muda.' },
    { q: 'Benda yang dipakai untuk mengukur panjang?', a: 'penggaris', c: 'Memiliki angka dan satuan cm atau inch.' },
    { q: 'Benda yang digunakan untuk memotong kertas?', a: 'gunting', c: 'Terdiri dari dua bilah tajam dan gagang.' },
    { q: 'Benda yang digunakan untuk menerangi ruangan?', a: 'lampu', c: 'Sumber cahaya buatan di rumah.' },
    { q: 'Benda yang digunakan untuk memasak nasi?', a: 'rice cooker', c: 'Alat elektronik untuk memasak nasi.' },
    { q: 'Benda untuk melihat waktu?', a: 'jam', c: 'Menampilkan detik, menit, dan jam.' },
    { q: 'Benda yang digunakan untuk menyapu lantai?', a: 'sapu', c: 'Biasanya memiliki gagang panjang dan bulu di ujungnya.' },
    { q: 'Benda yang digunakan untuk duduk?', a: 'kursi', c: 'Biasanya memiliki sandaran dan empat kaki.' },
    { q: 'Benda untuk tidur?', a: 'kasur', c: 'Bisa empuk dan dilapisi sprei.' },
    { q: 'Benda untuk menonton acara TV?', a: 'televisi', c: 'Menampilkan gambar bergerak dan suara.' },
    { q: 'Benda untuk menghubungi orang lain?', a: 'telepon', c: 'Sekarang bisa pintar dan layar sentuh.' },
    { q: 'Benda untuk menyimpan makanan dingin?', a: 'kulkas', c: 'Dingin dan memiliki pintu.' },
    { q: 'Benda untuk memasak air?', a: 'teko listrik', c: 'Bisa menyala dan mati otomatis.' },
    { q: 'Benda untuk menulis permanen?', a: 'spidol', c: 'Biasanya untuk whiteboard.' },
    { q: 'Benda untuk menggambar?', a: 'pensil warna', c: 'Punya berbagai warna dan digunakan di kertas.' },
    { q: 'Benda untuk membawa barang belanjaan?', a: 'tas', c: 'Bisa dari plastik, kain, atau kertas.' },
    { q: 'Benda yang digunakan saat hujan?', a: 'payung', c: 'Melindungi tubuh dari air hujan.' },
    { q: 'Benda untuk mengeringkan tubuh?', a: 'handuk', c: 'Biasanya digunakan setelah mandi.' },
    { q: 'Benda untuk melihat sesuatu lebih besar?', a: 'kaca pembesar', c: 'Digunakan untuk memperbesar tulisan kecil.' }
  ],
  hewan: [
    { q: 'Hewan apa yang bisa terbang dan berkicau?', a: 'burung', c: 'Punya sayap dan paruh.' },
    { q: 'Hewan berkaki empat yang sering dipelihara?', a: 'kucing', c: 'Suka mengeong dan manja.' },
    { q: 'Hewan penghasil susu?', a: 'sapi', c: 'Bertubuh besar dan sering ada di peternakan.' },
    { q: 'Hewan dengan belalai?', a: 'gajah', c: 'Besar dan punya gading.' },
    { q: 'Hewan amfibi yang bisa melompat?', a: 'katak', c: 'Suka di air dan daun.' },
    { q: 'Hewan yang menggonggong?', a: 'anjing', c: 'Teman manusia dan penjaga rumah.' },
    { q: 'Hewan bercangkang dan berjalan lambat?', a: 'siput', c: 'Bisa menempel di dinding.' },
    { q: 'Hewan yang hidup di laut dan punya tentakel?', a: 'gurita', c: 'Punya delapan lengan.' },
    { q: 'Hewan yang bisa menyala di malam hari?', a: 'kunang-kunang', c: 'Bersinar dari tubuhnya.' },
    { q: 'Hewan bersayap yang suka madu?', a: 'lebah', c: 'Menghasilkan madu dan suka bunga.' },
    { q: 'Hewan yang bisa berubah warna?', a: 'bunglon', c: 'Pandai berkamuflase.' },
    { q: 'Hewan bertubuh panjang tanpa kaki?', a: 'ular', c: 'Berbisa dan merayap.' },
    { q: 'Hewan laut berkulit keras dan bercapit?', a: 'kepiting', c: 'Suka berjalan menyamping.' },
    { q: 'Hewan dengan bulu tebal dan hidup di kutub?', a: 'beruang kutub', c: 'Hidup di salju.' },
    { q: 'Hewan malam yang bersuara "hoo hoo"?', a: 'burung hantu', c: 'Matanya besar dan aktif di malam hari.' },
    { q: 'Hewan kecil dengan sayap bening?', a: 'nyamuk', c: 'Suka menggigit manusia.' },
    { q: 'Hewan berkaki dua yang suka menirukan suara?', a: 'beo', c: 'Bisa bicara seperti manusia.' },
    { q: 'Hewan berkaki delapan yang membuat jaring?', a: 'laba-laba', c: 'Sering ditemukan di sudut rumah.' },
    { q: 'Hewan berkepala dua di mitologi?', a: 'naga', c: 'Makhluk legendaris.' },
    { q: 'Hewan yang suka wortel?', a: 'kelinci', c: 'Telinganya panjang dan suka melompat.' }
  ],
  tumbuhan: [
    { q: 'Tumbuhan yang menghasilkan oksigen?', a: 'pohon', c: 'Besar dan punya batang serta daun.' },
    { q: 'Tumbuhan yang sering dipakai memasak dan beraroma?', a: 'daun bawang', c: 'Bentuknya panjang dan hijau.' },
    { q: 'Tumbuhan dengan bunga wangi dan berduri?', a: 'mawar', c: 'Simbol cinta.' },
    { q: 'Tumbuhan yang menghasilkan buah pisang?', a: 'pohon pisang', c: 'Daunnya besar.' },
    { q: 'Tumbuhan kecil berwarna hijau di tanah?', a: 'lumut', c: 'Suka tumbuh di tempat lembap.' },
    { q: 'Tumbuhan menjalar yang bisa memanjat dinding?', a: 'sirih', c: 'Sering digunakan untuk pengobatan tradisional.' },
    { q: 'Tumbuhan yang menghasilkan kopi?', a: 'kopi', c: 'Buahnya diproses jadi minuman hitam.' },
    { q: 'Tumbuhan yang memiliki bunga berwarna kuning dan biji besar?', a: 'bunga matahari', c: 'Menghadap ke arah cahaya.' },
    { q: 'Tumbuhan yang digunakan untuk menyedapkan rasa?', a: 'serai', c: 'Berbentuk batang panjang dan aromatik.' },
    { q: 'Tumbuhan yang memiliki getah putih lengket?', a: 'karet', c: 'Sumber bahan untuk ban.' },
    { q: 'Tumbuhan yang menghasilkan buah jeruk?', a: 'pohon jeruk', c: 'Buahnya kaya vitamin C.' },
    { q: 'Tumbuhan berduri yang hidup di gurun?', a: 'kaktus', c: 'Simpan air di dalam batangnya.' },
    { q: 'Tumbuhan air yang hidup di kolam?', a: 'teratai', c: 'Daunnya mengambang.' },
    { q: 'Tumbuhan dengan akar di udara?', a: 'anggrek', c: 'Bunganya cantik dan eksotis.' },
    { q: 'Tumbuhan dengan batang menjalar dan buah besar?', a: 'labu', c: 'Buahnya biasa dipakai untuk Halloween.' },
    { q: 'Tumbuhan penghasil cabai?', a: 'cabai', c: 'Buahnya pedas dan merah.' },
    { q: 'Tumbuhan tinggi penghasil kayu?', a: 'jati', c: 'Kayunya kuat dan mahal.' },
    { q: 'Tumbuhan kecil dalam pot sebagai hiasan?', a: 'bonsai', c: 'Miniatur pohon.' },
    { q: 'Tumbuhan dengan bunga harum di malam hari?', a: 'melati', c: 'Bunganya kecil dan putih.' },
    { q: 'Tumbuhan yang menghasilkan buah apel?', a: 'pohon apel', c: 'Buahnya manis dan renyah.' }
  ],
  pekerjaan: [
    { q: 'Orang yang mengajar murid di sekolah?', a: 'guru', c: 'Biasanya ada di kelas.' },
    { q: 'Orang yang merawat pasien di rumah sakit?', a: 'dokter', c: 'Memakai jas putih.' },
    { q: 'Orang yang memasak di restoran?', a: 'koki', c: 'Pakai topi putih tinggi.' },
    { q: 'Orang yang menangkap penjahat?', a: 'polisi', c: 'Pakai seragam dan peluit.' },
    { q: 'Orang yang membangun rumah?', a: 'tukang', c: 'Biasa bawa palu dan semen.' },
    { q: 'Orang yang mengemudikan pesawat?', a: 'pilot', c: 'Terbangkan pesawat.' },
    { q: 'Orang yang menggambar bangunan?', a: 'arsitek', c: 'Merancang desain rumah atau gedung.' },
    { q: 'Orang yang bekerja di kebun?', a: 'petani', c: 'Menanam padi dan sayuran.' },
    { q: 'Orang yang menyanyi di panggung?', a: 'penyanyi', c: 'Bersuara merdu dan sering konser.' },
    { q: 'Orang yang mengatur lalu lintas?', a: 'polantas', c: 'Pakai peluit di jalan.' },
    { q: 'Orang yang memperbaiki mobil?', a: 'montir', c: 'Bekerja di bengkel.' },
    { q: 'Orang yang memadamkan api?', a: 'pemadam kebakaran', c: 'Menggunakan mobil merah.' },
    { q: 'Orang yang menulis berita?', a: 'wartawan', c: 'Mencari fakta dan informasi.' },
    { q: 'Orang yang menjahit pakaian?', a: 'penjahit', c: 'Pakai mesin jahit.' },
    { q: 'Orang yang memainkan peran di film?', a: 'aktor', c: 'Berakting di depan kamera.' },
    { q: 'Orang yang berdagang di pasar?', a: 'pedagang', c: 'Menjual barang ke pembeli.' },
    { q: 'Orang yang memotret?', a: 'fotografer', c: 'Pakai kamera profesional.' },
    { q: 'Orang yang membuat program komputer?', a: 'programmer', c: 'Mengetik kode setiap hari.' },
    { q: 'Orang yang menggambar ilustrasi?', a: 'desainer grafis', c: 'Menggunakan software seperti Photoshop.' },
    { q: 'Orang yang mengurus pasien dan bukan dokter?', a: 'perawat', c: 'Memberi obat dan cek suhu.' }
  ]
};
const categories = {
  benda: [...Array(30)].map((_, i) => ({
    q: `Benda apa yang sering dipakai sehari-hari dan bernama benda-${i + 1}?`,
    a: `benda${i + 1}`,
    c: `Digunakan dalam aktivitas harian.`
  })),
  hewan: [...Array(30)].map((_, i) => ({
    q: `Hewan yang umum ditemukan dan dikenal sebagai hewan-${i + 1}?`,
    a: `hewan${i + 1}`,
    c: `Biasa hidup di darat atau air.`
  })),
  tumbuhan: [...Array(30)].map((_, i) => ({
    q: `Tumbuhan yang bisa ditemukan di lingkungan dan bernama tumbuhan-${i + 1}?`,
    a: `tumbuhan${i + 1}`,
    c: `Mengandung klorofil.`
  })),
  pekerjaan: [...Array(30)].map((_, i) => ({
    q: `Seseorang dengan profesi pekerjaan-${i + 1} bekerja di bidang apa?`,
    a: `pekerjaan${i + 1}`,
    c: `Membutuhkan keterampilan tertentu.`
  }))
};

function shuffle(arr) {
  return arr.map(v => [v, Math.random()]).sort((a, b) => a[1] - b[1]).map(([v]) => v);
}

function generateQuestionsByCategory(category) {
  if (!categories[category]) return [];
  return shuffle(categories[category]).slice(0, 20);
}

io.on('connection', (socket) => {
  socket.on('createRoom', ({ nickname, category }) => {
    if (!nickname || !category) return socket.emit('feedback', 'Nama dan kategori wajib diisi!');

    const roomCode = generateRoomCode();
    const questions = generateQuestionsByCategory(category);

    rooms[roomCode] = {
      players: [{ id: socket.id, nickname, score: 0, hasSurrendered: false }],
      questionList: questions,
      questionIndex: 0,
      clueUsed: false,
      currentTurnIndex: 0,
      started: false,
      hostId: socket.id,
      category
    };

    socket.join(roomCode);
    io.to(roomCode).emit('joined', {
      players: rooms[roomCode].players.map(p => p.nickname),
      room: roomCode,
      isHost: true
    });
  });

    socket.on('joinRoom', ({ nickname, roomCode }) => {
    if (!nickname || !roomCode) return socket.emit('feedback', 'Nama dan kode ruangan wajib diisi!');

    const room = rooms[roomCode];
    if (!room) return socket.emit('feedback', 'Ruangan tidak ditemukan!');
    if (room.started) return socket.emit('feedback', 'Permainan sudah dimulai!');

    // Tambahkan pemain ke dalam ruangan
    room.players.push({ id: socket.id, nickname, score: 0, hasSurrendered: false });

    socket.join(roomCode);

    io.to(roomCode).emit('joined', {
      players: room.players.map(p => p.nickname),
      room: roomCode,
      isHost: socket.id === room.hostId
    });
  });

  socket.on('startGame', ({ room }) => {
    const roomData = rooms[room];
    if (!roomData || socket.id !== roomData.hostId) return;
    if (roomData.players.length < 2) {
      socket.emit('feedback', 'Minimal 2 pemain untuk mulai permainan!');
      return;
    }
    roomData.started = true;
    const question = roomData.questionList[roomData.questionIndex];
    io.to(room).emit('question', question.q);
    const currentPlayer = roomData.players[roomData.currentTurnIndex];
    io.to(room).emit('turn', currentPlayer.nickname);
  });

  socket.on('answer', ({ room, answer }) => {
    const roomData = rooms[room];
    if (!roomData || !roomData.started) return;

    const currentPlayer = roomData.players[roomData.currentTurnIndex];
    if (socket.id !== currentPlayer.id) return socket.emit('feedback', '⏳ Bukan giliran kamu!');
    if (currentPlayer.hasSurrendered) return socket.emit('feedback', 'Kamu sudah nyerah.');

    const currentQuestion = roomData.questionList[roomData.questionIndex];
    const correct = answer.toLowerCase().includes(currentQuestion.a.toLowerCase());

    if (correct) {
      currentPlayer.score += 1;
      io.to(room).emit('feedback', `✅ ${currentPlayer.nickname} benar!`);
      io.to(room).emit('updateScore', {
        scores: roomData.players.map(p => ({ nickname: p.nickname, score: p.score }))
      });
      if (currentPlayer.score >= 20) {
        io.to(room).emit('showWinner', currentPlayer.nickname);
        return;
      }

      roomData.questionIndex++;
      if (roomData.questionIndex >= roomData.questionList.length) {
        const winner = roomData.players.reduce((max, p) => p.score > max.score ? p : max, roomData.players[0]);
        io.to(room).emit('showWinner', winner.nickname);
        return;
      }

      roomData.players.forEach(p => p.hasSurrendered = false);
      roomData.clueUsed = false;
      roomData.currentTurnIndex = (roomData.currentTurnIndex + 1) % roomData.players.length;

      const nextQ = roomData.questionList[roomData.questionIndex];
      io.to(room).emit('transition');
      setTimeout(() => {
        io.to(room).emit('question', nextQ.q);
        io.to(room).emit('turn', roomData.players[roomData.currentTurnIndex].nickname);
      }, 500);
    } else {
      currentPlayer.score += 0.5;
      socket.emit('feedback', '❌ Salah, giliran berpindah!');
      io.to(room).emit('updateScore', {
        scores: roomData.players.map(p => ({ nickname: p.nickname, score: p.score }))
      });
      roomData.currentTurnIndex = (roomData.currentTurnIndex + 1) % roomData.players.length;
      io.to(room).emit('turn', roomData.players[roomData.currentTurnIndex].nickname);
    }
  });

  socket.on('surrender', ({ room }) => {
    const roomData = rooms[room];
    if (!roomData) return;
    const player = roomData.players.find(p => p.id === socket.id);
    if (player) {
      player.hasSurrendered = true;
      socket.emit('feedback', `Jawaban: ${roomData.questionList[roomData.questionIndex].a}`);

      const remaining = roomData.players.filter(p => !p.hasSurrendered);
      if (remaining.length === 0) {
        roomData.questionIndex++;
        if (roomData.questionIndex >= roomData.questionList.length) {
          const winner = roomData.players.reduce((max, p) => p.score > max.score ? p : max, roomData.players[0]);
          io.to(room).emit('showWinner', winner.nickname);
          return;
        }
        roomData.players.forEach(p => p.hasSurrendered = false);
        roomData.clueUsed = false;
        const q = roomData.questionList[roomData.questionIndex];
        io.to(room).emit('transition');
        setTimeout(() => {
          io.to(room).emit('question', q.q);
          io.to(room).emit('turn', roomData.players[roomData.currentTurnIndex].nickname);
        }, 500);
      }
    }
  });

  socket.on('getClue', ({ room }) => {
    const roomData = rooms[room];
    if (!roomData || roomData.clueUsed) return;
    const clue = roomData.questionList[roomData.questionIndex].c;
    io.to(room).emit('clue', clue);
    roomData.clueUsed = true;
  });

    socket.on('disconnect', () => {
    for (const roomCode in rooms) {
      const room = rooms[roomCode];
      const index = room.players.findIndex(p => p.id === socket.id);
      if (index !== -1) {
        const wasHost = room.players[index].id === room.hostId;
        room.players.splice(index, 1);

        // Jika tidak ada pemain tersisa, hapus ruangan
        if (room.players.length === 0) {
          delete rooms[roomCode];
        } else {
          // Jika host keluar, alihkan host ke pemain pertama
          if (wasHost) {
            room.hostId = room.players[0].id;
          }

          io.to(roomCode).emit('joined', {
            players: room.players.map(p => p.nickname),
            room: roomCode,
            isHost: false
          });
        }

        break;
      }
    }
  });

app.get('*', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`✅ Server jalan di http://localhost:${PORT}`);
});
