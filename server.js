const express = require('express');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(__dirname + '/public'));

// 配置参数
const GRID_COUNT = 60;  // ✅ 地图扩大到60x60，适合更多人
const FOOD_COUNT = 8;   // ✅ 增加食物数量
const TICK_INTERVAL = 100; // 游戏循环间隔(毫秒)

let gameState = {
  snakes: {},
  food: [],  // ✅ 改为食物数组
  gridCount: GRID_COUNT,
  leaderboard: [],
  isPaused: false
};

// ✅ 改进的速度映射表 - 更多级别，可以更慢
const SPEED_MAP = {
  1: 0.2,  // 非常慢
  2: 0.4,  // 慢
  3: 0.6,  // 较慢
  4: 0.8,  // 稍慢
  5: 1.0,  // 正常
  6: 1.3,  // 稍快
  7: 1.7,  // 快
  8: 2.2,  // 很快
  9: 2.8,  // 极快
  10: 3.5  // 超快
};

// ✅ 生成多个食物
function spawnFood() {
  const foods = [];
  
  // 清空现有食物
  gameState.food = [];
  
  // 生成多个食物
  for (let f = 0; f < FOOD_COUNT; f++) {
    let x, y, valid = false;
    let attempts = 0;
    
    do {
      x = Math.floor(Math.random() * gameState.gridCount);
      y = Math.floor(Math.random() * gameState.gridCount);
      
      // 检查是否在蛇身上
      const onSnake = Object.values(gameState.snakes).some(snake =>
        !snake.isDead &&
        snake.body.some(seg => seg.x === x && seg.y === y)
      );
      
      // 检查是否在其他食物上
      const onFood = foods.some(food => food.x === x && food.y === y);
      
      valid = !onSnake && !onFood;
      attempts++;
      
      // 防止无限循环
      if (attempts > 100) {
        valid = true; // 强制接受当前位置
      }
    } while (!valid);
    
    foods.push({
      x,
      y,
      color: `hsl(${Math.random() * 360}, 80%, 60%)` // 随机颜色
    });
  }
  
  gameState.food = foods;
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

  // ✅ 随机出生点
  const spawnX = Math.floor(Math.random() * (gameState.gridCount - 10)) + 5;
  const spawnY = Math.floor(Math.random() * (gameState.gridCount - 10)) + 5;
  
  snake.body = [{ x: spawnX, y: spawnY }];
  snake.dir = ["up", "down", "left", "right"][Math.floor(Math.random() * 4)];
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
  
  // ✅ 使用新的速度映射表
  snake.speed = SPEED_MAP[level] || 1;
  snake.speedLevel = level; // 记录当前速度级别
}

wss.on('connection', (ws) => {
  const id = Date.now().toString();
  console.log("玩家加入：" + id);

  const baseSpeed = SPEED_MAP[5]; // 默认速度为正常(级别5)
  
  // ✅ 随机出生点
  const spawnX = Math.floor(Math.random() * (GRID_COUNT - 10)) + 5;
  const spawnY = Math.floor(Math.random() * (GRID_COUNT - 10)) + 5;
  
  gameState.snakes[id] = {
    nickname: `玩家${Math.floor(Math.random() * 1000)}`,
    body: [{ x: spawnX, y: spawnY }],
    dir: ["up", "down", "left", "right"][Math.floor(Math.random() * 4)],
    speed: baseSpeed,
    baseSpeed: baseSpeed,
    speedLevel: 5, // 默认速度级别
    color: "#" + Math.floor(Math.random() * 16777215).toString(16),
    score: 0,
    highScore: 0,
    isDead: false,
    lastActive: Date.now() // 添加最后活动时间
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
      const snake = gameState.snakes[id];
      if (!snake) return;
      
      snake.lastActive = Date.now(); // 更新最后活动时间

      if (data.type === "setNickname") {
        snake.nickname = data.nickname.trim().slice(0, 8);
      }

      if (
        data.type === "control" &&
        !snake.isDead &&
        !gameState.isPaused
      ) {
        const currentDir = snake.dir;
        if (
          (data.dir === "up" && currentDir !== "down") ||
          (data.dir === "down" && currentDir !== "up") ||
          (data.dir === "left" && currentDir !== "right") ||
          (data.dir === "right" && currentDir !== "left")
        ) {
          snake.dir = data.dir;
        }
      }

      if (
        data.type === "restart" &&
        snake.isDead
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
        updateLeaderboard(snake.nickname, snake.highScore);
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

// ✅ 游戏主循环
setInterval(() => {
  if (gameState.isPaused) return;

  for (let id in gameState.snakes) {
    const snake = gameState.snakes[id];
    if (snake.isDead) continue;

    const head = { ...snake.body[0] };
    
    // ✅ 使用累积移动系统，支持更精细的速度控制
    const moveTimes = Math.floor(snake.speed);
    const partialMove = snake.speed - moveTimes;
    
    // 累积部分移动
    if (!snake.partialAccumulator) snake.partialAccumulator = 0;
    snake.partialAccumulator += partialMove;
    
    let totalMoves = moveTimes;
    if (snake.partialAccumulator >= 1) {
      totalMoves++;
      snake.partialAccumulator--;
    }
    
    for (let i = 0; i < totalMoves; i++) {
      switch (snake.dir) {
        case "up": head.y--; break;
        case "down": head.y++; break;
        case "left": head.x--; break;
        case "right": head.x++; break;
      }

      if (checkWallCollision(head) || checkSnakeCollision(head, id)) {
        snake.isDead = true;
        if (snake.score > snake.highScore) {
          snake.highScore = snake.score;
          updateLeaderboard(snake.nickname, snake.highScore);
        }
        break;
      }

      snake.body.unshift({ ...head });
      
      // ✅ 检查是否吃到食物
      const foodIndex = gameState.food.findIndex(food => 
        food.x === head.x && food.y === head.y
      );
      
      if (foodIndex !== -1) {
        snake.score += 10;
        // 移除被吃掉的食物
        gameState.food.splice(foodIndex, 1);
        // 生成新的食物
        let newFood = null;
        let attempts = 0;
        do {
          const x = Math.floor(Math.random() * gameState.gridCount);
          const y = Math.floor(Math.random() * gameState.gridCount);
          
          const onSnake = Object.values(gameState.snakes).some(s =>
            !s.isDead && s.body.some(seg => seg.x === x && seg.y === y)
          );
          
          const onFood = gameState.food.some(f => f.x === x && f.y === y);
          
          if (!onSnake && !onFood) {
            newFood = {
              x,
              y,
              color: `hsl(${Math.random() * 360}, 80%, 60%)`
            };
          }
          attempts++;
        } while (!newFood && attempts < 50);
        
        if (newFood) {
          gameState.food.push(newFood);
        }
      } else {
        snake.body.pop();
      }
    }
  }

  broadcast({
    type: "state",
    state: gameState
  });

}, TICK_INTERVAL);

// ✅ 定期清理不活跃的玩家
setInterval(() => {
  const now = Date.now();
  for (let id in gameState.snakes) {
    const snake = gameState.snakes[id];
    if (now - snake.lastActive > 30000) { // 30秒不活动
      console.log("清理不活跃玩家：" + id);
      delete gameState.snakes[id];
    }
  }
}, 10000); // 每10秒检查一次

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("运行端口：" + PORT);
  spawnFood();
});
