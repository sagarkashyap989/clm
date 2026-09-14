import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const organizationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    settings: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

export type OrganizationDocument = InferSchemaType<typeof organizationSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Organization: Model<OrganizationDocument> =
  mongoose.models.Organization ??
  mongoose.model<OrganizationDocument>('Organization', organizationSchema);
