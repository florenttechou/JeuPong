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

const BALL_INITIAL_SPEED_X = 3;
const BALL_INITIAL_SPEED_VARIATION = 1.5;
const BALL_INITIAL_SPEED_Y = 2;
const PADDLE_SPEED_INCREASE = 1.05;
const PADDLE_HIT_SPEED_BOOST = 1.08;
const PADDLE_EDGE_DAMPING = 0.65;
const MAX_BALL_SPEED = 9.5;
const RESPAWN_INITIAL_DELAY = 3000;
const COUNTDOWN_START_VALUE = 3;

function clampBallSpeed() {
  const speed = Math.hypot(ball.velocityX, ball.velocityY);
  if (speed > MAX_BALL_SPEED) {
    const scale = MAX_BALL_SPEED / speed;
    ball.velocityX *= scale;
    ball.velocityY *= scale;
  }
}

function adjustBallAfterPaddleCollision(paddle, direction) {
  const baseSpeed = Math.abs(ball.velocityX) * PADDLE_HIT_SPEED_BOOST;
  const collidePoint = ball.y - (paddle.y + paddle.height / 2);
  const normalized = Math.max(
    -1,
    Math.min(1, collidePoint / (paddle.height / 2))
  );
  const influence = Math.abs(normalized);
  const speedMultiplier =
    1 + (1 - influence) * (PADDLE_SPEED_INCREASE - 1);
  const edgeDamping = 1 - influence * (1 - PADDLE_EDGE_DAMPING);

  ball.velocityX = direction * baseSpeed * speedMultiplier;
  ball.velocityY = normalized * baseSpeed * speedMultiplier * edgeDamping;
  clampBallSpeed();
}

const ball = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  size: 10,
  velocityX: BALL_INITIAL_SPEED_X,
  velocityY: BALL_INITIAL_SPEED_Y,
  visible: true,
};

let isRunning = false;
let animationFrameId = null;
let lastTime = 0;
let playerScore = 0;
let computerScore = 0;
let particles = [];
let isBallRespawning = false;
let respawnTimeoutId = null;
let audioContext = null;
let countdownValue = null;
let countdownIntervalId = null;

function initializeAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return null;
  }
  if (!audioContext) {
    audioContext = new AudioContextClass();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
  return audioContext;
}

function playRetroExplosion() {
  const context = audioContext;
  if (!context) {
    return;
  }
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(600, now);
  oscillator.frequency.exponentialRampToValueAtTime(120, now + 0.25);

  gainNode.gain.setValueAtTime(0.4, now);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.start(now);
  oscillator.stop(now + 0.32);
}

function playRetroBeep() {
  const context = audioContext;
  if (!context) {
    return;
  }
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(660, now);
  oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.15);

  gainNode.gain.setValueAtTime(0.25, now);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.start(now);
  oscillator.stop(now + 0.22);
}

function spawnDisintegrationParticles(x, y) {
  const particleCount = 20;
  for (let i = 0; i < particleCount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 2.5;
    particles.push({
      x,
      y,
      velocityX: Math.cos(angle) * speed,
      velocityY: Math.sin(angle) * speed,
      life: 1,
      size: 2 + Math.random() * 2,
    });
  }
}

function updateParticles(delta) {
  const damping = Math.pow(0.92, delta);
  particles = particles
    .map((particle) => {
      const updated = { ...particle };
      updated.x += updated.velocityX * delta;
      updated.y += updated.velocityY * delta;
      updated.velocityX *= damping;
      updated.velocityY *= damping;
      updated.life -= delta * 0.05;
      return updated;
    })
    .filter((particle) => particle.life > 0);
}

