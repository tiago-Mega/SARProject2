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

    if (buynow && buynow > 0 && buynow <= currentbid) {
      res.status(400).json({ message: 'Buy Now price must be greater than the starting bid' });
      return;
    }

    const durationSeconds = Number(remainingtime);

    const item = new Item({
      description, currentbid, 
      remainingtime: durationSeconds,
      buynow: buynow || 0,
      owner,
      wininguser: '',
      sold: false,
      endsAt: new Date(Date.now() + durationSeconds * 1000)
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

    const item = await Item.findOne({ _id: itemId});
    if (!item) {
      res.status(404).json({ message: 'Item not found ' });
      return;
    }
    if(item.sold) {
      res.status(400).json({ message: 'Item has already been sold' });
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

    // Attempt to atomically update the bid if it still meets the criteria
    const updated = await Item.findOneAndUpdate(
      {
        _id: itemId,
        sold: false,
        remainingtime: { $gt: 0 },
        owner: { $ne: username },
        currentbid: { $lt: amount }   // The atomic guard: bid must beat current
      },
      {
        $set: { currentbid: amount, wininguser: username }
      },
      { new: true } // Return the updated document
    );

    // If no document was updated, it means the bid was outbid by someone else in the meantime
    if (!updated) {
      // Re-fetch to return the latest bid so the client can see what beat them
      const latest = await Item.findById(itemId);
      res.status(409).json({
        message: `Bid was outbid. Current highest bid is ${latest?.currentbid ?? 'unknown'}`,
        currentbid: latest?.currentbid
      });
      return;
    }

    socketService.broadcastBidUpdate(updated);
    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Error placing bid', error });
  }
};

/**
 * Buy Now — instantly closes the auction at the fixed buynow price
 */
export const buyNow = async (req: Request, res: Response): Promise<void> => {
  try {
    const { itemId } = req.body;
    const username = (req as any).auth.username;

    if (!itemId) {
      res.status(400).json({ message: 'itemId is required' });
      return;
    }

    const existing = await Item.findById(itemId);
    if (!existing) {
      res.status(404).json({ message: 'Item not found' });
      return;
    }
    if (existing.sold) {
      res.status(400).json({ message: 'Auction is already closed' });
      return;
    }
    if (existing.remainingtime <= 0) {
      res.status(400).json({ message: 'Auction has already ended' });
      return;
    }
    if (existing.owner === username) {
      res.status(400).json({ message: 'Owner cannot buy their own item' });
      return;
    }
    if (!existing.buynow || existing.buynow <= 0) {
      res.status(400).json({ message: 'This item does not have a Buy Now price' });
      return;
    }

    // Atomic close — only succeeds if the item is still open
    const purchased = await Item.findOneAndUpdate(
      {
        _id: itemId,
        sold: false,
        remainingtime: { $gt: 0 },
        buynow: { $gt: 0 },
        owner: { $ne: username }
      },
      {
        $set: {
          sold: true,
          wininguser: username,
          currentbid: existing.buynow,
          remainingtime: 0
        }
      },
      { new: true }
    );

    if (!purchased) {
      res.status(409).json({ message: 'Buy Now failed — auction may have just closed' });
      return;
    }

    // Broadcast the item as closed to all connected clients
    socketService.broadcastBidUpdate(purchased);
    socketService.broadcastRemoveItem(purchased._id as string);

    res.status(200).json({
      message: `Item purchased successfully for ${existing.buynow}`,
      item: purchased
    });
  } catch (error) {
    res.status(500).json({ message: 'Error processing Buy Now', error });
  }
};