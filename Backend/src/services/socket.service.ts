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
    
    // JWT authentication for socket.io
    io.use((socket: Socket, next) => {
      // Check for token in query or auth object (supporting both methods)
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

      // Handle new user event
      socket.on('newUser:username', (data) => {
        console.log("newUser:username -> New user event received: ", data);
      });

      // Handle bid event
      socket.on('send:bid', (data) => {
        console.log("send:bid -> Received event send:bid with data = ", data);
        // Original dummy functionality 
      });

      // Handle message event
      socket.on('send:message', (chat) => {
        console.log("send:message received with -> ", chat);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log("User disconnected");
        const username = this.usernamebySocketID.get(socket.id);
        if (username) {
          this.socketIDbyUsername.delete(username);
        }
        this.usernamebySocketID.delete(socket.id);
      });
    });
  }

  /**
   * Start auction timer for item remaining time updates
   */
  private startAuctionTimer(): void {
    // Timer function to decrement remaining time 
    this.intervalId = setInterval(async () => {
      if (!this.io) return;
      try {
        const activeItems = await Item.find({ sold: false, remainingtime: { $gt: 0 } });
        for (const item of activeItems) {
          item.remainingtime -= 1;
          if (item.remainingtime <= 0) {
            item.remainingtime = 0;
            item.sold = true;
          }
          await item.save();
          this.io.emit('item:update', item);
        }
      } catch (err) {
        console.error('Timer error:', err);
      }
    }, 1000);
  }

  /**
   * Broadcast new item to all clients
   * @param item The new item to broadcast
   */
  public broadcastNewItem(item: any): void {
    if (this.io) this.io.emit('new:item', item);
  }

  /**
   * Broadcast item removal to all clients
   * @param itemId ID of the removed item
   */
  public broadcastRemoveItem(itemId: string): void {
    if (this.io) this.io.emit('remove:item', { id: itemId });
  }

  /**
   * Broadcast bid update to all clients
   * @param updatedItem The item with updated bid information
   */
  public broadcastBidUpdate(updatedItem: any): void {
    if (this.io) this.io.emit('item:update', updatedItem);
  }

  /**
   * Broadcast user status change to all clients
   * @param username The username of the user whose status changed
   * @param online Whether the user is now online or offline
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