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

    room.players.push({ id: socket.id, nickname, score: 0, hasSurrendered: false });
    socket.join(roomCode);

    io.to(roomCode).emit('joined', {
      players: room.players.map(p => p.nickname),
      room: roomCode,
      isHost: room.hostId === socket.id
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
