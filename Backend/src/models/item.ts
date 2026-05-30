import mongoose, { Document, Schema } from 'mongoose';

// Item interface defining the document structure
export interface IItem extends Document {
  description: string;
  currentbid: number;
  remainingtime: number;
  buynow: number;
  wininguser: string;
  sold: boolean;
  owner: string;
  endsAt: Date;
}

// Item schema definition
const ItemSchema = new Schema({
  description: { type: String, required: true, trim: true },
  currentbid: { type: Number, required: true, min: 0 },
  remainingtime: { type: Number, required: true, min: 0 },
  buynow: { type: Number, default: 0, min: 0 },
  wininguser: { type: String, default: '' },
  sold: { type: Boolean, default: false },
  owner: { type: String, required: true },
  endsAt: { type: Date, required: true, index: true }
  },
  { timestamps: true }
);

// Add index for better query performance
ItemSchema.index({ sold: 1, endsAt: 1 });

// Export the model
export default mongoose.model<IItem>('Item', ItemSchema);
