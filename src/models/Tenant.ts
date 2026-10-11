import { Schema, model } from 'mongoose';

const TenantSchema = new Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  createdAt: { type: Date, default: Date.now }
});

export const Tenant = model('Tenant', TenantSchema);
