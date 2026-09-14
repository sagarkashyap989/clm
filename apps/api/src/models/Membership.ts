import { MembershipStatus, ORG_ROLES } from '@cml/shared';
import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const membershipSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    role: { type: String, enum: ORG_ROLES, required: true },
    status: {
      type: String,
      enum: Object.values(MembershipStatus),
      default: MembershipStatus.ACTIVE,
    },
  },
  { timestamps: true },
);

membershipSchema.index({ userId: 1, organizationId: 1 }, { unique: true });

export type MembershipDocument = InferSchemaType<typeof membershipSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Membership: Model<MembershipDocument> =
  mongoose.models.Membership ??
  mongoose.model<MembershipDocument>('Membership', membershipSchema);
