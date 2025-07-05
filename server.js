// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { randomUUID } = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ⬅️ Serve semua file dari folder 'public'
app.use(express.static(__dirname + '/public'));

app.get('*', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

const rooms = {};

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

io.on('connection', (socket) => {
  socket.on('createRoom', ({ nickname }) => {
    const roomCode = generateRoomCode();
    rooms[roomCode] = {
      players: [{ id: socket.id, nickname }],
      question: generateRandomQuestion(),
      answer: 'kocak'
    };
    socket.join(roomCode);
    io.to(roomCode).emit('joined', { players: rooms[roomCode].players.map(p => p.nickname), room: roomCode });
    socket.emit('question', rooms[roomCode].question);
  });

  let currentTurnIndex = 0;

function sendTurn(room) {
  const players = rooms[room].players; // kamu harus simpan player list per room
  const currentPlayer = players[currentTurnIndex];
  io.to(room).emit("turn", currentPlayer.nickname);
}

function nextTurn(room) {
  const players = rooms[room].players;
  currentTurnIndex = (currentTurnIndex + 1) % players.length;
  sendTurn(room);
}

  socket.on('joinRoom', ({ nickname, roomCode }) => {
    const room = rooms[roomCode];
    if (!room) return socket.emit('feedback', 'Ruangan tidak ditemukan!');
    room.players.push({ id: socket.id, nickname });
    socket.join(roomCode);
    io.to(roomCode).emit('joined', { players: room.players.map(p => p.nickname), room: roomCode });
    socket.emit('question', room.question);
  });

 socket.on('answer', ({ room, answer }) => {
  // Cek apakah pemain ini yang gilirannya
  if (socket.id !== currentTurn[room]) {
    socket.emit('feedback', '⏳ Bukan giliran kamu!');
    return;
  }

  const correct = answer.toLowerCase().includes('kocak');

  if (correct) {
    io.to(room).emit('feedback', `✅ ${players[socket.id]} menjawab dengan benar!`);
    
    // Ganti ke pemain berikutnya
    currentTurn[room] = getNextPlayerInRoom(room);
    io.to(room).emit('turn', players[currentTurn[room]]);
    
    // Kirim pertanyaan baru (opsional)
    sendNewQuestion(room);
  } else {
    socket.emit('feedback', '❌ Salah, coba lagi.');
  }
});

  socket.on("typing", ({ room, nickname }) => {
  socket.to(room).emit("playerTyping", nickname);
});
  
  const clues = {
  "Kucing berkumis": "Hewan peliharaan, suka ikan",
  "Gunung api": "Tempat tinggi dan panas",
  // Tambah sesuai soal
};

socket.on("getClue", ({ room }) => {
  const question = currentQuestions[room]; // kamu harus simpan soal aktif per room
  const clue = clues[question] || "Clue tidak tersedia";
  io.to(room).emit("clue", clue);
});


  socket.on('disconnect', () => {
    for (const [code, room] of Object.entries(rooms)) {
      room.players = room.players.filter(p => p.id !== socket.id);
      io.to(code).emit('playerList', room.players.map(p => p.nickname));
      if (room.players.length === 0) delete rooms[code];
    }
  });
});

// ...semua kode kamu di atas...

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`✅ Server jalan di http://localhost:${PORT}`);
});

// ⬅️ Taruh ini PALING AKHIR
app.get('*', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});
