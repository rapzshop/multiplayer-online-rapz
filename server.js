// server.js
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

function nextTurn(room) {
  const playerIds = Object.keys(room.players);
  if (playerIds.length === 0) return;
  let attempts = 0;
  do {
    room.turnIndex = (room.turnIndex + 1) % playerIds.length;
    room.currentTurn = playerIds[room.turnIndex];
    attempts++;
  } while (room.players[room.currentTurn].surrendered && attempts < playerIds.length);
}

function checkAllAnsweredOrSurrendered(room, code) {
  const total = Object.keys(room.players).length;
  const done = room.surrenderedPlayers.length + room.answeredPlayers.size;

  if (done >= total) {
    setTimeout(() => {
      room.currentQuestionIndex++;
      if (room.currentQuestionIndex >= room.questions.length) {
        endGame(code);
      } else {
        nextTurn(room);
        sendQuestion(code);
      }
    }, 2000);
  } else {
    nextTurn(room);
    sendQuestion(code);
  }
}

io.on('connection', (socket) => {
  socket.on('createRoom', ({ name, category }) => {
    const code = generateRoomCode();
    rooms[code] = {
      host: socket.id,
      category,
      players: {},
      started: false,
      turnIndex: 0,
      currentTurn: null,
      questions: generateQuestionsByCategory(category),
      currentQuestionIndex: 0,
      surrenderedPlayers: [],
      answeredPlayers: new Set(),
    };
    rooms[code].players[socket.id] = { id: socket.id, name, score: 0, usedClue: false, surrendered: false };
    socket.join(code);
    socket.emit('roomCreated', { code });
  });

  socket.on('joinRoom', ({ name, code }) => {
    const room = rooms[code];
    if (!room || room.started) return;
    room.players[socket.id] = { id: socket.id, name, score: 0, usedClue: false, surrendered: false };
    socket.join(code);
    io.to(code).emit('lobbyUpdate', Object.values(room.players));
  });

  socket.on('startGame', (code) => {
    const room = rooms[code];
    if (!room || Object.keys(room.players).length < 2 || room.host !== socket.id) return;
    room.started = true;
    room.currentTurn = Object.keys(room.players)[0];
    room.turnIndex = 0;
    room.currentQuestionIndex = 0;
    sendQuestion(code);
  });

  function sendQuestion(code) {
    const room = rooms[code];
    if (!room) return;
    const questionObj = room.questions[room.currentQuestionIndex];
    room.surrenderedPlayers = [];
    room.answeredPlayers.clear();
    for (const player of Object.values(room.players)) {
      player.usedClue = false;
      player.surrendered = false;
    }
    io.to(code).emit('newQuestion', {
      question: questionObj.q,
      turnId: room.currentTurn,
      turnName: room.players[room.currentTurn].name
    });
  }

  socket.on('getClue', (code) => {
    const room = rooms[code];
    if (!room) return;
    const player = room.players[socket.id];
    if (!player || player.usedClue) return;
    player.usedClue = true;
    socket.emit('receiveClue', room.questions[room.currentQuestionIndex].c);
  });

  socket.on('submitAnswer', ({ code, answer }) => {
    const room = rooms[code];
    if (!room || !room.players[socket.id]) return;
    const player = room.players[socket.id];
    const question = room.questions[room.currentQuestionIndex];

    if (player.surrendered || room.answeredPlayers.has(socket.id)) return;

    if (answer.toLowerCase() === question.a.toLowerCase()) {
      player.score += 1;
      room.answeredPlayers.add(socket.id);
      io.to(code).emit('correctAnswer', { name: player.name, answer });
      setTimeout(() => {
        room.currentQuestionIndex++;
        if (room.currentQuestionIndex >= room.questions.length || player.score >= 20) {
          endGame(code);
        } else {
          nextTurn(room);
          sendQuestion(code);
        }
      }, 2000);
    } else {
      room.answeredPlayers.add(socket.id);
      player.score += 0.5;
      io.to(socket.id).emit('wrongAnswer');
      checkAllAnsweredOrSurrendered(room, code);
    }
  });

  socket.on('surrender', (code) => {
    const room = rooms[code];
    if (!room || !room.players[socket.id]) return;
    room.players[socket.id].surrendered = true;
    room.players[socket.id].score += 0;
    room.surrenderedPlayers.push(socket.id);
    if (room.surrenderedPlayers.length === Object.keys(room.players).length) {
      io.to(code).emit('everyoneSurrendered', room.questions[room.currentQuestionIndex].a);
      setTimeout(() => {
        room.currentQuestionIndex++;
        if (room.currentQuestionIndex >= room.questions.length) {
          endGame(code);
        } else {
          nextTurn(room);
          sendQuestion(code);
        }
      }, 2000);
    } else {
      io.to(socket.id).emit('surrenderedViewAnswer', room.questions[room.currentQuestionIndex].a);
      nextTurn(room);
      sendQuestion(code);
    }
  });

  socket.on('disconnect', () => {
    for (const code in rooms) {
      const room = rooms[code];
      if (room.players[socket.id]) {
        delete room.players[socket.id];
        io.to(code).emit('lobbyUpdate', Object.values(room.players));
        if (Object.keys(room.players).length === 0) delete rooms[code];
      }
    }
  });
});

function endGame(code) {
  const room = rooms[code];
  if (!room) return;
  const players = Object.values(room.players);
  const winner = players.reduce((max, p) => p.score > max.score ? p : max, players[0]);
  io.to(code).emit('gameOver', { winner: winner.name, score: winner.score });
  delete rooms[code];
}

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`✅ Server jalan di http://localhost:${PORT}`);
});
