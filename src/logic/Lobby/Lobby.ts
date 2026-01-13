/* eslint-disable @typescript-eslint/no-explicit-any */
// Telegram WebApp SDK is injected by the Telegram client
// WebApp is declared later in the file; skip duplicate declaration here
interface TelegramWindow {
  Telegram?: {
    WebApp?: {
      do: unknown;
      ready(): unknown;
      initDataUnsafe?: {
        user?: {
          first_name?: string;
        };
      };
    };
  };
}

const WebApp = (window as unknown as TelegramWindow).Telegram?.WebApp;
// import { TonConnectUI } from "@tonconnect/ui";

import { LeaderboardEntry } from "logic/LoadingManager/LoadingManager";
import { Socket } from "socket.io-client";
import { io } from "socket.io-client";

export interface PlayerConfig {
  type: "human" | "ai";
  id?: string;
  name: string;
  team?: string;
}

export interface GameConfig {
  p1_white: PlayerConfig;
  p1_black: PlayerConfig;
  p2_white: PlayerConfig;
  p2_black: PlayerConfig;
}

export class Lobby {
  private socket: Socket;
  private container: HTMLDivElement;
  private initialHistory: any[] = [];

  // private tonConnectUI: TonConnectUI;
  private onGameStart: (
    roomId: string,
    config: GameConfig,
    myRole: string | null,
    socket: Socket,
    history?: any[]
  ) => void;
  private currentConfig: GameConfig | null = null;
  private roomId: string | null = null;
  private myRole: string | null = null;

  constructor(
    onGameStart: (
      roomId: string,
      config: GameConfig,
      myRole: string | null,
      socket: Socket,
      history?: any[]
    ) => void
  ) {
    this.onGameStart = onGameStart;
    // Connect to the server (auto-detects origin, works with proxy in dev)
    this.socket = io();
    this.setupSocketListeners();

    WebApp?.ready();
  }

  private setupSocketListeners(): void {
    this.socket.on("connect", () => {
      console.log("Connected to server:", this.socket.id);
    });
    this.socket.on("leaderboard_data", (data: LeaderboardEntry[]) => {
      this.renderLeaderboard(data);
    });

    this.socket.on("room_created", ({ roomId, config }) => {
      this.roomId = roomId;
      this.currentConfig = config;
      this.myRole = "p1_white"; // Creator is P1 White by default
      this.renderRoom();
    });

    this.socket.on(
      "joined_room",
      ({
        roomId,
        config,
        role,
        history,
      }: {
        roomId: string;
        config: GameConfig;
        role: string;
        history: any[];
      }) => {
        this.roomId = roomId;
        this.currentConfig = config;
        this.myRole = role;
        this.initialHistory = history || [];
        this.renderRoom();
      }
    );

    this.socket.on("player_joined", ({ config }) => {
      this.currentConfig = config;
      this.renderRoom();
    });

    this.socket.on("config_updated", (config) => {
      this.currentConfig = config;
      this.renderRoom();
    });

    this.socket.on("game_started", ({ roomId, config }) => {
      this.container.remove();
      this.onGameStart(
        roomId,
        config,
        this.myRole,
        this.socket,
        this.initialHistory
      );
    });

    this.socket.on("leaderboard_data", (data) => {
      this.renderLeaderboard(data);
    });

    this.socket.on("users_update", (users) => {
      // If we are in the main menu, update the waiting room list
      const waitingList = document.getElementById("waiting-list");
      if (waitingList) {
        waitingList.innerHTML = "";
        Object.values(users).forEach((u: unknown) => {
          const li = document.createElement("li");
          const user = u as { name?: string; status?: string };
          li.innerText = `${user.name || "Unknown"} - ${
            user.status || "offline"
          }`;
          waitingList.appendChild(li);
        });
      }
    });
  }

