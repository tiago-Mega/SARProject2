import { Request, Response } from 'express';
import Item from '../models/item';
import socketService from '../services/socket.service';

/**
 * Create a new item
 */
export const createItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { description, currentbid, remainingtime, buynow } = req.body;
    const owner = (req as any).auth.username;

    if (!description || currentbid == null || remainingtime == null) {
      res.status(400).json({ message: 'description, currentbid and remainingtime are required' });
      return;
    }

    const item = new Item({
      description, currentbid, remainingtime,
      buynow: buynow || 0,
      owner,
      wininguser: '',
      sold: false
    });
    const saved = await item.save();
    socketService.broadcastNewItem(saved);
    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ message: 'Error creating item', error });
  }
};

/**
 * Remove an existing item — uses MongoDB _id
 */
export const removeItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.body;
    const username = (req as any).auth.username;

    const item = await Item.findById(id);
    if (!item) {
      res.status(404).json({ message: 'Item not found' });
      return;
    }
    if (item.owner !== username) {
      res.status(403).json({ message: 'Only the owner can remove this item' });
      return;
    }
    await Item.findByIdAndDelete(id);
    socketService.broadcastRemoveItem(id);
    res.status(200).json({ message: 'Item removed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error removing item', error });
  }
};

/**
 * Get all items
 */
export const getItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const items = await Item.find();
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch items', error });
  }
};

/**
 * Place a bid on an item — uses MongoDB _id
 */
export const placeBid = async (req: Request, res: Response): Promise<void> => {
  try {
    const { itemId, amount } = req.body;
    const username = (req as any).auth.username;

    if (!itemId || amount == null) {
      res.status(400).json({ message: 'itemId and amount are required' });
      return;
    }

    const item = await Item.findOne({ _id: itemId, sold: false });
    if (!item) {
      res.status(404).json({ message: 'Item not found or auction closed' });
      return;
    }
    if (item.remainingtime <= 0) {
      res.status(400).json({ message: 'Auction has ended' });
      return;
    }
    if (item.owner === username) {
      res.status(400).json({ message: 'Owner cannot bid on their own item' });
      return;
    }
    if (amount <= item.currentbid) {
      res.status(400).json({ message: 'Bid must exceed current bid of ' + item.currentbid });
      return;
    }

    item.currentbid = amount;
    item.wininguser = username;
    await item.save();

    socketService.broadcastBidUpdate(item);
    res.status(200).json(item);
  } catch (error) {
    res.status(500).json({ message: 'Error placing bid', error });
  }
};
