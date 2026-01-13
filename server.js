import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";
import bodyParser from "body-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { run, get, serialize, all } from "./database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// eslint-disable-next-line no-undef
const PORT = process.env.PORT || 3000;
const SECRET_KEY = "plinkoverse_secret_key_change_me";

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all for now
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "dist")));

// --- AUTH ROUTES ---

// Register
app.post("/api/auth/register", (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ msg: "Missing fields" });

  const hash = bcrypt.hashSync(password, 8);

  run(
    `INSERT INTO users (username, email, password) VALUES (?, ?, ?)`,
    [username, email, hash],
    function (err) {
      if (err) {
        if (err.message.includes("UNIQUE"))
          return res.status(400).json({ msg: "User already exists" });
        return res.status(500).json({ msg: "Database error" });
      }

      // Auto login
      const token = jwt.sign({ id: this.lastID }, SECRET_KEY, {
        expiresIn: "24h",
      });
      res.json({
        token,
        user: {
          id: this.lastID,
          username,
          email,
          balance: 0,
          kyc_status: "unverified",
        },
      });
    }
  );
});

// Login
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;

  get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
    if (err) return res.status(500).json({ msg: "Server error" });
    if (!user) return res.status(404).json({ msg: "User not found" });

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return res.status(401).json({ msg: "Invalid credentials" });

    const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: "24h" });
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        balance: user.balance,
        kyc_status: user.kyc_status,
      },
    });
  });
});

// Get Profile (Protected)
app.get("/api/user/profile", verifyToken, (req, res) => {
  get(
    `SELECT id, username, email, balance, kyc_status, created_at FROM users WHERE id = ?`,
    [req.userId],
    (err, user) => {
      if (err) return res.status(500).json({ msg: "Error" });
      res.json(user);
    }
  );
});

// Update Balance (e.g. Claim)
app.post("/api/user/claim", verifyToken, (req, res) => {
  const { amount, description } = req.body;
  // Simple logic: add balance
  serialize(() => {
    run(`UPDATE users SET balance = balance + ? WHERE id = ?`, [
      amount,
      req.userId,
    ]);
    run(
      `INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)`,
      [req.userId, "claim", amount, description || "Faucet Claim"]
    );

    get(`SELECT balance FROM users WHERE id = ?`, [req.userId], (err, row) => {
      res.json({ newBalance: row.balance });
    });
  });
});

function verifyToken(req, res, next) {
  const token = req.headers["x-access-token"] || req.headers["authorization"]; // Bearer <token>
  if (!token) return res.status(403).json({ msg: "No token" });

  // Remove 'Bearer ' if present
  const cleanToken = token.startsWith("Bearer ")
    ? token.slice(7, token.length)
    : token;

  jwt.verify(cleanToken, SECRET_KEY, (err, decoded) => {
    if (err) return res.status(401).json({ msg: "Unauthorized" });
    req.userId = decoded.id;
    next();
  });
}

// Stats (Total PLIK Claimed)
app.get("/api/stats/plik", (req, res) => {
  get(
    `SELECT SUM(amount) as totalClaimed FROM transactions WHERE type = 'claim'`,
    (err, row) => {
      if (err) return res.status(500).json({ msg: "Error" });
      res.json({ totalClaimed: row.totalClaimed || 0 });
    }
  );
});

// --- SOCKET IO (CHESS) ---

const rooms = {};

io.on("connection", (socket) => {
  // console.log("New connection:", socket.id);

  socket.on("create_room", (data) => {
    let roomId = uuidv4().slice(0, 5).toUpperCase();

    // Ensure unique room ID
    while (rooms[roomId]) {
      roomId = uuidv4().slice(0, 5).toUpperCase();
    }

    rooms[roomId] = {
      id: roomId,
      players: {},
      config: data.config || {
        // Default 2v2 Config: P1 White (Creator) vs 3 AI
        p1_white: {
          type: "human",
          id: socket.id,
          name: data.name || "Player 1",
          team: data.team || "Team A",
        },
        p1_black: {
          type: "ai",
          name: data.agentName ? `${data.agentName} (AI)` : "Black P1 (AI)",
        },
        p2_white: { type: "ai", name: "White P2 (AI)" },
        p2_black: { type: "ai", name: "Black P2 (AI)" },
      },
      turn: 0,
      history: [],
    };

    rooms[roomId].players[socket.id] = { role: "p1_white", name: data.name };

    socket.join(roomId);
    socket.emit("room_created", roomId);
    socket.emit("game_config", rooms[roomId].config); // Send initial config
  });

  socket.on("join_room", (data) => {
    const { roomId, name } = data;
    const room = rooms[roomId];

    if (room) {
      socket.join(roomId);

      // Assign next available human slot if any (Simple logic)
      socket.emit("joined_room", {
        roomId,
        config: room.config,
        history: room.history,
      });

      // Notify others
      socket.to(roomId).emit("player_joined", { name });
    } else {
      socket.emit("error", "Room not found");
    }
  });

  socket.on("make_move", (data) => {
    const { roomId, move } = data;
    if (rooms[roomId]) {
      rooms[roomId].history.push(move);
      socket.to(roomId).emit("opponent_move", move);
    }
  });

  // Leaderboard request
  socket.on("get_leaderboard", () => {
    all(
      `SELECT username, balance FROM users ORDER BY balance DESC LIMIT 10`,
      (err, rows) => {
        if (!err) {
          socket.emit("leaderboard_data", rows);
        }
      }
    );
  });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-undef
  console.log(`Server running on port ${PORT}`);
});
