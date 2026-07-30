import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  avatar: string;
  resetPasswordToken?: string;
  resetPasswordExpire?: Date;
}

const UserSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: false, select: false },
    avatar: { type: String, default: "👤" },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpire: { type: Date, select: false },
  },
  { timestamps: true },
);

export default mongoose.model<IUser>("User", UserSchema);
