// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { randomUUID } = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname + '/public'));

const rooms = {}; // Menyimpan semua data ruangan
const currentTurn = {}; // Menyimpan giliran pemain per ruangan

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function generateRandomQuestion() {
  const samples = [
    'Apa yang selalu di depan tapi nggak bisa jalan?',
    'Kenapa ayam nyebrang jalan?',
    'Apa bedanya kamu sama alarm? Alarm bikin bangun, kamu bikin baper.',
    'Kenapa kucing nggak bisa ikut ujian?',
    'Apa yang makin malam makin terang?'
  ];
  return samples[Math.floor(Math.random() * samples.length)];
}

function sendTurn(room) {
  const playerId = currentTurn[room];
  const player = rooms[room].players.find(p => p.id === playerId);
  if (player) {
    io.to(room).emit("turn", player.nickname);
  }
}

function getNextPlayerInRoom(room) {
  const players = rooms[room].players;
  const currentIndex = players.findIndex(p => p.id === currentTurn[room]);
  const nextIndex = (currentIndex + 1) % players.length;
  return players[nextIndex].id;
}

function sendNewQuestion(room) {
  const question = generateRandomQuestion();
  rooms[room].question = question;
  rooms[room].usedClue = false;
  io.to(room).emit("question", question);
}

const clues = {
  "Apa yang selalu di depan tapi nggak bisa jalan?": "Sering ada di kepala, tapi bukan rambut.",
  "Kenapa ayam nyebrang jalan?": "Karena dia punya tujuan ke seberang.",
  "Apa bedanya kamu sama alarm? Alarm bikin bangun, kamu bikin baper.": "Soal perasaan dan benda elektronik.",
  "Kenapa kucing nggak bisa ikut ujian?": "Karena dia cuma bisa meong, bukan mikir.",
  "Apa yang makin malam makin terang?": "Benda yang ada di langit, kadang bulat."
};

io.on('connection', (socket) => {
  socket.on('createRoom', ({ nickname }) => {
    const roomCode = generateRoomCode();
    rooms[roomCode] = {
      players: [{ id: socket.id, nickname }],
      question: generateRandomQuestion(),
      answer: 'kocak',
      usedClue: false
    };
    currentTurn[roomCode] = socket.id;
    socket.join(roomCode);
    io.to(roomCode).emit('joined', {
      players: rooms[roomCode].players.map(p => p.nickname),
      room: roomCode
    });
    socket.emit('question', rooms[roomCode].question);
    sendTurn(roomCode);
  });

  socket.on('joinRoom', ({ nickname, roomCode }) => {
    const room = rooms[roomCode];
    if (!room) return socket.emit('feedback', 'Ruangan tidak ditemukan!');
    room.players.push({ id: socket.id, nickname });
    socket.join(roomCode);
    io.to(roomCode).emit('joined', {
      players: room.players.map(p => p.nickname),
      room: roomCode
    });
    socket.emit('question', room.question);
    sendTurn(roomCode);
  });

  socket.on('answer', ({ room, answer }) => {
    if (socket.id !== currentTurn[room]) {
      socket.emit('feedback', '⏳ Bukan giliran kamu!');
      return;
    }

    const correct = answer.toLowerCase().includes('kocak');
    const player = rooms[room].players.find(p => p.id === socket.id);

    if (correct) {
      io.to(room).emit('feedback', `✅ ${player.nickname} menjawab dengan benar!`);
      currentTurn[room] = getNextPlayerInRoom(room);
      sendNewQuestion(room);
      sendTurn(room);
    } else {
      socket.emit('feedback', '❌ Salah, coba lagi.');
    }
  });

  socket.on("getClue", ({ room }) => {
    const question = rooms[room].question;
    if (rooms[room].usedClue) {
      socket.emit("clue", "❌ Clue sudah digunakan!");
      return;
    }
    rooms[room].usedClue = true;
    const clue = clues[question] || "Clue tidak tersedia";
    io.to(room).emit("clue", clue);
  });

  socket.on('disconnect', () => {
    for (const [code, room] of Object.entries(rooms)) {
      room.players = room.players.filter(p => p.id !== socket.id);
      io.to(code).emit('playerList', room.players.map(p => p.nickname));
      if (room.players.length === 0) {
        delete rooms[code];
        delete currentTurn[code];
      } else if (currentTurn[code] === socket.id) {
        currentTurn[code] = getNextPlayerInRoom(code);
        sendTurn(code);
      }
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`✅ Server jalan di http://localhost:${PORT}`);
});

