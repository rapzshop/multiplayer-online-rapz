// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { randomUUID } = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname + '/public'));

const rooms = {}; // { [roomCode]: { players: [...], questionIndex: 0, questionList: [...], currentTurnIndex, clueUsed } }

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const categories = {
  benda: [...Array(100)].map((_, i) => ({
    q: `Benda kategori ke-${i + 1}`,
    a: `benda${i + 1}`,
    c: `Clue benda-${i + 1}`
  })),
  hewan: [...Array(100)].map((_, i) => ({
    q: `Hewan kategori ke-${i + 1}`,
    a: `hewan${i + 1}`,
    c: `Clue hewan-${i + 1}`
  })),
  pekerjaan: [...Array(100)].map((_, i) => ({
    q: `Pekerjaan kategori ke-${i + 1}`,
    a: `pekerjaan${i + 1}`,
    c: `Clue pekerjaan-${i + 1}`
  })),
  makanan: [...Array(100)].map((_, i) => ({
    q: `Makanan/minuman kategori ke-${i + 1}`,
    a: `makanan${i + 1}`,
    c: `Clue makanan-${i + 1}`
  })),
  tempat: [...Array(100)].map((_, i) => ({
    q: `Tempat kategori ke-${i + 1}`,
    a: `tempat${i + 1}`,
    c: `Clue tempat-${i + 1}`
  })),
};

function shuffle(arr) {
  return arr.map(v => [v, Math.random()]).sort((a, b) => a[1] - b[1]).map(([v]) => v);
}

function generateShuffledQuestions() {
  const combined = [
    ...categories.benda,
    ...categories.hewan,
    ...categories.pekerjaan,
    ...categories.makanan,
    ...categories.tempat
  ];
  return shuffle(combined);
}

io.on('connection', (socket) => {
  socket.on('createRoom', ({ nickname }) => {
    if (!nickname) return socket.emit('feedback', 'Nama tidak boleh kosong!');

    const roomCode = generateRoomCode();
    const questions = generateShuffledQuestions();

    rooms[roomCode] = {
      players: [{ id: socket.id, nickname, hasSurrendered: false }],
      questionList: questions,
      questionIndex: 0,
      clueUsed: false,
      currentTurnIndex: 0,
      started: false,
      hostId: socket.id,
    };

    socket.join(roomCode);
    io.to(roomCode).emit('joined', { players: rooms[roomCode].players.map(p => p.nickname), room: roomCode, isHost: true });
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

  socket.on('joinRoom', ({ nickname, roomCode }) => {
    if (!nickname || !roomCode) return socket.emit('feedback', 'Nama dan kode ruangan wajib diisi!');

    const room = rooms[roomCode];
    if (!room) return socket.emit('feedback', 'Ruangan tidak ditemukan!');

    room.players.push({ id: socket.id, nickname, hasSurrendered: false });
    socket.join(roomCode);

    io.to(roomCode).emit('joined', { players: room.players.map(p => p.nickname), room: roomCode, isHost: room.hostId === socket.id });
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
      io.to(room).emit('feedback', `✅ ${currentPlayer.nickname} benar!`);
      io.to(room).emit('correctAnswer');

      roomData.questionIndex++;
      if (roomData.questionIndex >= roomData.questionList.length) {
        io.to(room).emit('feedback', 'Soal habis! Permainan selesai.');
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
      socket.emit('feedback', '❌ Salah, giliran berpindah!');
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
          io.to(room).emit('feedback', 'Soal habis! Permainan selesai.');
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
    for (const [code, room] of Object.entries(rooms)) {
      room.players = room.players.filter(p => p.id !== socket.id);
      if (room.players.length === 0) {
        delete rooms[code];
      } else {
        io.to(code).emit('playerList', room.players.map(p => p.nickname));
      }
    }
  });
});

app.get('*', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`✅ Server jalan di http://localhost:${PORT}`);
});

