import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null },
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract', default: null },
    contractName: { type: String, default: '' },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['share', 'comment', 'status', 'version'], required: true },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export type NotificationDocument = InferSchemaType<typeof notificationSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Notification: Model<NotificationDocument> =
  mongoose.models.Notification ??
  mongoose.model<NotificationDocument>('Notification', notificationSchema);
