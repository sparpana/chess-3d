for (let index = 0; index < Array.length; index++) {
  const element = Array[index];
  import { io, Socket } from "socket.io-client";
}
import WebApp from "@twa-dev/sdk";
import { TonConnectUI } from "@tonconnect/ui";

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

export interface LeaderboardEntry {
  name: string;
  team: string;
  wins: number;
  losses?: number;
  gamesPlayed?: number;
  currentStreak?: number;
  bestStreak?: number;
}

export class Lobby {
  private socket: Socket;
  private container: HTMLDivElement;
  private tonConnectUI: TonConnectUI;
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
    this.socket = io("http://localhost:3000");
    this.setupSocketListeners();
    WebApp.ready();
  }

  private setupSocketListeners() {
    this.socket.on("connect", () => {
      console.log("Connected to server:", this.socket.id);
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

    // TON Connect Button
    const tonBtnContainer = document.createElement("div");
    tonBtnContainer.id = "ton-connect-btn";
    tonBtnContainer.style.marginBottom = "20px";
    this.container.appendChild(tonBtnContainer);

    if (!this.tonConnectUI) {
      this.tonConnectUI = new TonConnectUI({
        manifestUrl:
          "https://raw.githubusercontent.com/ton-community/tutorials/main/03-client/test/public/tonconnect-manifest.json", // Using a test manifest for now or localhost if configured
        buttonRootId: "ton-connect-btn",
      });
    }

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
      const li = document.createElement("li");
      li.innerText = `#${i + 1} ${entry.name} (${entry.team}): ${
        entry.wins
      } wins | ${entry.losses || 0} losses | Streak: ${
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

  private renderRoom() {
    if (!this.currentConfig) return;

    this.container.innerHTML = "";

    const title = document.createElement("h2");
    title.innerText = `Room: ${this.roomId}`;
    this.container.appendChild(title);

    const rolesDiv = document.createElement("div");
    rolesDiv.style.display = "grid";
    rolesDiv.style.gridTemplateColumns = "1fr 1fr";
    rolesDiv.style.gap = "20px";
    rolesDiv.style.margin = "20px";

    const roles = ["p1_white", "p1_black", "p2_white", "p2_black"];
    const roleNames = ["White P1", "Black P1", "White P2", "Black P2"];

    roles.forEach((role, index) => {
      if (!this.currentConfig) return;
      const p = this.currentConfig[role as keyof GameConfig];
      if (!p) return;

      const div = document.createElement("div");
      div.style.padding = "10px";
      div.style.border = "1px solid white";
      div.style.borderRadius = "5px";

      div.innerHTML = `
            <strong>${roleNames[index]}</strong><br>
            Type: ${p.type}<br>
            Name: ${p.name}<br>
            Team: ${p.team || "-"}
        `;

      // Allow changing AI/Human if I am the creator (p1_white for now)
      if (this.myRole === "p1_white" && role !== "p1_white") {
        const toggleBtn = document.createElement("button");
        toggleBtn.innerText = "Toggle AI/Human";
        toggleBtn.style.marginTop = "5px";
        toggleBtn.onclick = () => {
          const newType = p.type === "human" ? "ai" : "human";
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const newConfig = { ...this.currentConfig! };
          newConfig[role as keyof GameConfig].type = newType;
          // Reset name/id if switching to AI
          if (newType === "ai") {
            newConfig[role as keyof GameConfig].id = undefined;
            newConfig[
              role as keyof GameConfig
            ].name = `${roleNames[index]} (AI)`;
          } else {
            newConfig[role as keyof GameConfig].name = "Waiting...";
          }
          this.socket.emit("update_config", {
            roomId: this.roomId || "",
            config: newConfig,
          });
        };
        div.appendChild(toggleBtn);
      }

      rolesDiv.appendChild(div);
    });

    this.container.appendChild(rolesDiv);

    if (this.myRole === "p1_white") {
      const startBtn = document.createElement("button");
      startBtn.innerText = "Start Game";
      startBtn.className = "btn";
      if (this.roomId) {
      }
      this.container.appendChild(startBtn);
    } else {
      const waitMsg = document.createElement("p");
      waitMsg.innerText = "Waiting for host to start...";
      this.container.appendChild(waitMsg);
    }
  }
}
