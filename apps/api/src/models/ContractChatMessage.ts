import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const contractChatMessageSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract', required: true, index: true },
    content: { type: String, required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['message', 'system'], default: 'message' },
  },
  { timestamps: true },
);

export type ContractChatMessageDocument = InferSchemaType<typeof contractChatMessageSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ContractChatMessage: Model<ContractChatMessageDocument> =
  mongoose.models.ContractChatMessage ??
  mongoose.model<ContractChatMessageDocument>('ContractChatMessage', contractChatMessageSchema);
