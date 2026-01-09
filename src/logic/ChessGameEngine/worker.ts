import { ChessAi } from "logic/ChessAi/ChessAi";
import { WebWorkerEvent } from "./types";

const chessAiManager = new ChessAi();

addEventListener("message", (e: WebWorkerEvent) => {
  const type = e.data.type;

  switch (type) {
    case "init":
      console.log("Worker: Init", e.data.color);
      chessAiManager.init(e.data.color, e.data.fen);

      if (chessAiManager.isBlack()) {
        return;
      }

      console.log(
        "Worker: Auto-move for White in Init (should not happen in 2v2 logic)"
      );
      postMessage({
        type: "aiMovePerformed",
        aiMove: chessAiManager.calcAiMove(),
      });

      break;
    case "aiMove":
      chessAiManager.updateBoardWithPlayerMove(e.data.playerMove);
      postMessage({
        type: "aiMovePerformed",
        aiMove: chessAiManager.calcAiMove(),
      });
      break;
    case "calculate":
      console.log("Worker: Calculate");
      try {
        const move = chessAiManager.calcAiMove();
        console.log("Worker: Calculated move", move);
        postMessage({
          type: "aiMovePerformed",
          aiMove: move,
        });
      } catch (err) {
        console.error("Worker: Error calculating move", err);
      }
      break;
    case "promote":
      chessAiManager.updateChessEngineWithPromotion(e.data);
      break;
    default:
      return;
  }
});
