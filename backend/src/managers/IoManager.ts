import http from 'http';

import { Server } from "socket.io";
const server = http.createServer();


export class IoManager {
    private static io: Server;

    // singletons
    public static getIo() {
        if (!this.io) {
            const io = new Server(server, {
                cors: {
                    origin: "*",
                    methods: ["GET", "POST"]
                },
                // Detect dead connections faster to avoid phantom users
                pingInterval: 8000,
                pingTimeout: 20000,
                connectTimeout: 10000,
                // Allow both websocket and polling for resilience
                transports: ['websocket', 'polling'],
                allowUpgrades: true,
            });
            this.io = io;
        }
        return this.io;
    }

}
