import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

function mockApiPlugin(): Plugin {
  let currentUser: { id: string; email: string; name: string; emailVerified: boolean } | null = {
    id: 'usr_demo',
    email: 'admin@example.com',
    name: 'Administrator',
    emailVerified: true,
  };
  let currentOrg = {
    id: 'org_demo',
    name: 'Acme Contracts Corp',
  };
  let currentRole = 'admin';
  let membersList = [
    {
      id: 'mem_1',
      role: 'admin',
      user: { id: 'usr_demo', name: 'Administrator', email: 'admin@example.com' },
    },
    {
      id: 'mem_2',
      role: 'manager',
      user: { id: 'usr_2', name: 'Sarah Connor', email: 'sarah@example.com' },
    },
    {
      id: 'mem_3',
      role: 'member',
      user: { id: 'usr_3', name: 'John Doe', email: 'john@example.com' },
    },
  ];

  let contractsList: any[] = [
    {
      id: 'ctr_1',
      name: 'Artist Licensing Agreement',
      type: 'licensing',
      status: 'in_review',
      counterparty: 'Gilded Records Inc.',
      description: 'Master licensing terms for international distribution across streaming and physical media.',
      startDate: '2026-01-09T00:00:00.000Z',
      endDate: '2027-01-09T00:00:00.000Z',
      tags: ['Artist', 'Licensing', 'Music'],
      originalFile: {
        fileName: 'artist_licensing_agreement_v1.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 148520,
        uploadedAt: '2026-01-09T14:20:00.000Z',
      },
      currentVersionNumber: 2,
      owner: { id: 'usr_2', name: 'Sarah Connor', email: 'sarah@example.com' },
      createdBy: { id: 'usr_2', name: 'Sarah Connor', email: 'sarah@example.com' },
      createdAt: '2026-01-09T14:20:00.000Z',
      updatedAt: '2026-03-10T11:45:00.000Z',
    },
    {
      id: 'ctr_2',
      name: 'Global Vendor Services Agreement',
      type: 'vendor',
      status: 'draft',
      counterparty: 'Apex Logistics LLC',
      description: 'Standard SLA and logistics freight forwarding agreement for European fulfillment centers.',
      startDate: '2026-03-01T00:00:00.000Z',
      endDate: '2027-02-28T00:00:00.000Z',
      tags: ['Vendor', 'Logistics', 'SLA'],
      originalFile: {
        fileName: 'apex_freight_agreement.pdf',
        mimeType: 'application/pdf',
        size: 512400,
        uploadedAt: '2026-03-01T09:15:00.000Z',
      },
      currentVersionNumber: 1,
      owner: { id: 'usr_demo', name: 'Administrator', email: 'admin@example.com' },
      createdBy: { id: 'usr_demo', name: 'Administrator', email: 'admin@example.com' },
      createdAt: '2026-03-01T09:15:00.000Z',
      updatedAt: '2026-03-12T16:30:00.000Z',
    },
    {
      id: 'ctr_3',
      name: 'Mutual Non-Disclosure Agreement',
      type: 'nda',
      status: 'approved',
      counterparty: 'Starlight Ventures',
      description: 'Bilateral confidentiality agreement covering joint technological exploration and due diligence.',
      startDate: '2026-02-15T00:00:00.000Z',
      endDate: '2028-02-15T00:00:00.000Z',
      tags: ['NDA', 'Confidential', 'Due Diligence'],
      originalFile: {
        fileName: 'starlight_mnda_countersigned.pdf',
        mimeType: 'application/pdf',
        size: 328100,
        uploadedAt: '2026-02-15T10:00:00.000Z',
      },
      currentVersionNumber: 1,
      owner: { id: 'usr_3', name: 'John Doe', email: 'john@example.com' },
      createdBy: { id: 'usr_3', name: 'John Doe', email: 'john@example.com' },
      createdAt: '2026-02-15T10:00:00.000Z',
      updatedAt: '2026-02-16T18:00:00.000Z',
    },
    {
      id: 'ctr_4',
      name: 'Senior Systems Architect Employment Contract',
      type: 'employment',
      status: 'completed',
      counterparty: 'Alex Rivera',
      description: 'Standard employment contract with IP assignment, non-compete, and compensation schedule.',
      startDate: '2026-01-15T00:00:00.000Z',
      endDate: '2029-01-15T00:00:00.000Z',
      tags: ['HR', 'Employment', 'Engineering'],
      originalFile: {
        fileName: 'alex_rivera_offer_signed.pdf',
        mimeType: 'application/pdf',
        size: 420800,
        uploadedAt: '2026-01-15T11:00:00.000Z',
      },
      currentVersionNumber: 1,
      owner: { id: 'usr_demo', name: 'Administrator', email: 'admin@example.com' },
      createdBy: { id: 'usr_demo', name: 'Administrator', email: 'admin@example.com' },
      createdAt: '2026-01-15T11:00:00.000Z',
      updatedAt: '2026-01-15T17:30:00.000Z',
    },
    {
      id: 'ctr_5',
      name: 'Commercial Office Space Lease Agreement',
      type: 'lease',
      status: 'changes_requested',
      counterparty: 'Beacon Tower Properties',
      description: 'Floor 14 commercial lease with clauses on tenant improvement allowance and parking spots.',
      startDate: '2026-04-01T00:00:00.000Z',
      endDate: '2031-03-31T00:00:00.000Z',
      tags: ['Real Estate', 'Facilities', 'HQ'],
      originalFile: {
        fileName: 'beacon_tower_lease_redlines.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 780200,
        uploadedAt: '2026-03-05T08:30:00.000Z',
      },
      currentVersionNumber: 1,
      owner: { id: 'usr_2', name: 'Sarah Connor', email: 'sarah@example.com' },
      createdBy: { id: 'usr_2', name: 'Sarah Connor', email: 'sarah@example.com' },
      createdAt: '2026-03-05T08:30:00.000Z',
      updatedAt: '2026-03-14T15:20:00.000Z',
    },
    {
      id: 'ctr_6',
      name: 'Enterprise Cloud Infrastructure Partnership',
      type: 'partnership',
      status: 'pending_signature',
      counterparty: 'Nebula Systems Inc.',
      description: 'Strategic co-selling and multi-region cloud deployment framework agreement.',
      startDate: '2026-05-01T00:00:00.000Z',
      endDate: '2027-05-01T00:00:00.000Z',
      tags: ['Enterprise', 'Cloud', 'Strategic'],
      originalFile: {
        fileName: 'nebula_cloud_partnership.pdf',
        mimeType: 'application/pdf',
        size: 614000,
        uploadedAt: '2026-03-08T13:40:00.000Z',
      },
      currentVersionNumber: 1,
      owner: { id: 'usr_demo', name: 'Administrator', email: 'admin@example.com' },
      createdBy: { id: 'usr_demo', name: 'Administrator', email: 'admin@example.com' },
      createdAt: '2026-03-08T13:40:00.000Z',
      updatedAt: '2026-03-15T19:10:00.000Z',
    },
  ];

  let contractDrafts: Record<string, string> = {};

  let contractVersions: Record<string, any[]> = {
    ctr_1: [
      {
        id: 'ver_1_2',
        contractId: 'ctr_1',
        versionNumber: 2,
        createdBy: { id: 'usr_2', name: 'Sarah Connor', email: 'sarah@example.com' },
        source: 'editor',
        file: null,
        changeDescription: 'Amended royalty rate to 70% and introduced 1-year renewal option',
        createdAt: '2026-03-10T11:45:00.000Z',
        editorContent: `<h2>ARTIST EXCLUSIVE LICENSING AGREEMENT</h2>
<p>This Artist Exclusive Licensing Agreement (the "Agreement") is made and entered into as of January 9, 2026, by and between <strong>Gilded Records Inc.</strong>, a Delaware corporation ("Licensor"), and <strong>Acme Contracts Corp</strong> ("Licensee").</p>

<h3>1. GRANT OF LICENSE</h3>
<p>Licensor hereby grants to Licensee an exclusive, worldwide, royalty-bearing license to distribute, perform, stream, and synchronize the Master Recordings and underlying Musical Compositions described in Schedule A hereto, including all future remastered digital audio editions.</p>

<h3>2. TERM AND TERRITORY</h3>
<p>The Term of this Agreement commences on the Effective Date and shall continue for an initial period of twelve (12) months, through and including January 9, 2027, with an option for mutual renewal for one (1) additional consecutive year. The Territory shall encompass the entire World, specifically prioritizing North American and European streaming platforms.</p>

<h3>3. ROYALTIES AND ACCOUNTING</h3>
<p>Licensee shall pay to Licensor an enhanced royalty fee equivalent to seventy percent (70%) of Net Digital Revenue. Accounting statements and payments shall be rendered on a calendar quarterly basis within thirty (30) days following the close of each quarter.</p>

<h3>4. REPRESENTATIONS AND WARRANTIES</h3>
<p>Licensor represents, warrants, and covenants that it has full authority to enter into this Agreement, that the Masters do not infringe upon any third-party intellectual property rights, and that all third-party clearances and union obligations have been satisfied.</p>

<h3>5. INDEMNIFICATION AND LIABILITY</h3>
<p>Each party agrees to indemnify, defend, and hold harmless the other party against any claims, losses, or damages arising out of a breach of any representation or warranty made herein. Aggregate liability shall be capped at a maximum of Five Hundred Thousand United States Dollars ($500,000).</p>`,
      },
      {
        id: 'ver_1_1',
        contractId: 'ctr_1',
        versionNumber: 1,
        createdBy: { id: 'usr_2', name: 'Sarah Connor', email: 'sarah@example.com' },
        source: 'upload',
        file: {
          fileName: 'artist_licensing_agreement_v1.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          size: 148520,
        },
        changeDescription: 'Initial uploaded version from DOCX file',
        createdAt: '2026-01-09T14:20:00.000Z',
        editorContent: `<h2>ARTIST EXCLUSIVE LICENSING AGREEMENT</h2>
<p>This Artist Exclusive Licensing Agreement (the "Agreement") is made and entered into as of January 9, 2026, by and between <strong>Gilded Records Inc.</strong>, a Delaware corporation ("Licensor"), and <strong>Acme Contracts Corp</strong> ("Licensee").</p>

<h3>1. GRANT OF LICENSE</h3>
<p>Licensor hereby grants to Licensee an exclusive, worldwide, royalty-bearing license to distribute, perform, stream, and synchronize the Master Recordings and underlying Musical Compositions described in Schedule A hereto.</p>

<h3>2. TERM AND TERRITORY</h3>
<p>The Term of this Agreement commences on the Effective Date and shall continue for a period of twelve (12) months, through and including January 9, 2027. The Territory shall encompass the entire World and all digital transmission networks.</p>

<h3>3. ROYALTIES AND ACCOUNTING</h3>
<p>Licensee shall pay to Licensor a royalty fee equivalent to sixty-five percent (65%) of Net Digital Revenue. Accounting statements and payments shall be rendered on a calendar quarterly basis within forty-five (45) days following the close of each quarter.</p>

<h3>4. REPRESENTATIONS AND WARRANTIES</h3>
<p>Licensor represents, warrants, and covenants that it has full authority to enter into this Agreement, that the Masters do not infringe upon any third-party intellectual property rights, and that all third-party clearances and union obligations have been satisfied.</p>

<h3>5. INDEMNIFICATION AND LIABILITY</h3>
<p>Each party agrees to indemnify, defend, and hold harmless the other party against any claims, losses, or damages arising out of a breach of any representation or warranty made herein. Aggregate liability shall not exceed the total fees paid under this Agreement in the preceding twelve-month period.</p>`,
      },
    ],
    ctr_2: [
      {
        id: 'ver_2_1',
        contractId: 'ctr_2',
        versionNumber: 1,
        createdBy: { id: 'usr_demo', name: 'Administrator', email: 'admin@example.com' },
        source: 'upload',
        file: {
          fileName: 'apex_freight_agreement.pdf',
          mimeType: 'application/pdf',
          size: 512400,
        },
        changeDescription: 'Initial uploaded PDF agreement',
        createdAt: '2026-03-01T09:15:00.000Z',
        editorContent: `<h2>GLOBAL VENDOR SERVICES AGREEMENT</h2>
<p>This Agreement is entered into by <strong>Apex Logistics LLC</strong> ("Vendor") and <strong>Acme Contracts Corp</strong> ("Company") effective March 1, 2026.</p>
<h3>1. SCOPE OF SERVICES</h3>
<p>Vendor shall provide freight management, customs brokerage, and logistics fulfillment across all Western European distribution hubs.</p>
<h3>2. SERVICE LEVEL AGREEMENT (SLA)</h3>
<p>Vendor guarantees a ninety-nine point five percent (99.5%) on-time delivery metric for all express shipments. Failure to maintain this threshold over any consecutive sixty (60) day period constitutes grounds for immediate termination without penalty.</p>
<h3>3. PRICING AND PAYMENT TERMS</h3>
<p>All freight service fees are billed monthly in arrears with Net 30 payment terms following invoice receipt.</p>`,
      },
    ],
    ctr_3: [
      {
        id: 'ver_3_1',
        contractId: 'ctr_3',
        versionNumber: 1,
        createdBy: { id: 'usr_3', name: 'John Doe', email: 'john@example.com' },
        source: 'upload',
        file: {
          fileName: 'starlight_mnda_countersigned.pdf',
          mimeType: 'application/pdf',
          size: 328100,
        },
        changeDescription: 'Executed mutual confidentiality agreement',
        createdAt: '2026-02-15T10:00:00.000Z',
        editorContent: `<h2>MUTUAL NON-DISCLOSURE AGREEMENT</h2>
<p>This Mutual Non-Disclosure Agreement ("Agreement") is made effective February 15, 2026, between <strong>Starlight Ventures</strong> and <strong>Acme Contracts Corp</strong>.</p>
<h3>1. CONFIDENTIAL INFORMATION</h3>
<p>"Confidential Information" means all proprietary technical, business, financial, operational, customer, or code information disclosed by one party to the other.</p>
<h3>2. NON-DISCLOSURE OBLIGATIONS</h3>
<p>Each party agrees to hold the other party's Confidential Information in strict confidence, exercising at least the same standard of care used for its own sensitive information, but in no event less than reasonable care.</p>
<h3>3. TERM</h3>
<p>The obligations of confidentiality under this Agreement shall survive for a period of three (3) years from the date of disclosure.</p>`,
      },
    ],
  };

  let contractShares: Record<string, any[]> = {
    ctr_1: [
      {
        id: 'shr_1_1',
        contractId: 'ctr_1',
        type: 'internal',
        permission: 'editor',
        sharedWithUser: { id: 'usr_2', name: 'Sarah Connor', email: 'sarah@example.com' },
        expiresAt: null,
        createdAt: '2026-03-01T10:00:00.000Z',
        createdBy: { id: 'usr_demo', name: 'Administrator', email: 'admin@example.com' },
      },
      {
        id: 'shr_1_2',
        contractId: 'ctr_1',
        type: 'internal',
        permission: 'reviewer',
        sharedWithUser: { id: 'usr_3', name: 'John Doe', email: 'john@example.com' },
        expiresAt: null,
        createdAt: '2026-03-02T14:30:00.000Z',
        createdBy: { id: 'usr_demo', name: 'Administrator', email: 'admin@example.com' },
      },
      {
        id: 'shr_1_3',
        contractId: 'ctr_1',
        type: 'external_link',
        permission: 'viewer',
        shareToken: 'tok_live_gilded_records_review',
        shareUrl: 'https://clm.acme.corp/preview/share/tok_live_gilded_records_review',
        expiresAt: '2026-04-01T00:00:00.000Z',
        createdAt: '2026-03-05T09:00:00.000Z',
        createdBy: { id: 'usr_demo', name: 'Administrator', email: 'admin@example.com' },
      },
    ],
    ctr_5: [
      {
        id: 'shr_5_1',
        contractId: 'ctr_5',
        type: 'internal',
        permission: 'editor',
        sharedWithUser: { id: 'usr_demo', name: 'Administrator', email: 'admin@example.com' },
        expiresAt: null,
        createdAt: '2026-03-06T11:00:00.000Z',
        createdBy: { id: 'usr_2', name: 'Sarah Connor', email: 'sarah@example.com' },
      },
    ],
  };

  let contractComments: Record<string, any[]> = {
    ctr_1: [
      {
        id: 'cmt_1_1',
        contractId: 'ctr_1',
        versionNumber: 2,
        quoteText: 'Licensee shall pay to Licensor an enhanced royalty fee equivalent to seventy percent (70%) of Net Digital Revenue.',
        content: 'Finance has verified that this 70% distribution rate aligns with the executive term sheet signed in Q4.',
        author: { id: 'usr_2', name: 'Sarah Connor', email: 'sarah@example.com' },
        isResolved: true,
        resolvedBy: { id: 'usr_demo', name: 'Administrator' },
        resolvedAt: '2026-03-11T09:30:00.000Z',
        createdAt: '2026-03-10T12:00:00.000Z',
        replies: [
          {
            id: 'rep_1_1',
            content: 'Confirmed. Approved from our end.',
            author: { id: 'usr_demo', name: 'Administrator', email: 'admin@example.com' },
            createdAt: '2026-03-10T14:15:00.000Z',
          },
        ],
      },
      {
        id: 'cmt_1_2',
        contractId: 'ctr_1',
        versionNumber: 2,
        quoteText: 'Aggregate liability shall be capped at a maximum of Five Hundred Thousand United States Dollars ($500,000).',
        content: 'Please verify whether the $500k liability cap should exclude willful misconduct and gross negligence.',
        author: { id: 'usr_3', name: 'John Doe', email: 'john@example.com' },
        isResolved: false,
        resolvedBy: null,
        resolvedAt: null,
        createdAt: '2026-03-12T16:00:00.000Z',
        replies: [],
      },
    ],
  };

  let contractChats: Record<string, any[]> = {
    ctr_1: [
      {
        id: 'msg_1_1',
        contractId: 'ctr_1',
        content: 'Hello team, I published Version 2.0 with the revised North American exclusivity clause.',
        sender: { id: 'usr_2', name: 'Sarah Connor', email: 'sarah@example.com' },
        type: 'message',
        createdAt: '2026-03-10T11:50:00.000Z',
      },
      {
        id: 'msg_1_2',
        contractId: 'ctr_1',
        content: 'Status changed to In Review',
        sender: { id: 'usr_2', name: 'Sarah Connor', email: 'sarah@example.com' },
        type: 'system',
        createdAt: '2026-03-10T11:52:00.000Z',
      },
      {
        id: 'msg_1_3',
        contractId: 'ctr_1',
        content: 'Reviewed Section 3. The quarterly payout schedule within 30 days is acceptable.',
        sender: { id: 'usr_demo', name: 'Administrator', email: 'admin@example.com' },
        type: 'message',
        createdAt: '2026-03-11T10:15:00.000Z',
      },
    ],
  };

  let notificationsList: any[] = [
    {
      id: 'notif_1',
      userId: 'usr_demo',
      contractId: 'ctr_1',
      contractName: 'Artist Licensing Agreement',
      title: 'Comment Mention',
      message: 'John Doe added a question regarding the liability clause on Artist Licensing Agreement.',
      type: 'comment',
      isRead: false,
      createdAt: '2026-03-12T16:00:00.000Z',
    },
    {
      id: 'notif_2',
      userId: 'usr_demo',
      contractId: 'ctr_1',
      contractName: 'Artist Licensing Agreement',
      title: 'New Version Committed',
      message: 'Sarah Connor saved Version 2.0: Amended royalty rate to 70%.',
      type: 'version',
      isRead: false,
      createdAt: '2026-03-10T11:45:00.000Z',
    },
    {
      id: 'notif_3',
      userId: 'usr_demo',
      contractId: 'ctr_5',
      contractName: 'Commercial Office Space Lease Agreement',
      title: 'Contract Shared With You',
      message: 'Sarah Connor shared Commercial Office Space Lease Agreement with Editor permissions.',
      type: 'share',
      isRead: true,
      createdAt: '2026-03-06T11:00:00.000Z',
    },
    {
      id: 'notif_4',
      userId: 'usr_demo',
      contractId: 'ctr_6',
      contractName: 'Enterprise Cloud Infrastructure Partnership',
      title: 'Contract Status Updated',
      message: 'Enterprise Cloud Infrastructure Partnership transitioned to Pending Signature.',
      type: 'status',
      isRead: true,
      createdAt: '2026-03-08T13:40:00.000Z',
    },
  ];

  return {
    name: 'mock-api-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

        res.setHeader('Content-Type', 'application/json');

        const readBody = (callback: (body: any) => void) => {
          let data = '';
          req.on('data', (chunk) => {
            data += chunk;
          });
          req.on('end', () => {
            try {
              callback(data ? JSON.parse(data) : {});
            } catch {
              callback({});
            }
          });
        };

        const url = req.url.split('?')[0];

        if (url === '/api/v1/auth/me' && req.method === 'GET') {
          if (!currentUser) {
            res.statusCode = 401;
            return res.end(
              JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }),
            );
          }
          return res.end(
            JSON.stringify({
              data: {
                user: currentUser,
                memberships: [
                  {
                    id: 'mem_1',
                    role: currentRole,
                    organization: currentOrg,
                  },
                ],
              },
            }),
          );
        }

        if (url === '/api/v1/auth/login' && req.method === 'POST') {
          readBody((body) => {
            currentUser = {
              id: 'usr_' + Date.now(),
              email: body.email || 'user@example.com',
              name: (body.email ? body.email.split('@')[0] : 'User').replace(/[^a-zA-Z0-9]/g, ' '),
              emailVerified: true,
            };
            return res.end(
              JSON.stringify({
                data: {
                  user: currentUser,
                  organization: currentOrg,
                  role: currentRole,
                },
              }),
            );
          });
          return;
        }

        if (url === '/api/v1/auth/register' && req.method === 'POST') {
          readBody((body) => {
            currentUser = {
              id: 'usr_' + Date.now(),
              email: body.email || 'user@example.com',
              name: body.name || 'User',
              emailVerified: true,
            };
            currentOrg = {
              id: 'org_' + Date.now(),
              name: body.organizationName || 'My Organization',
            };
            currentRole = 'admin';
            membersList = [
              {
                id: 'mem_owner',
                role: 'admin',
                user: currentUser,
              },
            ];
            return res.end(
              JSON.stringify({
                data: {
                  user: currentUser,
                  organization: currentOrg,
                  role: currentRole,
                },
              }),
            );
          });
          return;
        }

        if (url === '/api/v1/auth/logout' && req.method === 'POST') {
          currentUser = null;
          res.statusCode = 204;
          return res.end();
        }

        if (url === '/api/v1/auth/profile' && req.method === 'PATCH') {
          readBody((body) => {
            if (currentUser) {
              currentUser.name = body.name || currentUser.name;
            }
            return res.end(JSON.stringify({ data: { user: currentUser } }));
          });
          return;
        }

        if (url === '/api/v1/auth/change-password' && req.method === 'POST') {
          return res.end(JSON.stringify({ data: { message: 'Password updated' } }));
        }

        if (url.includes('/members/invite') && req.method === 'POST') {
          readBody((body) => {
            const newMem = {
              id: 'mem_' + Date.now(),
              role: body.role || 'member',
              user: {
                id: 'usr_' + Date.now(),
                name: (body.email || 'invitee').split('@')[0],
                email: body.email,
              },
            };
            membersList.push(newMem);
            return res.end(JSON.stringify({ data: { message: 'Invitation sent', member: newMem } }));
          });
          return;
        }

        if (url.includes('/members/') && req.method === 'PATCH') {
          readBody((body) => {
            const memberId = url.split('/members/')[1];
            const mem = membersList.find((m) => m.id === memberId);
            if (mem) {
              mem.role = body.role || mem.role;
            }
            return res.end(JSON.stringify({ data: { message: 'Role updated' } }));
          });
          return;
        }

        if (url.includes('/members/') && req.method === 'DELETE') {
          const memberId = url.split('/members/')[1];
          membersList = membersList.filter((m) => m.id !== memberId);
          return res.end(JSON.stringify({ data: { message: 'Member removed' } }));
        }

        if (url.endsWith('/members') && req.method === 'GET') {
          return res.end(JSON.stringify({ data: { members: membersList } }));
        }

        if (url.includes('/organizations/') && req.method === 'PATCH') {
          readBody((body) => {
            if (body.name) {
              currentOrg.name = body.name;
            }
            return res.end(JSON.stringify({ data: { organization: currentOrg } }));
          });
          return;
        }

        if (url === '/api/v1/contracts/dashboard-summary' && req.method === 'GET') {
          const pendingReview = contractsList.filter((c) =>
            ['in_review', 'changes_requested', 'pending_signature'].includes(c.status),
          ).length;
          return res.end(
            JSON.stringify({
              data: {
                metrics: {
                  totalContracts: contractsList.length,
                  pendingReview,
                  recentlyUpdated: Math.min(contractsList.length, 4),
                  sharedWithMe: 1,
                },
                recentContracts: contractsList.slice(0, 5),
                pendingContracts: contractsList
                  .filter((c) =>
                    ['in_review', 'changes_requested', 'pending_signature'].includes(c.status),
                  )
                  .slice(0, 5),
              },
            }),
          );
        }

        // Versions List (GET /api/v1/contracts/:id/versions)
        if (url.includes('/versions') && !url.includes('/restore') && req.method === 'GET') {
          const parts = url.split('/api/v1/contracts/')[1].split('/versions');
          const contractId = parts[0];
          const versionId = parts[1]?.replace('/', '');

          const versions = contractVersions[contractId] || [];
          if (versionId) {
            const version = versions.find((v) => v.id === versionId);
            if (!version) {
              res.statusCode = 404;
              return res.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Version not found' } }));
            }
            return res.end(JSON.stringify({ data: { version } }));
          }
          return res.end(JSON.stringify({ data: { versions } }));
        }

        // Create new Version (POST /api/v1/contracts/:id/versions)
        if (url.endsWith('/versions') && req.method === 'POST') {
          const contractId = url.split('/api/v1/contracts/')[1].split('/versions')[0];
          readBody((body) => {
            const contract = contractsList.find((c) => c.id === contractId);
            if (!contract) {
              res.statusCode = 404;
              return res.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Contract not found' } }));
            }
            const currentList = contractVersions[contractId] || [];
            const nextNum = (contract.currentVersionNumber || 1) + 1;
            const newVersion = {
              id: `ver_${contractId}_${nextNum}`,
              contractId,
              versionNumber: nextNum,
              createdBy: currentUser,
              source: 'editor',
              file: null,
              editorContent: body.editorContent || '',
              changeDescription: body.changeDescription || `Version ${nextNum}`,
              createdAt: new Date().toISOString(),
            };
            currentList.unshift(newVersion);
            contractVersions[contractId] = currentList;
            contract.currentVersionNumber = nextNum;
            contract.updatedAt = new Date().toISOString();
            // Clear temporary draft since version was officially saved
            delete contractDrafts[contractId];

            res.statusCode = 201;
            return res.end(JSON.stringify({ data: { version: newVersion } }));
          });
          return;
        }

        // Restore version (POST /api/v1/contracts/:id/versions/:versionId/restore)
        if (url.includes('/restore') && req.method === 'POST') {
          const parts = url.split('/api/v1/contracts/')[1].split('/versions/');
          const contractId = parts[0];
          const versionId = parts[1].split('/restore')[0];

          readBody((body) => {
            const contract = contractsList.find((c) => c.id === contractId);
            const currentList = contractVersions[contractId] || [];
            const targetVersion = currentList.find((v) => v.id === versionId);

            if (!contract || !targetVersion) {
              res.statusCode = 404;
              return res.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Version not found' } }));
            }

            const nextNum = (contract.currentVersionNumber || 1) + 1;
            const restoredVersion = {
              id: `ver_${contractId}_${nextNum}`,
              contractId,
              versionNumber: nextNum,
              createdBy: currentUser,
              source: 'restore',
              file: targetVersion.file || null,
              editorContent: targetVersion.editorContent,
              changeDescription: body.changeDescription || `Restored from Version ${targetVersion.versionNumber}`,
              createdAt: new Date().toISOString(),
            };
            currentList.unshift(restoredVersion);
            contractVersions[contractId] = currentList;
            contract.currentVersionNumber = nextNum;
            contract.updatedAt = new Date().toISOString();
            delete contractDrafts[contractId];

            res.statusCode = 201;
            return res.end(JSON.stringify({ data: { version: restoredVersion } }));
          });
          return;
        }

        // Notifications API
        if (url === '/api/v1/notifications' && req.method === 'GET') {
          return res.end(JSON.stringify({ data: { notifications: notificationsList } }));
        }

        if (url === '/api/v1/notifications/mark-all-read' && req.method === 'POST') {
          notificationsList = notificationsList.map((n) => ({ ...n, isRead: true }));
          return res.end(JSON.stringify({ data: { ok: true } }));
        }

        if (url.startsWith('/api/v1/notifications/') && url.endsWith('/read') && req.method === 'PATCH') {
          const notifId = url.split('/api/v1/notifications/')[1].split('/read')[0];
          const target = notificationsList.find((n) => n.id === notifId);
          if (target) target.isRead = true;
          return res.end(JSON.stringify({ data: { ok: true } }));
        }

        // Shared With Me API (GET /api/v1/contracts/shared-with-me)
        if (url === '/api/v1/contracts/shared-with-me' && req.method === 'GET') {
          const sharedContractIds = Object.entries(contractShares)
            .filter(([_, shares]) =>
              shares.some((s) => s.sharedWithUser?.id === currentUser.id || s.sharedWithUser?.email === currentUser.email),
            )
            .map(([cId]) => cId);

          const sharedContracts = contractsList
            .filter((c) => sharedContractIds.includes(c.id))
            .map((c) => {
              const myShare = contractShares[c.id]?.find(
                (s) => s.sharedWithUser?.id === currentUser.id || s.sharedWithUser?.email === currentUser.email,
              );
              return {
                ...c,
                myPermission: myShare?.permission || 'viewer',
                sharedAt: myShare?.createdAt || c.updatedAt,
              };
            });

          return res.end(JSON.stringify({ data: { contracts: sharedContracts } }));
        }

        // Shares API
        if (url.includes('/shares') && req.method === 'GET') {
          const contractId = url.split('/api/v1/contracts/')[1].split('/shares')[0];
          const shares = contractShares[contractId] || [];
          return res.end(JSON.stringify({ data: { shares } }));
        }

        if (url.includes('/shares') && req.method === 'POST') {
          const contractId = url.split('/api/v1/contracts/')[1].split('/shares')[0];
          readBody((body) => {
            if (!contractShares[contractId]) contractShares[contractId] = [];

            const isExternal = body.type === 'external_link';
            const expiresAt = body.expiresInDays
              ? new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
              : null;

            const token = isExternal ? 'tok_' + Math.random().toString(36).substring(2, 12) : undefined;
            const shareUrl = isExternal ? `https://clm.acme.corp/preview/share/${token}` : undefined;

            let sharedUser = null;
            if (!isExternal) {
              if (body.userId === 'usr_2' || body.userEmail?.includes('sarah')) {
                sharedUser = { id: 'usr_2', name: 'Sarah Connor', email: 'sarah@example.com' };
              } else if (body.userId === 'usr_3' || body.userEmail?.includes('john')) {
                sharedUser = { id: 'usr_3', name: 'John Doe', email: 'john@example.com' };
              } else {
                sharedUser = {
                  id: body.userId || 'usr_' + Date.now(),
                  name: body.userEmail ? body.userEmail.split('@')[0] : 'Invited Collaborator',
                  email: body.userEmail || 'collaborator@example.com',
                };
              }
            }

            const newShare = {
              id: 'shr_' + Date.now(),
              contractId,
              type: body.type || 'internal',
              permission: body.permission || 'reviewer',
              sharedWithUser: sharedUser,
              shareToken: token,
              shareUrl,
              expiresAt,
              createdAt: new Date().toISOString(),
              createdBy: currentUser,
            };

            contractShares[contractId].push(newShare);

            // Add notification
            const contract = contractsList.find((c) => c.id === contractId);
            notificationsList.unshift({
              id: 'notif_' + Date.now(),
              userId: sharedUser?.id || currentUser.id,
              contractId,
              contractName: contract?.name || 'Contract',
              title: 'Contract Access Granted',
              message: `You granted ${newShare.permission.toUpperCase()} permission on ${contract?.name || 'Contract'}.`,
              type: 'share',
              isRead: false,
              createdAt: new Date().toISOString(),
            });

            res.statusCode = 201;
            return res.end(JSON.stringify({ data: { share: newShare } }));
          });
          return;
        }

        if (url.includes('/shares/') && req.method === 'DELETE') {
          const parts = url.split('/api/v1/contracts/')[1].split('/shares/');
          const contractId = parts[0];
          const shareId = parts[1].split('?')[0];

          if (contractShares[contractId]) {
            contractShares[contractId] = contractShares[contractId].filter((s) => s.id !== shareId);
          }
          return res.end(JSON.stringify({ data: { ok: true } }));
        }

        // Comments API
        if (url.includes('/comments') && req.method === 'GET') {
          const contractId = url.split('/api/v1/contracts/')[1].split('/comments')[0];
          const comments = contractComments[contractId] || [];
          return res.end(JSON.stringify({ data: { comments } }));
        }

        if (url.includes('/comments/') && url.endsWith('/reply') && req.method === 'POST') {
          const parts = url.split('/api/v1/contracts/')[1].split('/comments/');
          const contractId = parts[0];
          const commentId = parts[1].split('/reply')[0];

          readBody((body) => {
            const contractComms = contractComments[contractId] || [];
            const comment = contractComms.find((c) => c.id === commentId);
            if (!comment) {
              res.statusCode = 404;
              return res.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Comment not found' } }));
            }

            const newReply = {
              id: 'rep_' + Date.now(),
              content: body.content || '',
              author: currentUser,
              createdAt: new Date().toISOString(),
            };

            if (!comment.replies) comment.replies = [];
            comment.replies.push(newReply);

            res.statusCode = 201;
            return res.end(JSON.stringify({ data: { reply: newReply } }));
          });
          return;
        }

        if (url.includes('/comments/') && url.endsWith('/resolve') && req.method === 'PATCH') {
          const parts = url.split('/api/v1/contracts/')[1].split('/comments/');
          const contractId = parts[0];
          const commentId = parts[1].split('/resolve')[0];

          const contractComms = contractComments[contractId] || [];
          const comment = contractComms.find((c) => c.id === commentId);
          if (!comment) {
            res.statusCode = 404;
            return res.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Comment not found' } }));
          }

          comment.isResolved = !comment.isResolved;
          comment.resolvedBy = comment.isResolved ? currentUser : null;
          comment.resolvedAt = comment.isResolved ? new Date().toISOString() : null;

          return res.end(JSON.stringify({ data: { comment } }));
        }

        if (url.includes('/comments/') && req.method === 'DELETE') {
          const parts = url.split('/api/v1/contracts/')[1].split('/comments/');
          const contractId = parts[0];
          const commentId = parts[1].split('?')[0];

          if (contractComments[contractId]) {
            contractComments[contractId] = contractComments[contractId].filter((c) => c.id !== commentId);
          }
          return res.end(JSON.stringify({ data: { ok: true } }));
        }

        if (url.includes('/comments') && req.method === 'POST') {
          const contractId = url.split('/api/v1/contracts/')[1].split('/comments')[0];
          readBody((body) => {
            if (!contractComments[contractId]) contractComments[contractId] = [];

            const newComment = {
              id: 'cmt_' + Date.now(),
              contractId,
              versionNumber: body.versionNumber || 1,
              quoteText: body.quoteText || undefined,
              content: body.content || '',
              author: currentUser,
              replies: [],
              isResolved: false,
              resolvedBy: null,
              resolvedAt: null,
              createdAt: new Date().toISOString(),
            };

            contractComments[contractId].unshift(newComment);

            // Add notification
            const contract = contractsList.find((c) => c.id === contractId);
            notificationsList.unshift({
              id: 'notif_' + Date.now(),
              userId: currentUser.id,
              contractId,
              contractName: contract?.name || 'Contract',
              title: 'New Comment Posted',
              message: `${currentUser.name} commented: "${newComment.content.slice(0, 45)}..."`,
              type: 'comment',
              isRead: false,
              createdAt: new Date().toISOString(),
            });

            res.statusCode = 201;
            return res.end(JSON.stringify({ data: { comment: newComment } }));
          });
          return;
        }

        // Chat API (GET /api/v1/contracts/:id/chat & POST /api/v1/contracts/:id/chat)
        if (url.includes('/chat') && req.method === 'GET') {
          const contractId = url.split('/api/v1/contracts/')[1].split('/chat')[0];
          const messages = contractChats[contractId] || [];
          return res.end(JSON.stringify({ data: { messages } }));
        }

        if (url.includes('/chat') && req.method === 'POST') {
          const contractId = url.split('/api/v1/contracts/')[1].split('/chat')[0];
          readBody((body) => {
            if (!contractChats[contractId]) contractChats[contractId] = [];

            const newMessage = {
              id: 'msg_' + Date.now(),
              contractId,
              content: body.content || '',
              sender: currentUser,
              type: 'message',
              createdAt: new Date().toISOString(),
            };

            contractChats[contractId].push(newMessage);
            res.statusCode = 201;
            return res.end(JSON.stringify({ data: { message: newMessage } }));
          });
          return;
        }

        // Draft autosave (GET /api/v1/contracts/:id/draft & PATCH /api/v1/contracts/:id/draft)
        if (url.includes('/draft') && req.method === 'GET') {
          const contractId = url.split('/api/v1/contracts/')[1].split('/draft')[0];
          const draftContent = contractDrafts[contractId] ?? null;
          return res.end(JSON.stringify({ data: { draftContent } }));
        }

        if (url.includes('/draft') && req.method === 'PATCH') {
          const contractId = url.split('/api/v1/contracts/')[1].split('/draft')[0];
          readBody((body) => {
            contractDrafts[contractId] = body.editorContent || '';
            return res.end(JSON.stringify({ data: { savedAt: new Date().toISOString() } }));
          });
          return;
        }

        if (url.startsWith('/api/v1/contracts/') && req.method === 'GET') {
          const contractId = url.split('/api/v1/contracts/')[1].split('?')[0];
          const contract = contractsList.find((c) => c.id === contractId);
          if (!contract) {
            res.statusCode = 404;
            return res.end(
              JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Contract not found' } }),
            );
          }
          return res.end(JSON.stringify({ data: { contract } }));
        }

        if (url.startsWith('/api/v1/contracts/') && req.method === 'PATCH') {
          const contractId = url.split('/api/v1/contracts/')[1].split('?')[0];
          readBody((body) => {
            const index = contractsList.findIndex((c) => c.id === contractId);
            if (index === -1) {
              res.statusCode = 404;
              return res.end(
                JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Contract not found' } }),
              );
            }
            contractsList[index] = {
              ...contractsList[index],
              ...body,
              updatedAt: new Date().toISOString(),
            };
            return res.end(JSON.stringify({ data: { contract: contractsList[index] } }));
          });
          return;
        }

        if (url.startsWith('/api/v1/contracts/') && req.method === 'DELETE') {
          const contractId = url.split('/api/v1/contracts/')[1].split('?')[0];
          contractsList = contractsList.filter((c) => c.id !== contractId);
          return res.end(JSON.stringify({ data: { ok: true } }));
        }

        if (url === '/api/v1/contracts' && req.method === 'GET') {
          const fullUrl = new URL(req.url || '', 'http://localhost');
          const search = fullUrl.searchParams.get('search')?.toLowerCase() || '';
          const status = fullUrl.searchParams.get('status') || '';
          const type = fullUrl.searchParams.get('type') || '';
          const sort = fullUrl.searchParams.get('sort') || 'updatedAt_desc';

          let filtered = contractsList.filter((c) => {
            if (status && status !== 'all' && c.status !== status) return false;
            if (type && type !== 'all' && c.type !== type) return false;
            if (search) {
              const matchesName = c.name.toLowerCase().includes(search);
              const matchesCounterparty = (c.counterparty || '').toLowerCase().includes(search);
              const matchesDesc = (c.description || '').toLowerCase().includes(search);
              const matchesTags = (c.tags || []).some((t: string) => t.toLowerCase().includes(search));
              if (!matchesName && !matchesCounterparty && !matchesDesc && !matchesTags) {
                return false;
              }
            }
            return true;
          });

          if (sort === 'name_asc') {
            filtered.sort((a, b) => a.name.localeCompare(b.name));
          } else if (sort === 'name_desc') {
            filtered.sort((a, b) => b.name.localeCompare(a.name));
          } else if (sort === 'updatedAt_asc') {
            filtered.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
          } else {
            filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
          }

          return res.end(
            JSON.stringify({
              data: {
                contracts: filtered,
                pagination: {
                  page: 1,
                  limit: 50,
                  total: filtered.length,
                  totalPages: 1,
                },
              },
            }),
          );
        }

        if (url === '/api/v1/contracts' && req.method === 'POST') {
          readBody((body) => {
            const newContract = {
              id: 'ctr_' + Date.now(),
              name: body.name || 'Untitled Contract',
              type: body.type || 'other',
              status: body.status || 'draft',
              counterparty: body.counterparty || '',
              description: body.description || '',
              startDate: body.startDate || null,
              endDate: body.endDate || null,
              tags: body.tags || [],
              originalFile: body.file
                ? {
                    fileName: body.file.fileName,
                    mimeType: body.file.mimeType,
                    size: body.file.size,
                    uploadedAt: new Date().toISOString(),
                  }
                : null,
              currentVersionNumber: 1,
              owner: currentUser,
              createdBy: currentUser,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            contractsList.unshift(newContract);
            res.statusCode = 201;
            return res.end(JSON.stringify({ data: { contract: newContract } }));
          });
          return;
        }

        return res.end(JSON.stringify({ data: { message: 'Success' } }));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), mockApiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@cml/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  build: {
    outDir: path.resolve(__dirname, '../../dist'),
    emptyOutDir: true,
  },
});

