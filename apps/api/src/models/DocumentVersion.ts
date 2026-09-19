import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';
import { VersionSource } from '@cml/shared';

const documentVersionSchema = new Schema(
  {
    contractId: {
      type: Schema.Types.ObjectId,
      ref: 'Contract',
      required: true,
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    versionNumber: {
      type: Number,
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    source: {
      type: String,
      enum: Object.values(VersionSource),
      default: VersionSource.UPLOAD,
      required: true,
    },
    file: {
      fileName: { type: String },
      mimeType: { type: String },
      size: { type: Number },
      storageKey: { type: String },
    },
    editorContent: {
      type: String,
      default: '',
    },
    changeDescription: {
      type: String,
      default: 'Version created',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

documentVersionSchema.index({ contractId: 1, versionNumber: -1 }, { unique: true });

export type DocumentVersionDocument = InferSchemaType<typeof documentVersionSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const DocumentVersion: Model<DocumentVersionDocument> =
  mongoose.models.DocumentVersion ??
  mongoose.model<DocumentVersionDocument>('DocumentVersion', documentVersionSchema);
