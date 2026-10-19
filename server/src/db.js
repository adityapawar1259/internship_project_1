import mongoose from "mongoose";
import { config } from "./config.js";
export const connectDb = () => mongoose.connect(config.mongoUri); // databasr url
