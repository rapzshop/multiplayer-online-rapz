const socket = io();

let nickname = "";
let roomCode = "";
let clueUsed = false;
let hasSurrendered = false;

// Fungsi dipanggil dari HTML (index.html)
window.createRoomHandler = function (nick, room, category) {
  nickname = nick;
  roomCode = room;
  socket.emit("createRoom", { nickname, roomCode, category });
};

window.joinRoomHandler = function (nick, room) {
  nickname = nick;
  roomCode = room;
  socket.emit("joinRoom", { nickname, roomCode });
};

function submitAnswer() {
  const ans = document.getElementById("answer").value.trim();
  if (!ans) return;
  socket.emit("answer", { room: roomCode, answer: ans });
}

function requestClue() {
  if (clueUsed) return alert("Clue cuma bisa dipakai sekali per soal!");
  socket.emit("getClue", { room: roomCode });
  clueUsed = true;
  document.getElementById("clue-btn").disabled = true;
}

function surrender() {
  hasSurrendered = true;
  socket.emit("surrender", { room: roomCode });
  document.getElementById("surrender-btn").disabled = true;
  document.getElementById("answer").disabled = true;
  document.getElementById("answerBtn").disabled = true;
}

// --- SOCKET EVENTS ---

socket.on("joined", ({ players, room }) => {
  roomCode = room;
  document.getElementById("start-screen").style.display = "none";
  document.getElementById("game-screen").style.display = "block";
  updatePlayerList(players);
});

socket.on("playerList", updatePlayerList);

function updatePlayerList(players) {
  document.getElementById("players").textContent =
    "👥 Pemain di ruang " + roomCode + ": " + players.join(", ");
}

socket.on("question", (question) => {
  document.getElementById("question").textContent = question;
  document.getElementById("answer").value = "";
  document.getElementById("feedback").textContent = "";
  document.getElementById("clue-text").textContent = "";
  document.getElementById("clue-btn").disabled = false;
  document.getElementById("surrender-btn").disabled = false;
  document.getElementById("answer").disabled = false;
  document.getElementById("answerBtn").disabled = false;
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

// --- INPUT TYPING ---

document.getElementById("answer").addEventListener("input", () => {
  socket.emit("typing", { room: roomCode, nickname });
});

// --- DOM READY ---

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("answerBtn").addEventListener("click", submitAnswer);
  document.getElementById("clue-btn").addEventListener("click", requestClue);
  document.getElementById("surrender-btn").addEventListener("click", surrender);
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
