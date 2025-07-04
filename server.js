// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { randomUUID } = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname + '/public')); // pastikan HTML disimpan di folder 'public'

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

  socket.on('joinRoom', ({ nickname, roomCode }) => {
    const room = rooms[roomCode];
    if (!room) return socket.emit('feedback', 'Ruangan tidak ditemukan!');
    room.players.push({ id: socket.id, nickname });
    socket.join(roomCode);
    io.to(roomCode).emit('joined', { players: room.players.map(p => p.nickname), room: roomCode });
    socket.emit('question', room.question);
  });

  socket.on('answer', ({ room, answer }) => {
    const correct = answer.toLowerCase().includes('kocak');
    io.to(room).emit('feedback', correct ? '✅ Jawaban kamu kocak dan benar!' : '❌ Belum kocak, coba lagi!');
  });

  socket.on('disconnect', () => {
    for (const [code, room] of Object.entries(rooms)) {
      room.players = room.players.filter(p => p.id !== socket.id);
      io.to(code).emit('playerList', room.players.map(p => p.nickname));
      if (room.players.length === 0) delete rooms[code];
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server jalan di http://localhost:${PORT}`);
});
