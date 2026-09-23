import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const commentReplySchema = new Schema(
  {
    content: { type: String, required: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const contractCommentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract', required: true, index: true },
    versionNumber: { type: Number, default: 1 },
    quoteText: { type: String, default: '' },
    content: { type: String, required: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    replies: { type: [commentReplySchema], default: [] },
    isResolved: { type: Boolean, default: false },
    resolvedById: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type ContractCommentDocument = InferSchemaType<typeof contractCommentSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ContractComment: Model<ContractCommentDocument> =
  mongoose.models.ContractComment ??
  mongoose.model<ContractCommentDocument>('ContractComment', contractCommentSchema);
