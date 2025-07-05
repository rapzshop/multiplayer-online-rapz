// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { randomUUID } = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname + '/public'));

const rooms = {}; // { [roomCode]: { players: [{ id, nickname, hasSurrendered }], question, answer, clueUsed, currentTurnIndex } }
const currentQuestions = {}; // Simpan soal per room
const currentTurn = {}; // Simpan id pemain yang sedang dapat giliran per room

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const bendaUmum = [
  { q: 'Benda yang dipakai untuk menulis', a: 'pena', c: 'Ada di meja belajar' },
  { q: 'Benda yang digunakan untuk makan', a: 'sendok', c: 'Biasa satu set sama garpu' },
  { q: 'Benda yang menampilkan gambar', a: 'televisi', c: 'Biasanya ditonton' },
  { q: 'Benda yang digunakan untuk melihat waktu', a: 'jam', c: 'Bisa nempel di dinding atau dipakai di tangan' },
  { q: 'Benda yang digunakan saat hujan', a: 'payung', c: 'Melindungi dari basah' },
  { q: 'Benda yang digunakan untuk menyapu lantai', a: 'sapu', c: 'Bulu-bulunya sering rontok' },
  { q: 'Benda yang digunakan untuk memotong', a: 'gunting', c: 'Tajam, tapi bukan pisau' },
];

function generateRandomQuestion() {
  return bendaUmum[Math.floor(Math.random() * bendaUmum.length)];
}

io.on('connection', (socket) => {
  socket.on('createRoom', ({ nickname }) => {
    if (!nickname) return socket.emit('feedback', 'Nama tidak boleh kosong!');

    const roomCode = generateRoomCode();
    const { q: question, a: answer, c: clue } = generateRandomQuestion();

    rooms[roomCode] = {
      players: [{ id: socket.id, nickname, hasSurrendered: false }],
      question,
      answer,
      clue,
      clueUsed: false,
      currentTurnIndex: 0
    };
    currentQuestions[roomCode] = question;
    currentTurn[roomCode] = socket.id;
    socket.join(roomCode);

    io.to(roomCode).emit('joined', { players: rooms[roomCode].players.map(p => p.nickname), room: roomCode });
    io.to(roomCode).emit('question', question);
    io.to(roomCode).emit('turn', nickname);
  });

  socket.on('joinRoom', ({ nickname, roomCode }) => {
    if (!nickname || !roomCode) return socket.emit('feedback', 'Nama dan kode ruangan wajib diisi!');

    const room = rooms[roomCode];
    if (!room) return socket.emit('feedback', 'Ruangan tidak ditemukan!');

    room.players.push({ id: socket.id, nickname, hasSurrendered: false });
    socket.join(roomCode);

    io.to(roomCode).emit('joined', { players: room.players.map(p => p.nickname), room: roomCode });
    socket.emit('question', room.question);
    io.to(roomCode).emit('turn', getCurrentPlayerNickname(roomCode));
  });

  socket.on('answer', ({ room, answer }) => {
    const roomData = rooms[room];
    if (!roomData) return;

    const currentPlayer = roomData.players[roomData.currentTurnIndex];
    if (socket.id !== currentPlayer.id) {
      socket.emit('feedback', '⏳ Bukan giliran kamu!');
      return;
    }

    if (currentPlayer.hasSurrendered) {
      socket.emit('feedback', 'Kamu sudah nyerah, tunggu soal berikutnya.');
      return;
    }

    const correct = answer.toLowerCase().includes(roomData.answer.toLowerCase());
    if (correct) {
      io.to(room).emit('feedback', `✅ ${currentPlayer.nickname} menjawab dengan benar!`);
      io.to(room).emit('correctAnswer');

      const { q, a, c } = generateRandomQuestion();
      roomData.question = q;
      roomData.answer = a;
      roomData.clue = c;
      roomData.clueUsed = false;
      roomData.players.forEach(p => p.hasSurrendered = false);
      currentQuestions[room] = q;
      io.to(room).emit('question', q);

      roomData.currentTurnIndex = (roomData.currentTurnIndex + 1) % roomData.players.length;
      const nextPlayer = roomData.players[roomData.currentTurnIndex];
      currentTurn[room] = nextPlayer.id;
      io.to(room).emit('turn', nextPlayer.nickname);
    } else {
      socket.emit('feedback', '❌ Salah, giliran berpindah!');
      roomData.currentTurnIndex = (roomData.currentTurnIndex + 1) % roomData.players.length;
      const nextPlayer = roomData.players[roomData.currentTurnIndex];
      currentTurn[room] = nextPlayer.id;
      io.to(room).emit('turn', nextPlayer.nickname);
    }
  });

  socket.on('surrender', ({ room }) => {
    const roomData = rooms[room];
    if (!roomData) return;
    const player = roomData.players.find(p => p.id === socket.id);
    if (player) {
      player.hasSurrendered = true;
      socket.emit('feedback', `Jawaban: ${roomData.answer}`);
    }
  });

  socket.on('getClue', ({ room }) => {
    const roomData = rooms[room];
    if (!roomData || roomData.clueUsed) return;
    const clue = roomData.clue || 'Clue tidak tersedia.';
    io.to(room).emit('clue', clue);
    roomData.clueUsed = true;
  });

  socket.on('typing', ({ room, nickname }) => {
    socket.to(room).emit('playerTyping', nickname);
  });

  socket.on('disconnect', () => {
    for (const [code, room] of Object.entries(rooms)) {
      room.players = room.players.filter(p => p.id !== socket.id);
      if (room.players.length === 0) {
        delete rooms[code];
        delete currentQuestions[code];
        delete currentTurn[code];
      } else {
        io.to(code).emit('playerList', room.players.map(p => p.nickname));
      }
    }
  });
});

function getCurrentPlayerNickname(roomCode) {
  const room = rooms[roomCode];
  if (!room || room.players.length === 0) return '';
  return room.players[room.currentTurnIndex]?.nickname || '';
}

app.get('*', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`✅ Server jalan di http://localhost:${PORT}`);
});