function drawParticles() {
  particles.forEach((particle) => {
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, Math.min(1, particle.life))})`;
    ctx.fillRect(
      particle.x - particle.size / 2,
      particle.y - particle.size / 2,
      particle.size,
      particle.size
    );
  });
}

function drawCountdown() {
  if (countdownValue === null) {
    return;
  }
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.beginPath();
  ctx.arc(canvas.width / 2, canvas.height / 2, 110, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 72px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(countdownValue, canvas.width / 2, canvas.height / 2);
  ctx.restore();
}

function clearCountdownTimers() {
  if (respawnTimeoutId) {
    clearTimeout(respawnTimeoutId);
    respawnTimeoutId = null;
  }
  if (countdownIntervalId) {
    clearInterval(countdownIntervalId);
    countdownIntervalId = null;
  }
  countdownValue = null;
}

function startCountdown(direction) {
  countdownValue = COUNTDOWN_START_VALUE;
  playRetroBeep();
  countdownIntervalId = setInterval(() => {
    countdownValue -= 1;
    if (countdownValue > 0) {
      playRetroBeep();
      return;
    }

    clearInterval(countdownIntervalId);
    countdownIntervalId = null;
    countdownValue = null;
    resetPaddlesPosition();
    resetBall(direction);
    ball.visible = true;
    isBallRespawning = false;
  }, 1000);
}

function triggerBallDisintegration(direction) {
  initializeAudioContext();
  spawnDisintegrationParticles(ball.x, ball.y);
  playRetroExplosion();
  ball.visible = false;
  isBallRespawning = true;
  clearCountdownTimers();

  const hasWinner = checkWinner();
  if (hasWinner) {
    isBallRespawning = false;
    return;
  }

  respawnTimeoutId = setTimeout(() => {
    respawnTimeoutId = null;
    resetPaddlesIfMatchPoint();
    startCountdown(direction);
  }, RESPAWN_INITIAL_DELAY);
}

function resetBall(direction = 1) {
  ball.x = canvas.width / 2;
  ball.y = canvas.height / 2;
  const speedX = BALL_INITIAL_SPEED_X + Math.random() * BALL_INITIAL_SPEED_VARIATION;
  const speedY = BALL_INITIAL_SPEED_Y + Math.random() * BALL_INITIAL_SPEED_VARIATION;
  ball.velocityX = direction * speedX;
  ball.velocityY = (Math.random() > 0.5 ? 1 : -1) * speedY;
  clampBallSpeed();
  ball.visible = true;
}

function resetGame() {
  clearCountdownTimers();
  playerScore = 0;
  computerScore = 0;
  updateScores();
  resetBall();
  resetPaddlesPosition();
  particles = [];
  isBallRespawning = false;
  ball.visible = true;
}

function resetPaddlesPosition() {
  const baseY = canvas.height / 2 - player.height / 2;
  player.y = baseY;
  computer.y = baseY;
  player.dy = 0;
}

function resetPaddlesIfMatchPoint() {
  if (
    playerScore < MAX_SCORE &&
    computerScore < MAX_SCORE &&
    (playerScore === MAX_SCORE - 1 || computerScore === MAX_SCORE - 1)
  ) {
    resetPaddlesPosition();
  }
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
  if (!ball.visible) {
    return;
  }
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
  if (isBallRespawning) {
    return;
  }
  ball.x += ball.velocityX * delta;
  ball.y += ball.velocityY * delta;

  if (ball.y - ball.size < 0 || ball.y + ball.size > canvas.height) {
    ball.velocityY *= -1;
    clampBallSpeed();
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
    adjustBallAfterPaddleCollision(player, 1);
  }

  if (collidedWithComputer) {
    adjustBallAfterPaddleCollision(computer, -1);
  }

  if (ball.x - ball.size < 0) {
    computerScore += 1;
    updateScores();
    triggerBallDisintegration(-1);
    return;
  } else if (ball.x + ball.size > canvas.width) {
    playerScore += 1;
    updateScores();
    triggerBallDisintegration(1);
    return;
  }
}

function checkWinner() {
  if (playerScore >= MAX_SCORE || computerScore >= MAX_SCORE) {
    stopGame();
    const winner = playerScore > computerScore ? "Joueur" : "Ordinateur";
    alert(`${winner} gagne !`);
    return true;
  }
  return false;
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
  updateParticles(delta);

  drawPaddle(player);
  drawPaddle(computer);
  drawBall();
  drawParticles();
  drawCountdown();

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
  initializeAudioContext();
  resetGame();
  startGame();
});

pauseButton.addEventListener("click", () => {
  initializeAudioContext();
  if (!isRunning) {
    startGame();
    pauseButton.textContent = "Pause";
  } else {
    stopGame();
    pauseButton.textContent = "Reprendre";
  }
});

window.addEventListener("keydown", (event) => {
  initializeAudioContext();
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
  initializeAudioContext();
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
