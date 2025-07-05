const socket = io();

let nickname = "";
let roomCode = "";
let clueUsed = false;
let hasSurrendered = false;
let isHost = false;
let selectedCategory = "";

// Fungsi dipanggil dari HTML
window.createRoomHandler = function () {
  const nick = document.getElementById("nickname").value.trim();
  const room = document.getElementById("roomCode").value.trim().toUpperCase();
  const category = document.getElementById("category").value;

  if (!nick || !room || room.length !== 4 || !category) {
    alert("Lengkapi nickname, kode ruangan (4 huruf), dan kategori!");
    return;
  }

  nickname = nick;
  roomCode = room;
  selectedCategory = category;
  isHost = true;

  socket.emit("createRoom", { nickname, roomCode, category });
};

window.joinRoomHandler = function () {
  const nick = document.getElementById("nickname").value.trim();
  const room = document.getElementById("roomCode").value.trim().toUpperCase();

  if (!nick || !room || room.length !== 4) {
    alert("Lengkapi nickname dan kode ruangan (4 huruf)!");
    return;
  }

  nickname = nick;
  roomCode = room;
  isHost = false;

  socket.emit("joinRoom", { nickname, roomCode });
};

function submitAnswer() {
  const ans = document.getElementById("answer").value.trim();
  if (!ans || hasSurrendered) return;
  socket.emit("answer", { room: roomCode, answer: ans });
}

function requestClue() {
  if (clueUsed) return alert("Clue hanya bisa dipakai sekali!");
  clueUsed = true;
  document.getElementById("clue-btn").disabled = true;
  socket.emit("getClue", { room: roomCode });
}

function surrender() {
  hasSurrendered = true;
  document.getElementById("surrender-btn").disabled = true;
  document.getElementById("answer").disabled = true;
  document.getElementById("answerBtn").disabled = true;
  socket.emit("surrender", { room: roomCode });
}

function startGame() {
  socket.emit("startGame", { room: roomCode });
  document.getElementById("startGameBtn").disabled = true;
}

// --- SOCKET EVENTS ---

socket.on("joined", ({ players, room }) => {
  roomCode = room;

  document.getElementById("start-screen").style.display = "none";
  document.getElementById("lobby-screen").style.display = "block";
  updatePlayerList(players);

  document.getElementById("startGameBtn").style.display = isHost ? "block" : "none";
});

socket.on("playerList", updatePlayerList);

function updatePlayerList(players) {
  document.getElementById("players").textContent =
    "👥 Pemain di ruang " + roomCode + ": " + players.join(", ");
}

socket.on("question", (question) => {
  document.getElementById("lobby-screen").style.display = "none";
  document.getElementById("game-screen").style.display = "block";

  document.getElementById("question").textContent = question;
  document.getElementById("answer").value = "";
  document.getElementById("feedback").textContent = "";
  document.getElementById("clue-text").textContent = "";
  document.getElementById("clue-btn").disabled = false;
  document.getElementById("surrender-btn").disabled = false;
  document.getElementById("answer").disabled = false;
  document.getElementById("answerBtn").disabled = false;

  clueUsed = false;
  hasSurrendered = false;
});

socket.on("feedback", (msg) => {
  document.getElementById("feedback").textContent = msg;
  if (msg.includes("benar")) animateCorrect();
});

socket.on("turn", (playerName) => {
  document.getElementById("turn-indicator").textContent = `🎯 Giliran: ${playerName}`;
});

socket.on("clue", (clue) => {
  document.getElementById("clue-text").textContent = "🔍 Clue: " + clue;
});

socket.on("showAnswer", (correctAnswer) => {
  document.getElementById("clue-text").textContent = "🔓 Jawabannya: " + correctAnswer;
});

socket.on("playerTyping", (nickname) => {
  document.getElementById("player-status").textContent = `${nickname} sedang menjawab...`;
  setTimeout(() => {
    document.getElementById("player-status").textContent = "";
  }, 3000);
});

socket.on("notEnoughPlayers", () => {
  alert("Minimal 2 pemain diperlukan untuk memulai permainan!");
});

socket.on("gameStarted", () => {
  document.getElementById("startGameBtn").style.display = "none";
});

// --- INPUT TYPING ---
document.getElementById("answer").addEventListener("input", () => {
  socket.emit("typing", { room: roomCode, nickname });
});

// --- DOM READY ---
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("answerBtn").addEventListener("click", submitAnswer);
  document.getElementById("clue-btn").addEventListener("click", requestClue);
  document.getElementById("surrender-btn").addEventListener("click", surrender);
  document.getElementById("startGameBtn").addEventListener("click", startGame);
});

// --- Animasi Jawaban Benar ---
function animateCorrect() {
  const feedback = document.getElementById("feedback");
  feedback.style.color = "green";
  feedback.style.fontWeight = "bold";
  feedback.style.transform = "scale(1.2)";
  setTimeout(() => {
    feedback.style.transform = "scale(1)";
    feedback.style.color = "";
    feedback.style.fontWeight = "";
  }, 600);
}

