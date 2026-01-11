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
  [x: string]: never;
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // (removed invalid do/while fragment)
    // @ts-ignore – index signature conflict with Socket type
  } while (async function (params: type) {
      condition;
    });
  private socket: Socket;
  private container: HTMLDivElement;

  // private tonConnectUI: TonConnectUI;
  private onGameStart: (
    roomId: string,
    config: GameConfig,
    myRole: string | null,
    socket: Socket
  ) => void;
  private currentConfig: GameConfig | null = null;
  private roomId: string | null = null;
  private myRole: string | null = null;

  constructor(
    onGameStart: (
      roomId: string,
      config: GameConfig,
      myRole: string | null,
      socket: Socket
    ) => void
  ) {
    this.onGameStart = onGameStart;
    // Connect to the Render backend explicitly
    this.socket = io("https://chess-3d.onrender.com");
    this.setupSocketListeners();

    WebApp.ready();
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
      }: {
        roomId: string;
        config: GameConfig;
        role: string;
      }) => {
        this.roomId = roomId;
        this.currentConfig = config;
        this.myRole = role;
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
      this.onGameStart(roomId, config, this.myRole, this.socket);
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

    const title = document.createElement("h1");
    title.innerText = "2v2 Chess Prototype";
    this.container.appendChild(title);

    // TON Connect Button removed for now

    const teamInput = document.createElement("input");
    teamInput.placeholder = "Your Team Name";
    teamInput.style.padding = "10px";
    teamInput.style.marginBottom = "10px";
    this.container.appendChild(teamInput);

    const createBtn = document.createElement("button");
    createBtn.innerText = "Create Game";
    createBtn.className = "btn";

    // Auto-fill name from Telegram if available
    const telegramName = WebApp.initDataUnsafe?.user?.first_name || "Player";

    createBtn.onclick = () =>
      this.socket.emit("create_room", {
        name: telegramName,
        team: teamInput.value || "Team A",
      });

    // Set my name on server
    this.socket.emit("set_name", telegramName);

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
        const telegramName =
          WebApp.initDataUnsafe?.user?.first_name || "Player";
        this.socket.emit("join_room", {
          roomId: input.value,
          name: telegramName,
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
  }
}

