import { ORG_ROLES } from '@cml/shared';
import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const invitationSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    role: { type: String, enum: ORG_ROLES, required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    acceptedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type InvitationDocument = InferSchemaType<typeof invitationSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Invitation: Model<InvitationDocument> =
  mongoose.models.Invitation ??
  mongoose.model<InvitationDocument>('Invitation', invitationSchema);
