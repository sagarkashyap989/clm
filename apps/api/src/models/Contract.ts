import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';
import { CONTRACT_STATUSES, CONTRACT_TYPES } from '@cml/shared';

const contractSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: CONTRACT_TYPES,
      default: 'other',
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: CONTRACT_STATUSES,
      default: 'draft',
      index: true,
    },
    description: {
      type: String,
      default: '',
    },
    counterparty: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
      index: true,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    originalFile: {
      fileName: { type: String },
      mimeType: { type: String },
      size: { type: Number },
      storageKey: { type: String },
      uploadedAt: { type: Date, default: Date.now },
    },
    currentVersionNumber: {
      type: Number,
      default: 1,
    },
    searchableText: {
      type: String,
      default: '',
    },
    draftContent: {
      type: String,
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// Search & multi-field indexes
contractSchema.index({ organizationId: 1, deletedAt: 1, updatedAt: -1 });
contractSchema.index({ organizationId: 1, status: 1, deletedAt: 1 });
contractSchema.index({
  name: 'text',
  counterparty: 'text',
  description: 'text',
  searchableText: 'text',
});

export type ContractDocument = InferSchemaType<typeof contractSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Contract: Model<ContractDocument> =
  mongoose.models.Contract ?? mongoose.model<ContractDocument>('Contract', contractSchema);
