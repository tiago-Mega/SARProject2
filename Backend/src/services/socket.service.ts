import * as jwt from 'jsonwebtoken';

import { Server, Socket } from 'socket.io';
import config from '../config/config';
import Item from '../models/item';

class SocketService {
  private io: Server | null = null;
  private socketIDbyUsername: Map<string, string> = new Map();
  private usernamebySocketID: Map<string, string> = new Map();
  private intervalId: NodeJS.Timeout | null = null;

  /**
   * Initialize Socket.IO server
   */
  public init(io: Server): void {
    this.io = io;

    // JWT authentication middleware for socket.io
    io.use((socket: Socket, next) => {
      const authData = socket.handshake.auth as Record<string, unknown> | undefined;
      const queryToken = socket.handshake.query?.token;
      const token =
        (typeof queryToken === 'string' ? queryToken : undefined) ||
        (typeof authData?.token === 'string' ? authData.token : undefined);

      if (token) {
        jwt.verify(token, config.jwtSecret, (err: jwt.VerifyErrors | null, decoded: unknown) => {
          if (err) {
            console.error('Socket auth error:', err.message);
            return next(new Error('Authentication error'));
          }
          socket.data.decoded_token = decoded;
          next();
        });
      } else {
        console.error('Socket auth error: No token provided');
        next(new Error('Authentication error: No token provided'));
      }
    });

    console.log('Socket service initialized');
    this.setupSocketEvents();
    this.startAuctionTimer();
  }

  /**
   * Set up socket event handlers
   */
  private setupSocketEvents(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      const username = socket.data.decoded_token.username;
      console.log(`${username} user connected`);

      // Store client in the maps
      this.socketIDbyUsername.set(username, socket.id);
      this.usernamebySocketID.set(socket.id, username);

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`${username} disconnected`);
        this.socketIDbyUsername.delete(username);
        this.usernamebySocketID.delete(socket.id);
      });
    });
  }

  /**
   * Start auction timer — decrements remainingtime every second
   */
  private startAuctionTimer(): void {
    this.intervalId = setInterval(async () => {
      if (!this.io) return;
      try {
        const activeItems = await Item.find({ sold: false, endsAt: { $lte: new Date() } });

        if (activeItems.length === 0) return;

        await Item.updateMany(
          {
            sold: false,
            endsAt: { $lte: new Date() }
          },
          {
            $set: { sold: true, remainingtime: 0 }
          }
        );

        for (const item of activeItems) {
          item.sold = true;
          item.remainingtime = 0;
          this.io.emit('item:update', item);
        }
      } catch (err) {
        console.error('Timer error:', err);
      }
    }, 1000);
  }

  /**
   * Broadcast a new item to all connected clients
   */
  public broadcastNewItem(item: any): void {
    if (this.io) this.io.emit('new:item', item);
  }

  /**
   * Broadcast item removal to all connected clients
   */
  public broadcastRemoveItem(itemId: string): void {
    if (this.io) this.io.emit('remove:item', { id: itemId });
  }

  /**
   * Broadcast a bid update to all connected clients
   */
  public broadcastBidUpdate(updatedItem: any): void {
    if (this.io) this.io.emit('item:update', updatedItem);
  }

  /**
   * Broadcast a user login/logout status to all connected clients
   */
  public broadcastUserStatus(username: string, online: boolean): void {
    if (this.io) this.io.emit('user:status', { username, online });
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}

export default new SocketService();
