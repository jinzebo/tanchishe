const express = require('express');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(__dirname + '/public'));

let gameState = {
  snakes: {},
  food: { x: 10, y: 10, color: "#ff4444" },
  gridCount: 40,
  leaderboard: [],
  isPaused: false
};

function spawnFood() {
  let x, y;

  do {
    x = Math.floor(Math.random() * gameState.gridCount);
    y = Math.floor(Math.random() * gameState.gridCount);
  } while (
    Object.values(gameState.snakes).some(snake =>
      !snake.isDead &&
      snake.body.some(seg => seg.x === x && seg.y === y)
    )
  );

  gameState.food = {
    x,
    y,
    color: "#ff4444"
  };
}

function broadcast(data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

function checkWallCollision(head) {
  return (
    head.x < 0 ||
    head.y < 0 ||
    head.x >= gameState.gridCount ||
    head.y >= gameState.gridCount
  );
}

function checkSnakeCollision(head, snakeId) {

  for (let id in gameState.snakes) {

    if (id === snakeId) continue;

    const snake = gameState.snakes[id];

    if (snake.isDead) continue;

    if (
      snake.body.some(
        (seg, index) =>
          index !== 0 &&
          seg.x === head.x &&
          seg.y === head.y
      )
    ) {
      return true;
    }
  }

  return false;
}

function updateLeaderboard(nickname, score) {

  const index = gameState.leaderboard.findIndex(
    item => item.nickname === nickname
  );

  if (index !== -1) {

    if (score > gameState.leaderboard[index].highScore) {
      gameState.leaderboard[index].highScore = score;
    }

  } else {

    gameState.leaderboard.push({
      nickname,
      highScore: score
    });

  }

  gameState.leaderboard =
    gameState.leaderboard
      .sort((a, b) => b.highScore - a.highScore)
      .slice(0, 10);
}

function restartGame(id) {

  const snake = gameState.snakes[id];

  if (!snake) return;

  if (snake.score > snake.highScore) {
    snake.highScore = snake.score;
    updateLeaderboard(snake.nickname, snake.highScore);
  }

  snake.body = [{ x: 5, y: 5 }];
  snake.dir = "right";
  snake.score = 0;
  snake.isDead = false;
  snake.speed = snake.baseSpeed;

  broadcast({
    type: "state",
    state: gameState
  });
}

function togglePause() {

  gameState.isPaused = !gameState.isPaused;

  broadcast({
    type: "state",
    state: gameState
  });
}

function adjustSnakeSpeed(id, level) {

  const snake = gameState.snakes[id];

  if (!snake || snake.isDead) return;

  const speedMap = {
    1: 0.8,
    2: 1,
    3: 1.2,
    4: 1.5,
    5: 2
  };

  snake.speed = speedMap[level] || 1;
}

wss.on('connection', (ws) => {

  const id = Date.now().toString();

  console.log("玩家加入：" + id);

  const baseSpeed = 1;

  gameState.snakes[id] = {
    nickname: `玩家${Math.floor(Math.random() * 1000)}`,
    body: [{ x: 5, y: 5 }],
    dir: "right",
    speed: baseSpeed,
    baseSpeed,
    color: "#" + Math.floor(Math.random() * 16777215).toString(16),
    score: 0,
    highScore: 0,
    isDead: false
  };

  ws.send(JSON.stringify({
    type: "init",
    myId: id
  }));

  ws.send(JSON.stringify({
    type: "state",
    state: gameState
  }));

  ws.on('message', (msg) => {

    try {

      const data = JSON.parse(msg);

      if (data.type === "setNickname") {

        gameState.snakes[id].nickname =
          data.nickname.trim().slice(0, 8);
      }

      if (
        data.type === "control" &&
        !gameState.snakes[id].isDead &&
        !gameState.isPaused
      ) {

        const currentDir = gameState.snakes[id].dir;

        if (
          (data.dir === "up" && currentDir !== "down") ||
          (data.dir === "down" && currentDir !== "up") ||
          (data.dir === "left" && currentDir !== "right") ||
          (data.dir === "right" && currentDir !== "left")
        ) {
          gameState.snakes[id].dir = data.dir;
        }
      }

      if (
        data.type === "restart" &&
        gameState.snakes[id].isDead
      ) {
        restartGame(id);
      }

      if (data.type === "togglePause") {
        togglePause();
      }

      if (data.type === "adjustSpeed") {
        adjustSnakeSpeed(id, data.speedLevel);
      }

    } catch (e) {
      console.log("消息错误", e);
    }
  });

  ws.on('close', () => {

    const snake = gameState.snakes[id];

    if (snake) {

      if (snake.score > snake.highScore) {

        snake.highScore = snake.score;

        updateLeaderboard(
          snake.nickname,
          snake.highScore
        );
      }

      delete gameState.snakes[id];
    }

    broadcast({
      type: "state",
      state: gameState
    });

    console.log("玩家离开：" + id);
  });
});

setInterval(() => {

  if (gameState.isPaused) return;

  for (let id in gameState.snakes) {

    const snake = gameState.snakes[id];

    if (snake.isDead) continue;

    const head = { ...snake.body[0] };

    const moveTimes = Math.ceil(snake.speed);

    for (let i = 0; i < moveTimes; i++) {

      switch (snake.dir) {
        case "up":
          head.y--;
          break;

        case "down":
          head.y++;
          break;

        case "left":
          head.x--;
          break;

        case "right":
          head.x++;
          break;
      }

      if (
        checkWallCollision(head) ||
        checkSnakeCollision(head, id)
      ) {

        snake.isDead = true;

        if (snake.score > snake.highScore) {

          snake.highScore = snake.score;

          updateLeaderboard(
            snake.nickname,
            snake.highScore
          );
        }

        break;
      }

      snake.body.unshift({ ...head });

      if (
        head.x === gameState.food.x &&
        head.y === gameState.food.y
      ) {

        snake.score += 10;
        spawnFood();
        break;

      } else {

        snake.body.pop();

      }
    }
  }

  broadcast({
    type: "state",
    state: gameState
  });

}, 100);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {

  console.log("运行端口：" + PORT);

  spawnFood();
});