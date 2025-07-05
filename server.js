// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { randomUUID } = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname + '/public'));

const rooms = {}; // { [roomCode]: { players: [{ id, nickname }], question, answer, clueUsed, currentTurnIndex } }
const currentQuestions = {}; // Simpan soal per room
const currentTurn = {}; // Simpan id pemain yang sedang dapat giliran per room

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const questions = [
  'Apa yang selalu di depan tapi nggak bisa jalan?',
  'Kenapa ayam nyebrang jalan?',
  'Apa bedanya kamu sama alarm? Alarm bikin bangun, kamu bikin baper.',
  'Kenapa kucing nggak bisa ikut ujian?',
  'Apa yang makin malam makin terang?'
];

const answers = {
  'Apa yang selalu di depan tapi nggak bisa jalan?': 'kepala',
  'Kenapa ayam nyebrang jalan?': 'karena ingin ke seberang',
  'Apa bedanya kamu sama alarm? Alarm bikin bangun, kamu bikin baper.': 'baper',
  'Kenapa kucing nggak bisa ikut ujian?': 'karena mengeong',
  'Apa yang makin malam makin terang?': 'lampu'
};

const clues = {
  'Apa yang selalu di depan tapi nggak bisa jalan?': 'Dipakai orang tiap hari di kepala...',
  'Kenapa ayam nyebrang jalan?': 'Karena ada sesuatu di seberang jalan.',
  'Apa bedanya kamu sama alarm? Alarm bikin bangun, kamu bikin baper.': 'Ini soal perasaan 💔',
  'Kenapa kucing nggak bisa ikut ujian?': 'Karena dia selalu mengeong bukan menjawab!',
  'Apa yang makin malam makin terang?': 'Bukan matahari... tapi sesuatu yang menyala di malam.'
};

function generateRandomQuestion() {
  return questions[Math.floor(Math.random() * questions.length)];
}

io.on('connection', (socket) => {
  socket.on('createRoom', ({ nickname }) => {
    if (!nickname) return socket.emit('feedback', 'Nama tidak boleh kosong!');

    const roomCode = generateRoomCode();
    const question = generateRandomQuestion();
    const answer = answers[question];

    rooms[roomCode] = {
      players: [{ id: socket.id, nickname }],
      question,
      answer,
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

    const correct = answer.toLowerCase().includes(roomData.answer.toLowerCase());
    if (correct) {
      io.to(room).emit('feedback', `✅ ${currentPlayer.nickname} menjawab dengan benar!`);

      const newQuestion = generateRandomQuestion();
      roomData.question = newQuestion;
      roomData.answer = answers[newQuestion];
      roomData.clueUsed = false;
      currentQuestions[room] = newQuestion;
      io.to(room).emit('question', newQuestion);

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
    const clue = clues[roomData.question] || 'Clue tidak tersedia.';
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
