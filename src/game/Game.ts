// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { ChessInstance, PieceColor } from "chess.js";
import { CustomLoadingManager } from "logic/LoadingManager/LoadingManager";
import { BasicScene } from "scenes/BasicScene/BasicScene";
import { ChessScene } from "scenes/ChessScene/ChessScene";
import { ReinhardToneMapping, sRGBEncoding, WebGLRenderer } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { GameOptions } from "./types";
import { Lobby, GameConfig } from "logic/Lobby/Lobby";
import { Socket } from "socket.io-client";

export class Game {
  private width = window.innerWidth;
  private height = window.innerHeight;

  private loadingManager: CustomLoadingManager;
  private loader: GLTFLoader;
  private renderer: WebGLRenderer;
  private activeScene: BasicScene | null;
  private socket: Socket | null = null;
  private myRole: string | null = null;
  private gameConfig: GameConfig | null = null;
  private roomId: string | null = null;

  private options: GameOptions;

  private resizeListener: () => void;

  constructor(options?: GameOptions) {
    this.options = options || {};

    this.setupLoader();
    this.setupRenderer();

    this.addListenerOnResize(this.renderer);

    this.activeScene = this.createChessScene();
  }

  private setupLoader(): void {
    this.loadingManager = new CustomLoadingManager();
    this.loader = new GLTFLoader(this.loadingManager);
  }

  private setupRenderer(): void {
    this.renderer = new WebGLRenderer({
      canvas: document.getElementById("app") as HTMLCanvasElement,
      alpha: false,
      antialias: true,
      powerPreference: "high-performance",
    });

    this.renderer.setSize(this.width, this.height);

    this.renderer.toneMapping = ReinhardToneMapping;
    this.renderer.toneMappingExposure = 3;
    this.renderer.physicallyCorrectLights = true;
    this.renderer.outputEncoding = sRGBEncoding;
    this.renderer.shadowMap.enabled = true;
  }

  private addListenerOnResize(renderer: WebGLRenderer): void {
    this.resizeListener = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", this.resizeListener, false);
  }

  private createChessScene(): ChessScene {
    return new ChessScene({
      renderer: this.renderer,
      loader: this.loader,
      options: {
        addGridHelper: this.options.addGridHelper,
        lightHelpers: this.options.lightHelpers,
        cannonDebugger: this.options.cannonDebugger,
      },
    });
  }

  private createEndPopup(endMsg: string): void {
    const div = document.createElement("DIV");
    const btnDiv = document.createElement("DIV");
    const restartBtn = document.createElement("BUTTON");
    const span = document.createElement("SPAN");

    restartBtn.onclick = () => {
      this.restartGame();
      div.remove();
    };

    restartBtn.innerHTML = "Restart Game";
    span.innerHTML = endMsg;

    btnDiv.classList.add("end-popup-btn");
    restartBtn.classList.add("btn-small");

    div.classList.add("center-mid");
    div.classList.add("end-popup");

    div.appendChild(span);
    btnDiv.appendChild(restartBtn);
    div.appendChild(btnDiv);

    document.body.appendChild(div);
  }

  private restartGame(): void {
    this.activeScene.cleanup();
    this.activeScene = this.createChessScene();
    this.activeScene.init();
    this.activeScene.start(
      (chessInstance: ChessInstance, playerColor: PieceColor) => {
        this.onEndGame(chessInstance, playerColor);
      },
      this.gameConfig,
      this.myRole,
      this.socket,
      this.roomId
    );
  }

  private onEndGame(chessInstance: ChessInstance, playerColor: PieceColor) {
    const endMsg = this.getEndGameMessage(chessInstance, playerColor);

    if (this.socket && this.myRole && this.gameConfig) {
      const myPlayerConfig = this.gameConfig[this.myRole as keyof GameConfig];
      const myName = myPlayerConfig.name;
      const myTeam = myPlayerConfig.team || "Anonymous";

      const myColor = this.myRole.includes("white") ? "w" : "b";
      const isCheckmate = chessInstance.in_checkmate();
      const turn = chessInstance.turn(); // 'w' or 'b' - who has no moves

      // If checkmate:
      // If turn === myColor, I lost (I have no moves).
      // If turn !== myColor, I won.

      if (isCheckmate) {
        if (turn !== myColor) {
          // I won
          this.socket.emit("report_win", { name: myName, team: myTeam });
        } else {
          // I lost
          this.socket.emit("report_loss", { name: myName, team: myTeam });
        }
      } else {
        // Draw
        // Ideally report draw
      }
    }

    this.createEndPopup(endMsg);
  }

  private getEndGameMessage(
    chessInstance: ChessInstance,
    playerColor: PieceColor
  ): string {
    const isPlayerColor = chessInstance.turn() === playerColor;

    if (chessInstance.in_checkmate()) {
      return isPlayerColor
        ? "You lost the game by checkmate"
        : "You won the game by checkmate";
    }

    if (chessInstance.in_stalemate()) {
      return "The game ended with draw by stalemate";
    }

    if (chessInstance.in_threefold_repetition()) {
      return "The game ended with threefold repetition";
    }

    if (chessInstance.in_draw()) {
      return "The game ended with draw";
    }
  }

  private initGame(): void {
    if (!this.activeScene) {
      throw new Error("There is no active scene at the moment");
    }

    this.activeScene.init();

    this.showLobby();
  }

  private showLobby(): void {
    const lobby = new Lobby((roomId, config, myRole, socket) => {
      this.socket = socket;
      this.myRole = myRole;
      this.gameConfig = config;
      this.roomId = roomId;

      this.activeScene.start(
        (chessInstance: ChessInstance, playerColor: PieceColor) => {
          this.onEndGame(chessInstance, playerColor);
        },
        config,
        myRole,
        socket,
        roomId
      );
    });
    lobby.show();
  }

  private updateGame(): void {
    if (!this.activeScene) {
      throw new Error("There is no active scene at the moment");
    }

    this.activeScene.world.fixedStep();
    this.activeScene.cannonDebugger?.update();
    this.activeScene.update();
  }

  init(): void {
    try {
      this.initGame();
    } catch (e) {
      console.error(e?.message);
    }
  }

  update(): void {
    try {
      this.updateGame();
    } catch (e) {
      console.error(e?.message);
    }
  }

  cleanup(): void {
    window.removeEventListener("resize", this.resizeListener);
  }
}
