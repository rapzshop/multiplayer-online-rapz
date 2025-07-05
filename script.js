const socket = io(); // Gunakan io("https://namadomainmu") jika HTML tidak di-serve dari server yang sama

let nickname = "";
let roomCode = "";

function createRoom() {
  nickname = document.getElementById("nickname").value.trim();
  if (!nickname) return alert("Masukkan nama dulu dong 😅");
  socket.emit("createRoom", { nickname });
}

function joinRoom() {
  nickname = document.getElementById("nickname").value.trim();
  roomCode = document.getElementById("roomCode").value.trim().toUpperCase();
  if (!nickname || !roomCode) return alert("Isi nama dan kode ruangan");
  socket.emit("joinRoom", { nickname, roomCode });
}

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
});

socket.on("feedback", (msg) => {
  document.getElementById("feedback").textContent = msg;
});

function submitAnswer() {
  const ans = document.getElementById("answer").value.trim();
  if (!ans) return;
  socket.emit("answer", { room: roomCode, answer: ans });
}
