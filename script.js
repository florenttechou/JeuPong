const canvas = document.getElementById("pong");
const ctx = canvas.getContext("2d");
const startButton = document.getElementById("start");
const pauseButton = document.getElementById("pause");
const playerScoreElement = document.getElementById("player-score");
const computerScoreElement = document.getElementById("computer-score");

const TABLE_COLOR = "rgba(0, 0, 0, 0.6)";
const NET_COLOR = "rgba(255, 255, 255, 0.4)";
const PADDLE_COLOR = "#ffffff";
const BALL_COLOR = "#ffffff";

const MAX_SCORE = 10;
const FRAME_TIME = 1000 / 60;

const player = {
  x: 20,
  y: canvas.height / 2 - 50,
  width: 12,
  height: 100,
  speed: 7,
  dy: 0,
};

const computer = {
  x: canvas.width - 32,
  y: canvas.height / 2 - 50,
  width: 12,
  height: 100,
  speed: 5.5,
};

const ball = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  size: 10,
  speed: 5,
  velocityX: 5,
  velocityY: 3,
};

let isRunning = false;
let animationFrameId = null;
let lastTime = 0;
let playerScore = 0;
let computerScore = 0;

function resetBall(direction = 1) {
  ball.x = canvas.width / 2;
  ball.y = canvas.height / 2;
  ball.velocityX = direction * (4 + Math.random() * 2);
  ball.velocityY = (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 2);
}

function resetGame() {
  playerScore = 0;
  computerScore = 0;
  updateScores();
  resetBall();
  player.y = canvas.height / 2 - player.height / 2;
  computer.y = canvas.height / 2 - computer.height / 2;
}

function updateScores() {
  playerScoreElement.textContent = playerScore;
  computerScoreElement.textContent = computerScore;
}

function drawTable() {
  ctx.fillStyle = TABLE_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = NET_COLOR;
  const segmentHeight = 20;
  for (let y = 0; y < canvas.height; y += 30) {
    ctx.fillRect(canvas.width / 2 - 2, y, 4, segmentHeight);
  }
}

function drawPaddle({ x, y, width, height }) {
  ctx.fillStyle = PADDLE_COLOR;
  ctx.fillRect(x, y, width, height);
}

function drawBall() {
  ctx.fillStyle = BALL_COLOR;
  ctx.fillRect(ball.x - ball.size, ball.y - ball.size, ball.size * 2, ball.size * 2);
}

function movePlayer(delta) {
  const distance = player.dy * delta;
  player.y += distance;
  if (player.y < 0) player.y = 0;
  if (player.y + player.height > canvas.height) {
    player.y = canvas.height - player.height;
  }
}

function moveComputer(delta) {
  const center = computer.y + computer.height / 2;
  if (center < ball.y - 10) {
    computer.y += computer.speed * delta;
  } else if (center > ball.y + 10) {
    computer.y -= computer.speed * delta;
  }
  if (computer.y < 0) computer.y = 0;
  if (computer.y + computer.height > canvas.height) {
    computer.y = canvas.height - computer.height;
  }
}

function moveBall(delta) {
  ball.x += ball.velocityX * delta;
  ball.y += ball.velocityY * delta;

  if (ball.y - ball.size < 0 || ball.y + ball.size > canvas.height) {
    ball.velocityY *= -1;
  }

  const collidedWithPlayer =
    ball.x - ball.size <= player.x + player.width &&
    ball.y > player.y &&
    ball.y < player.y + player.height;

  const collidedWithComputer =
    ball.x + ball.size >= computer.x &&
    ball.y > computer.y &&
    ball.y < computer.y + computer.height;

  if (collidedWithPlayer) {
    ball.velocityX = Math.abs(ball.velocityX);
    const collidePoint = ball.y - (player.y + player.height / 2);
    ball.velocityY = collidePoint * 0.2;
  }

  if (collidedWithComputer) {
    ball.velocityX = -Math.abs(ball.velocityX);
    const collidePoint = ball.y - (computer.y + computer.height / 2);
    ball.velocityY = collidePoint * 0.2;
  }

  if (ball.x - ball.size < 0) {
    computerScore += 1;
    updateScores();
    checkWinner();
    resetBall(-1);
  } else if (ball.x + ball.size > canvas.width) {
    playerScore += 1;
    updateScores();
    checkWinner();
    resetBall(1);
  }
}

function checkWinner() {
  if (playerScore >= MAX_SCORE || computerScore >= MAX_SCORE) {
    stopGame();
    const winner = playerScore > computerScore ? "Joueur" : "Ordinateur";
    alert(`${winner} gagne !`);
  }
}

function update(timestamp) {
  if (!isRunning) return;
  if (!lastTime) lastTime = timestamp;
  const delta = (timestamp - lastTime) / FRAME_TIME;
  lastTime = timestamp;

  drawTable();
  movePlayer(delta);
  moveComputer(delta);
  moveBall(delta);

  drawPaddle(player);
  drawPaddle(computer);
  drawBall();

  animationFrameId = requestAnimationFrame(update);
}

function startGame() {
  if (isRunning) return;
  isRunning = true;
  lastTime = 0;
  animationFrameId = requestAnimationFrame(update);
}

function stopGame() {
  isRunning = false;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

startButton.addEventListener("click", () => {
  resetGame();
  startGame();
});

pauseButton.addEventListener("click", () => {
  if (!isRunning) {
    startGame();
    pauseButton.textContent = "Pause";
  } else {
    stopGame();
    pauseButton.textContent = "Reprendre";
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowUp") {
    player.dy = -player.speed;
  } else if (event.key === "ArrowDown") {
    player.dy = player.speed;
  }
});

window.addEventListener("keyup", (event) => {
  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    player.dy = 0;
  }
});

canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  const scaleY = canvas.height / rect.height;
  const y = (event.clientY - rect.top) * scaleY;
  player.y = y - player.height / 2;
  if (player.y < 0) player.y = 0;
  if (player.y + player.height > canvas.height) {
    player.y = canvas.height - player.height;
  }
});

resetGame();
drawTable();
drawPaddle(player);
drawPaddle(computer);
drawBall();
