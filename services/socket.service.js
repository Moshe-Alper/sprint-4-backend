import { Server } from 'socket.io'
import { logger } from './logger.service.js'

var gIo = null

export function setupSocketAPI(http) {
    gIo = new Server(http, {
        cors: {
            origin: '*',
        }
    })

    gIo.on('connection', socket => {
        logger.info(`New connected socket [id: ${socket.id}]`)

        socket.on('disconnect', () => {
            logger.info(`Socket disconnected [id: ${socket.id}]`)
        })

        socket.on('join-task', taskId => {
            if (socket.myTask === taskId) return
            if (socket.myTask) {
                socket.leave(socket.myTask)
                logger.info(`Socket is leaving task ${socket.myTask} [id: ${socket.id}]`)
            }
            socket.join(taskId)
            socket.myTask = taskId
            logger.info(`Socket is joining task ${taskId} [id: ${socket.id}]`)
        })

        socket.on('leave-task', taskId => {
            if (socket.myTask === taskId) {
                socket.leave(taskId)
                delete socket.myTask
                logger.info(`Socket is leaving task ${taskId} [id: ${socket.id}]`)
            }
        })

        socket.on('user-typing', ({ taskId, username }) => {
            logger.info(`User ${username} is typing in task ${taskId}`)
            socket.broadcast.to(taskId).emit('user-typing', { username })
        })

        socket.on('user-stopped-typing', ({ taskId }) => {
            logger.info(`User stopped typing in task ${taskId}`)
            socket.broadcast.to(taskId).emit('user-stopped-typing')
        })

        socket.on('comment-added', updatedTask => {
            logger.info(`New comment added to task ${updatedTask.id}`)
            socket.broadcast.to(socket.myTask).emit('comment-added', updatedTask)
        })

        socket.on('comment-updated', updatedTask => {
            logger.info(`Comment updated in task ${updatedTask.id}`)
            socket.broadcast.to(socket.myTask).emit('comment-updated', updatedTask)
        })

        socket.on('comment-removed', updatedTask => {
            logger.info(`Comment removed from task ${updatedTask.id}`)
            socket.broadcast.to(socket.myTask).emit('comment-removed', updatedTask)
        })

        socket.on('set-user-socket', userId => {
            logger.info(`Setting socket.userId = ${userId} for socket [id: ${socket.id}]`)
            socket.userId = userId
        })

        socket.on('unset-user-socket', () => {
            logger.info(`Removing socket.userId for socket [id: ${socket.id}]`)
            delete socket.userId
        })
    })
}

async function emitTo({ type, data, label }) {
    if (label) gIo.to('watching:' + label).emit(type, data)
    else gIo.emit(type, data)
}

async function emitToUser({ type, data, userId }) {
    userId = userId.toString()
    const socket = await _getUserSocket(userId)

    if (socket) {
        logger.info(`Emiting event: ${type} to user: ${userId} socket [id: ${socket.id}]`)
        socket.emit(type, data)
    } else {
        logger.info(`No active socket for user: ${userId}`)
    }
}

async function broadcast({ type, data, room = null, userId }) {
    userId = userId.toString()
    
    logger.info(`Broadcasting event: ${type}`)
    const excludedSocket = await _getUserSocket(userId)
    if (room && excludedSocket) {
        logger.info(`Broadcast to room ${room} excluding user: ${userId}`)
        excludedSocket.broadcast.to(room).emit(type, data)
    } else if (excludedSocket) {
        logger.info(`Broadcast to all excluding user: ${userId}`)
        excludedSocket.broadcast.emit(type, data)
    } else if (room) {
        logger.info(`Emit to room: ${room}`)
        gIo.to(room).emit(type, data)
    } else {
        logger.info(`Emit to all`)
        gIo.emit(type, data)
    }
}

async function _getUserSocket(userId) {
    const sockets = await _getAllSockets()
    const socket = sockets.find(s => s.userId === userId)
    return socket
}

async function _getAllSockets() {
    const sockets = await gIo.fetchSockets()
    return sockets
}

export const socketService = {
    setupSocketAPI,
    emitTo,
    emitToUser,
    broadcast,
}