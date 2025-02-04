import { logger } from "./logger.service.js";
import { Server } from "socket.io";

var gIo = null;

export function setupSocketAPI(http) {
    gIo = new Server(http, {
        cors: {
            origin: ["http://localhost:5173", "http://localhost:3000"],
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    gIo.on("connection", (socket) => {
        logger.info(`✅ New WebSocket connection [id: ${socket.id}]`);

        socket.on("disconnect", () => {
            logger.info(`❌ Socket disconnected [id: ${socket.id}]`);
        });

        socket.on("board-join", (boardId) => {
            if (socket.boardId) socket.leave(socket.boardId);
            socket.join(boardId);
            socket.boardId = boardId;
            logger.info(`📌 Socket [id: ${socket.id}] joined board ${boardId}`);
        });

        socket.on("board-update", ({ boardId, updatedBoard }) => {
            logger.info(`🔄 Board updated: ${boardId}`);
            gIo.to(boardId).emit("board-updated", updatedBoard);
        });

        socket.on("card-move", ({ boardId, card }) => {
            logger.info(`🚀 Card moved: ${card.id} on board ${boardId}`);
            gIo.to(boardId).emit("card-moved", card);
        });

        socket.on("card-typing", ({ boardId, userId, cardId }) => {
            gIo.to(boardId).emit("user-typing", { userId, cardId });
        });

        socket.on("set-user-socket", (userId) => {
            logger.info(`Setting socket.userId = ${userId} for socket [id: ${socket.id}]`);
            socket.userId = userId;
        });

        socket.on("unset-user-socket", () => {
            logger.info(`Removing socket.userId for socket [id: ${socket.id}]`);
            delete socket.userId;
        });
    });
}

export const socketService = {
    setupSocketAPI
}
