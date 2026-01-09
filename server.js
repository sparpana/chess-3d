const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static("dist"));

// Game State Storage (Memory)
const rooms = {};
const leaderboard = [
  { name: "Grandmaster AI", wins: 10, losses: 0, gamesPlayed: 10, team: "DeepBlue" },
  { name: "Rookie", wins: 2, losses: 8, gamesPlayed: 10, team: "Humans" }
];

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("get_leaderboard", () => {
    socket.emit("leaderboard_data", leaderboard);
  });

  socket.on("report_win", ({ name, team }) => {
    const entry = leaderboard.find(e => e.name === name && e.team === team);
    if (entry) {
      entry.wins++;
      entry.gamesPlayed = (entry.gamesPlayed || 0) + 1;
      entry.currentStreak = (entry.currentStreak || 0) + 1;
      if ((entry.currentStreak || 0) > (entry.bestStreak || 0)) {
        entry.bestStreak = entry.currentStreak;
      }
    } else {
      leaderboard.push({ 
        name, 
        wins: 1, 
        losses: 0, 
        gamesPlayed: 1, 
        team: team || "Anonymous",
        currentStreak: 1,
        bestStreak: 1
      });
    }
    leaderboard.sort((a, b) => b.wins - a.wins);
    io.emit("leaderboard_data", leaderboard);
  });
  
  socket.on("report_loss", ({ name, team }) => {
    const entry = leaderboard.find(e => e.name === name && e.team === team);
    if (entry) {
      entry.losses = (entry.losses || 0) + 1;
      entry.gamesPlayed = (entry.gamesPlayed || 0) + 1;
      entry.currentStreak = 0;
    } else {
      leaderboard.push({ 
        name, 
        wins: 0, 
        losses: 1, 
        gamesPlayed: 1, 
        team: team || "Anonymous",
        currentStreak: 0,
        bestStreak: 0
      });
    }
    io.emit("leaderboard_data", leaderboard);
  });

  socket.on("create_room", (data) => {
    const roomId = uuidv4().slice(0, 6).toUpperCase();
    rooms[roomId] = {
      id: roomId,
      players: {}, 
      config: data.config || { 
        // Default 2v2 Config: P1 White (Creator) vs 3 AI
        p1_white: { type: 'human', id: socket.id, name: data.name || 'Player 1', team: data.team || 'Team A' },
        p1_black: { type: 'ai', name: 'Black P1 (AI)' },
        p2_white: { type: 'ai', name: 'White P2 (AI)' },
        p2_black: { type: 'ai', name: 'Black P2 (AI)' }
      },
      turn: 0,
      history: []
    };
    
    socket.join(roomId);
    socket.emit("room_created", { roomId, config: rooms[roomId].config });
    console.log(`Room ${roomId} created by ${socket.id}`);
  });

  socket.on("join_room", ({ roomId, name }) => {
    const room = rooms[roomId];
    if (!room) {
      socket.emit("error", { message: "Room not found" });
      return;
    }
    
    // Simple logic: find first available 'human' slot that is empty (no ID)
    // Or if the user wants to join, we might need to change a slot from AI to Human
    // For this prototype, we'll just try to fill a spot.
    
    let assignedRole = null;
    const roles = ['p1_white', 'p1_black', 'p2_white', 'p2_black'];
    
    // First pass: look for open human slots
    for (const role of roles) {
        if (room.config[role].type === 'human' && !room.config[role].id) {
            room.config[role].id = socket.id;
            room.config[role].name = name || `Player ${socket.id.slice(0,4)}`;
            assignedRole = role;
            break;
        }
    }
    
    // Second pass: if no open human slots, convert an AI slot? 
    // Let's keep it simple: Lobby owner configures slots. Joiner just watches or takes what's given.
    
    socket.join(roomId);
    socket.emit("joined_room", { roomId, config: room.config, role: assignedRole });
    io.to(roomId).emit("player_joined", { config: room.config });
  });

  socket.on("update_config", ({ roomId, config }) => {
      if (rooms[roomId]) {
          // Verify ownership? Skip for prototype
          rooms[roomId].config = config;
          io.to(roomId).emit("config_updated", config);
      }
  });
  
  socket.on("start_game", ({ roomId }) => {
      if (rooms[roomId]) {
        io.to(roomId).emit("game_started", { roomId, config: rooms[roomId].config });
      }
  });

  socket.on("make_move", ({ roomId, move }) => {
    const room = rooms[roomId];
    if (room) {
        room.history.push(move);
        room.turn++;
        // Broadcast move to everyone else in the room
        socket.to(roomId).emit("move_made", move);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    // Remove player from rooms?
    // For prototype, we keep them in config but they might be offline.
  });
});

server.listen(process.env.PORT || PORT, () => {
  console.log("Server listening on port " + PORT);
});