import express from "express";
import cors from "cors";
import http from "http";
import WebSocket, { WebSocketServer } from "ws";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = Number(process.env.PORT || 3000);
const ADMIN_KEY = process.env.ADMIN_KEY || "dev-admin-key";

app.use(cors());
app.use(express.json({ limit: "64kb" }));

const dataDir = path.join(__dirname, "data");
const dataFile = path.join(dataDir, "data.json");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(dataFile)) {
  fs.writeFileSync(
    dataFile,
    JSON.stringify({
      users: {},
      rooms: {},
      gifts: []
    }, null, 2)
  );
}

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(dataFile, "utf8"));
  } catch {
    return { users: {}, rooms: {}, gifts: [] };
  }
}

function saveData(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

let db = loadData();

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "web", "index.html"));
});

app.use(express.static(path.join(__dirname, "..", "web")));

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "Voice Hub",
    time: new Date().toISOString()
  });
});

app.post("/api/user", (req, res) => {
  const { id, name } = req.body;

  if (!id || !name) {
    return res.status(400).json({
      error: "id and name are required"
    });
  }

  if (!db.users[id]) {
    db.users[id] = {
      id,
      name,
      coins: 1000,
      received: 0,
      sent: 0,
      createdAt: new Date().toISOString()
    };

    saveData(db);
  }

  res.json(db.users[id]);
});

app.get("/api/user/:id", (req, res) => {
  const user = db.users[req.params.id];

  if (!user) {
    return res.status(404).json({
      error: "User not found"
    });
  }

  res.json(user);
});

app.post("/api/gift", (req, res) => {
  const { from, to, gift, price } = req.body;

  if (!from || !to || !gift || !Number.isFinite(Number(price))) {
    return res.status(400).json({
      error: "Invalid gift request"
    });
  }

  const amount = Number(price);

  if (!db.users[from]) {
    return res.status(404).json({
      error: "Sender not found"
    });
  }

  if (!db.users[to]) {
    return res.status(404).json({
      error: "Receiver not found"
    });
  }

  if (amount <= 0) {
    return res.status(400).json({
      error: "Invalid price"
    });
  }

  if (db.users[from].coins < amount) {
    return res.status(400).json({
      error: "Not enough coins"
    });
  }

  db.users[from].coins -= amount;
  db.users[from].sent += amount;

  db.users[to].coins += amount;
  db.users[to].received += amount;

  const transaction = {
    id: crypto.randomUUID(),
    from,
    to,
    gift,
    price: amount,
    createdAt: new Date().toISOString()
  };

  db.gifts.push(transaction);

  saveData(db);

  res.json({
    success: true,
    transaction,
    sender: db.users[from],
    receiver: db.users[to]
  });
});

app.get("/api/admin/summary", (req, res) => {
  const supplied = req.headers["x-admin-key"] || req.query.key;

  if (supplied !== ADMIN_KEY) {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }

  const users = Object.values(db.users);

  res.json({
    users: users.length,
    rooms: Object.keys(db.rooms).length,
    gifts: db.gifts.length,
    totalCoinsSent: db.gifts.reduce(
      (sum, item) => sum + Number(item.price || 0),
      0
    )
  });
});

function broadcast(roomId, message, except = null) {
  for (const client of wss.clients) {
    if (
      client.readyState === WebSocket.OPEN &&
      client.roomId === roomId &&
      client !== except
    ) {
      client.send(JSON.stringify(message));
    }
  }
}

wss.on("connection", (socket) => {
  socket.on("message", (raw) => {
    try {
      const message = JSON.parse(raw.toString());

      if (message.type === "join") {
        const roomId = String(message.roomId || "main");
        const userId = String(message.userId || "");
        const name = String(message.name || "Guest");

        socket.roomId = roomId;
        socket.userId = userId;
        socket.userName = name;

        if (!db.rooms[roomId]) {
          db.rooms[roomId] = {
            id: roomId,
            name: roomId,
            createdAt: new Date().toISOString()
          };

          saveData(db);
        }

        broadcast(roomId, {
          type: "user-joined",
          userId,
          name
        }, socket);

        socket.send(JSON.stringify({
          type: "joined",
          roomId
        }));

        return;
      }

      if (message.type === "chat") {
        broadcast(socket.roomId, {
          type: "chat",
          userId: socket.userId,
          name: socket.userName,
          text: String(message.text || ""),
          time: Date.now()
        });

        return;
      }

      if (
        message.type === "offer" ||
        message.type === "answer" ||
        message.type === "candidate"
      ) {
        broadcast(
          socket.roomId,
          {
            type: message.type,
            userId: socket.userId,
            data: message.data
          },
          socket
        );
      }
    } catch {
      socket.send(JSON.stringify({
        type: "error",
        message: "Invalid message"
      }));
    }
  });

  socket.on("close", () => {
    if (socket.roomId) {
      broadcast(socket.roomId, {
        type: "user-left",
        userId: socket.userId,
        name: socket.userName
      });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Voice Hub running on port ${PORT}`);
});
