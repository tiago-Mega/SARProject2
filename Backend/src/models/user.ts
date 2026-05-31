import mongoose, { Document, Schema } from 'mongoose';

// User interface defining the document structure
export interface IUser extends Document {
  name: string;
  email: string;
  username: string;
  password: string;
  islogged: boolean;
  latitude: number;
  longitude: number;
}

// User schema definition
const UserSchema = new Schema({
  name: String,
  email: String,
  username: String,
  password: { type: String, select: false },
  islogged: Boolean,
  latitude: Number,
  longitude: Number,
  timestamps: { createdAt: true, updatedAt: true }
});

// Export the model
export default mongoose.model<IUser>('User', UserSchema);