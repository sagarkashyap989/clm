import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

vi.mock('../utils/email.js', () => ({
  sendVerificationEmail: vi.fn(async () => undefined),
  sendPasswordResetEmail: vi.fn(async () => undefined),
}));

process.env.NODE_ENV = 'test';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/cml-test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-min-32-characters!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-32-characters!';
process.env.COOKIE_SECURE = 'false';

const { createApp } = await import('../app.js');
const { hashPassword } = await import('../utils/tokens.js');
const { User } = await import('../models/User.js');
const { Organization } = await import('../models/Organization.js');
const { Membership } = await import('../models/Membership.js');

describe('auth and RBAC', () => {
  let mongo: MongoMemoryServer;
  const app = createApp();

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  beforeEach(async () => {
    const collections = await mongoose.connection.db!.collections();
    for (const collection of collections) {
      await collection.deleteMany({});
    }
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it('registers, logs in, and returns the current user', async () => {
    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Admin User',
        email: 'admin@acme.test',
        password: 'password123',
        organizationName: 'Acme Corp',
      })
      .expect(201);

    expect(registerRes.body.data.user.email).toBe('admin@acme.test');
    expect(registerRes.body.data.organization.name).toBe('Acme Corp');
    expect(registerRes.headers['set-cookie']).toBeTruthy();

    const agent = request.agent(app);
    await agent
      .post('/api/v1/auth/login')
      .send({ email: 'admin@acme.test', password: 'password123' })
      .expect(200);

    const me = await agent.get('/api/v1/auth/me').expect(200);
    expect(me.body.data.user.email).toBe('admin@acme.test');
    expect(me.body.data.memberships).toHaveLength(1);
  });

  it('hashes passwords and rejects invalid login', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Admin User',
        email: 'admin@acme.test',
        password: 'password123',
        organizationName: 'Acme Corp',
      })
      .expect(201);

    const user = await User.findOne({ email: 'admin@acme.test' });
    expect(user?.passwordHash).toBeTruthy();
    expect(user?.passwordHash).not.toBe('password123');

    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@acme.test', password: 'wrong-password' })
      .expect(401);
  });

  it('refreshes session cookies', async () => {
    const agent = request.agent(app);
    await agent
      .post('/api/v1/auth/register')
      .send({
        name: 'Admin User',
        email: 'admin@acme.test',
        password: 'password123',
        organizationName: 'Acme Corp',
      })
      .expect(201);

    await agent.post('/api/v1/auth/refresh').expect(200);
    const me = await agent.get('/api/v1/auth/me').expect(200);
    expect(me.body.data.user.email).toBe('admin@acme.test');
  });

  it('blocks members from inviting and blocks cross-org access', async () => {
    const adminAgent = request.agent(app);
    const adminReg = await adminAgent
      .post('/api/v1/auth/register')
      .send({
        name: 'Admin User',
        email: 'admin@acme.test',
        password: 'password123',
        organizationName: 'Acme Corp',
      })
      .expect(201);

    const orgId = adminReg.body.data.organization.id as string;

    const memberUser = await User.create({
      email: 'member@acme.test',
      name: 'Member User',
      passwordHash: await hashPassword('password123'),
      emailVerified: true,
    });

    await Membership.create({
      userId: memberUser._id,
      organizationId: orgId,
      role: 'member',
      status: 'active',
    });

    const memberAgent = request.agent(app);
    await memberAgent
      .post('/api/v1/auth/login')
      .send({ email: 'member@acme.test', password: 'password123' })
      .expect(200);

    await memberAgent
      .post(`/api/v1/organizations/${orgId}/members/invite`)
      .send({ email: 'new@acme.test', role: 'member' })
      .expect(403);

    const otherOrg = await Organization.create({
      name: 'Other Org',
      createdBy: memberUser._id,
    });

    await memberAgent.get(`/api/v1/organizations/${otherOrg._id.toString()}`).expect(403);
  });

  it('allows admin to invite members', async () => {
    const adminAgent = request.agent(app);
    const adminReg = await adminAgent
      .post('/api/v1/auth/register')
      .send({
        name: 'Admin User',
        email: 'admin@acme.test',
        password: 'password123',
        organizationName: 'Acme Corp',
      })
      .expect(201);

    const orgId = adminReg.body.data.organization.id as string;

    await request
      .agent(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Invitee User',
        email: 'invitee@acme.test',
        password: 'password123',
        organizationName: 'Invitee Org',
      })
      .expect(201);

    const invite = await adminAgent
      .post(`/api/v1/organizations/${orgId}/members/invite`)
      .send({ email: 'invitee@acme.test', role: 'manager' })
      .expect(201);

    expect(invite.body.data.invitation.email).toBe('invitee@acme.test');
    expect(invite.body.data.invitation.role).toBe('manager');
  });
});
