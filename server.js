// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { randomUUID } = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname + '/public'));

const rooms = {}; // Struktur: { [roomCode]: { players: [{ id, nickname }], question, answer, currentTurn, clueUsed } }
const currentQuestions = {}; // Simpan soal per room
const currentTurn = {}; // Simpan id pemain yang sedang dapat giliran per room

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

const clues = {
  'Apa yang selalu di depan tapi nggak bisa jalan?': 'Dipakai orang tiap hari di kepala...',
  'Kenapa ayam nyebrang jalan?': 'Karena ada sesuatu di seberang jalan.',
  'Apa bedanya kamu sama alarm? Alarm bikin bangun, kamu bikin baper.': 'Ini soal perasaan 💔',
  'Kenapa kucing nggak bisa ikut ujian?': 'Karena dia selalu mengeong bukan menjawab!',
  'Apa yang makin malam makin terang?': 'Bukan matahari... tapi sesuatu yang menyala di malam.'
};

io.on('connection', (socket) => {
  socket.on('createRoom', ({ nickname }) => {
    const roomCode = generateRoomCode();
    const question = generateRandomQuestion();
    rooms[roomCode] = {
      players: [{ id: socket.id, nickname }],
      question,
      answer: 'kocak',
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
    const room = rooms[roomCode];
    if (!room) return socket.emit('feedback', 'Ruangan tidak ditemukan!');
    room.players.push({ id: socket.id, nickname });
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

    const correct = answer.toLowerCase().includes(roomData.answer);
    if (correct) {
      io.to(room).emit('feedback', `✅ ${currentPlayer.nickname} menjawab dengan benar!`);
      // Ganti pertanyaan dan reset clue
      const newQuestion = generateRandomQuestion();
      roomData.question = newQuestion;
      roomData.clueUsed = false;
      currentQuestions[room] = newQuestion;
      io.to(room).emit('question', newQuestion);

      // Ganti giliran
      roomData.currentTurnIndex = (roomData.currentTurnIndex + 1) % roomData.players.length;
      const nextPlayer = roomData.players[roomData.currentTurnIndex];
      currentTurn[room] = nextPlayer.id;
      io.to(room).emit('turn', nextPlayer.nickname);
    } else {
      socket.emit('feedback', '❌ Salah, coba lagi.');
    }
  });

  socket.on('getClue', ({ room }) => {
    const roomData = rooms[room];
    if (!roomData || roomData.clueUsed) return;
    const question = roomData.question;
    const clue = clues[question] || 'Clue tidak tersedia.';
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

// ⬅️ Taruh ini PALING AKHIR
app.get('*', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`✅ Server jalan di http://localhost:${PORT}`);
});