  public show() {
    this.container = document.createElement("div");
    this.container.style.position = "absolute";
    this.container.style.top = "0";
    this.container.style.left = "0";
    this.container.style.width = "100%";
    this.container.style.height = "100%";
    this.container.style.backgroundColor = "rgba(0,0,0,0.85)";
    this.container.style.display = "flex";
    this.container.style.flexDirection = "column";
    this.container.style.alignItems = "center";
    this.container.style.justifyContent = "center";
    this.container.style.color = "white";
    this.container.style.zIndex = "1000";
    this.container.style.fontFamily = "Roboto, sans-serif";

    document.body.appendChild(this.container);
    this.renderMainMenu();

    // Initialize TON Connect
    // We create a container for the button inside our lobby
    // But since TonConnectUI expects an ID, we'll create a div with that ID
  }

  private renderMainMenu() {
    this.container.innerHTML = "";

    // Retrieve User Info from LocalStorage (shared with main site)
    let username = "Player";
    try {
      const storedUser = localStorage.getItem("plink_user");
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed.username) username = parsed.username;
        else if (parsed.email) username = parsed.email.split("@")[0];
      }
    } catch (e) {
      console.warn("Failed to load user data", e);
    }

    // Fallback to Telegram name if available
    const telegramName = WebApp?.initDataUnsafe?.user?.first_name;
    if (telegramName) username = telegramName;

    // Retrieve Agent Info from URL
    const params = new URLSearchParams(window.location.search);
    const agentName = params.get("agentName");
    const agentId = params.get("opponent");

    const title = document.createElement("h1");
    title.innerText = "2v2 Chess Prototype";
    this.container.appendChild(title);

    if (agentName) {
      const agentDisplay = document.createElement("h3");
      agentDisplay.style.color = "#00ff00"; // Green for visibility
      agentDisplay.innerText = `LINKED AGENT: ${agentName.toUpperCase()}`;
      this.container.appendChild(agentDisplay);

      const agentIdDisplay = document.createElement("p");
      agentIdDisplay.style.fontSize = "0.8rem";
      agentIdDisplay.style.opacity = "0.7";
      agentIdDisplay.innerText = `AGENT ID: ${agentId}`;
      this.container.appendChild(agentIdDisplay);
    }

    const welcome = document.createElement("p");
    welcome.innerText = `Welcome, ${username}`;
    welcome.style.marginBottom = "20px";
    this.container.appendChild(welcome);

    // TON Connect Button removed for now

    const teamInput = document.createElement("input");
    teamInput.placeholder = "Your Team Name";
    teamInput.style.padding = "10px";
    teamInput.style.marginBottom = "10px";
    this.container.appendChild(teamInput);

    const createBtn = document.createElement("button");
    createBtn.innerText = "Create Game";
    createBtn.className = "btn";

    createBtn.onclick = () =>
      this.socket.emit("create_room", {
        name: username,
        team: teamInput.value || "Team A",
        agentName: agentName, // Pass agent name to server if needed, or just for context
      });

    // Set my name on server
    this.socket.emit("set_name", username);

    this.container.appendChild(createBtn);

    const lbBtn = document.createElement("button");
    lbBtn.innerText = "Leaderboard";
    lbBtn.className = "btn";
    lbBtn.style.marginTop = "10px";
    lbBtn.onclick = () => {
      this.socket.emit("get_leaderboard");
    };
    this.container.appendChild(lbBtn);

    const joinContainer = document.createElement("div");
    joinContainer.style.marginTop = "20px";

    const input = document.createElement("input");
    input.placeholder = "Room ID";
    input.style.padding = "10px";
    input.style.marginRight = "10px";

    const joinBtn = document.createElement("button");
    joinBtn.innerText = "Join Game";
    joinBtn.className = "btn";

    joinBtn.onclick = () => {
      if (input.value) {
        this.socket.emit("join_room", {
          roomId: input.value,
          name: username,
        });
      }
    };

    joinContainer.appendChild(input);
    joinContainer.appendChild(joinBtn);
    this.container.appendChild(joinContainer);

    // Waiting Room List
    const wrContainer = document.createElement("div");
    wrContainer.style.marginTop = "30px";
    wrContainer.style.width = "80%";
    wrContainer.style.maxWidth = "400px";
    wrContainer.style.backgroundColor = "rgba(0,0,0,0.5)";
    wrContainer.style.padding = "10px";
    wrContainer.style.borderRadius = "8px";

    const wrTitle = document.createElement("h3");
    wrTitle.innerText = "Players Online";
    wrTitle.style.textAlign = "center";
    wrContainer.appendChild(wrTitle);

    const wrList = document.createElement("ul");
    wrList.id = "waiting-list";
    wrList.style.listStyle = "none";
    wrList.style.padding = "0";
    wrList.style.maxHeight = "150px";
    wrList.style.overflowY = "auto";
    wrContainer.appendChild(wrList);

    this.container.appendChild(wrContainer);
  }

  private renderLeaderboard(data?: LeaderboardEntry[]) {
    this.container.innerHTML = "";
    const title = document.createElement("h2");
    title.innerText = "Global Leaderboard";
    this.container.appendChild(title);

    const list = document.createElement("ul");
    list.style.listStyle = "none";
    list.style.padding = "0";
    list.style.width = "80%";
    list.style.maxWidth = "600px";

    data.forEach((entry, i) => {
      const totalGames = entry.gamesPlayed || 0;
      const winRate =
        totalGames > 0 ? ((entry.wins / totalGames) * 100).toFixed(1) : "0.0";

      const li = document.createElement("li");
      li.innerText = `#${i + 1} ${entry.name} (${entry.team}): ${
        entry.wins
      } wins | ${entry.losses || 0} losses | ${winRate}% WR | Streak: ${
        entry.currentStreak || 0
      } (Best: ${entry.bestStreak || 0})`;
      li.style.padding = "10px";
      li.style.borderBottom = "1px solid #444";
      li.style.fontSize = "18px";
      list.appendChild(li);
    });

    this.container.appendChild(list);

    const backBtn = document.createElement("button");
    backBtn.innerText = "Back";
    backBtn.className = "btn";
    backBtn.style.marginTop = "20px";
    backBtn.onclick = () => this.renderMainMenu();
    this.container.appendChild(backBtn);
  }

  private renderRoom(): void {
    this.container.innerHTML = "";

    const title = document.createElement("h2");
    title.innerText = `Room: ${this.roomId}`;
    this.container.appendChild(title);

    const playersList = document.createElement("div");
    playersList.style.margin = "20px";
    playersList.style.textAlign = "left";

    if (this.currentConfig) {
      const roles = ["p1_white", "p1_black", "p2_white", "p2_black"];
      roles.forEach((role) => {
        const player = this.currentConfig[role as keyof GameConfig];
        const p = document.createElement("p");
        p.innerText = `${role.toUpperCase()}: ${player.name} (${player.type})`;
        if (role === this.myRole) {
          p.style.fontWeight = "bold";
          p.style.color = "#00ff00";
        }
        playersList.appendChild(p);
      });
    }
    this.container.appendChild(playersList);

    if (this.myRole === "p1_white") {
      const startBtn = document.createElement("button");
      startBtn.innerText = "Start Game";
      startBtn.className = "btn";
      startBtn.onclick = () => {
        if (this.roomId) {
          this.socket.emit("start_game", { roomId: this.roomId });
        }
      };
      this.container.appendChild(startBtn);
    } else {
      const waitMsg = document.createElement("p");
      waitMsg.innerText = "Waiting for host to start...";
      this.container.appendChild(waitMsg);
    }

    const backBtn = document.createElement("button");
    backBtn.innerText = "Leave Room";
    backBtn.className = "btn";
    backBtn.style.marginTop = "20px";
    backBtn.onclick = () => {
      // Reload to leave for now (simple)
      window.location.reload();
    };
    this.container.appendChild(backBtn);
  }
}
