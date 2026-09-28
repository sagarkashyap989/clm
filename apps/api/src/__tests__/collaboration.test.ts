import { describe, expect, it } from 'vitest';
import { CollaborationRoomManager } from '../collaboration/collaboration.rooms.js';
import { getDeterministicColor } from '../collaboration/collaboration.presence.js';

describe('Real-Time Collaboration Layer', () => {
  it('assigns consistent deterministic colors to users', () => {
    const color1 = getDeterministicColor('user_123');
    const color2 = getDeterministicColor('user_123');
    const color3 = getDeterministicColor('user_456');

    expect(color1).toBe(color2);
    expect(typeof color1).toBe('string');
    expect(color1.startsWith('#')).toBe(true);
    expect(typeof color3).toBe('string');
  });

  it('manages document rooms and tracks connected collaborator presences', () => {
    const manager = new CollaborationRoomManager();
    const contractId = 'ctr_test_100';
    const orgId = 'org_alpha';

    // User A joins
    const { room: roomA, presence: presA } = manager.joinRoom(
      contractId,
      orgId,
      'socket_user_a',
      { id: 'usr_a', name: 'Alice Lawyer', email: 'alice@acme.com', role: 'admin' },
      '<h2>Initial Contract</h2>',
    );

    expect(roomA.contractId).toBe(contractId);
    expect(roomA.organizationId).toBe(orgId);
    expect(roomA.content).toBe('<h2>Initial Contract</h2>');
    expect(presA.user.name).toBe('Alice Lawyer');

    // User B joins same room
    const { presence: presB } = manager.joinRoom(
      contractId,
      orgId,
      'socket_user_b',
      { id: 'usr_b', name: 'Bob Counsel', email: 'bob@acme.com', role: 'editor' },
    );

    expect(presB.user.name).toBe('Bob Counsel');

    const presences = manager.getRoomPresences(contractId);
    expect(presences.length).toBe(2);
    expect(presences.map((p) => p.user.name)).toEqual(
      expect.arrayContaining(['Alice Lawyer', 'Bob Counsel']),
    );
  });

  it('enforces strict organization isolation', () => {
    const manager = new CollaborationRoomManager();
    const contractId = 'ctr_test_200';

    // Join with Organization Alpha
    manager.joinRoom(
      contractId,
      'org_alpha',
      'socket_alpha_1',
      { id: 'usr_alpha', name: 'Alpha User', email: 'alpha@alpha.com' },
      '<p>Confidential terms</p>',
    );

    // Attempt to join same room with Organization Beta -> Must throw ORGANIZATION_MISMATCH
    expect(() => {
      manager.joinRoom(
        contractId,
        'org_beta',
        'socket_beta_1',
        { id: 'usr_beta', name: 'Intruder Beta', email: 'intruder@beta.com' },
      );
    }).toThrow(/ORGANIZATION_MISMATCH/);
  });

  it('applies incremental content patches and increments Lamport revisions', () => {
    const manager = new CollaborationRoomManager();
    const contractId = 'ctr_test_300';

    manager.joinRoom(
      contractId,
      'org_alpha',
      'socket_1',
      { id: 'usr_1', name: 'Editor One', email: 'one@acme.com' },
      '<p>Clause: Net 30 days</p>',
    );

    const patch1 = manager.applyPatch(contractId, '<p>Clause: Net 45 days</p>');
    expect(patch1.revision).toBe(1);
    expect(patch1.content).toBe('<p>Clause: Net 45 days</p>');

    const patch2 = manager.applyPatch(contractId, '<p>Clause: Net 60 days</p>');
    expect(patch2.revision).toBe(2);
    expect(patch2.content).toBe('<p>Clause: Net 60 days</p>');
  });

  it('tracks live cursor movement and text selection', () => {
    const manager = new CollaborationRoomManager();
    const contractId = 'ctr_test_400';

    manager.joinRoom(
      contractId,
      'org_alpha',
      'socket_cur_1',
      { id: 'usr_1', name: 'Editor One', email: 'one@acme.com' },
    );

    const updatedCursor = manager.updateCursor(contractId, 'socket_cur_1', {
      xRatio: 0.45,
      yRatio: 0.12,
    });
    expect(updatedCursor?.cursor?.xRatio).toBe(0.45);
    expect(updatedCursor?.cursor?.yRatio).toBe(0.12);

    const updatedSelection = manager.updateSelection(contractId, 'socket_cur_1', {
      quoteText: 'Indemnification clause',
    });
    expect(updatedSelection?.selection?.quoteText).toBe('Indemnification clause');
  });

  it('restores version and broadcasts updated state to the room', () => {
    const manager = new CollaborationRoomManager();
    const contractId = 'ctr_test_500';

    manager.joinRoom(
      contractId,
      'org_alpha',
      'socket_1',
      { id: 'usr_1', name: 'Admin', email: 'admin@acme.com' },
      '<p>Current version 4.0 draft</p>',
    );

    const restoreResult = manager.restoreContent(contractId, '<p>Restored Version 2.0 terms</p>');
    expect(restoreResult.revision).toBe(1);
    expect(restoreResult.content).toBe('<p>Restored Version 2.0 terms</p>');
    expect(manager.getRoom(contractId)?.content).toBe('<p>Restored Version 2.0 terms</p>');
  });

  it('removes disconnected sockets from active presence list', () => {
    const manager = new CollaborationRoomManager();
    const contractId = 'ctr_test_600';

    manager.joinRoom(
      contractId,
      'org_alpha',
      'sock_temp',
      { id: 'usr_temp', name: 'Temporary User', email: 'temp@acme.com' },
    );

    expect(manager.getRoomPresences(contractId).length).toBe(1);

    const left = manager.leaveRoom(contractId, 'sock_temp');
    expect(left?.user.name).toBe('Temporary User');
    expect(manager.getRoomPresences(contractId).length).toBe(0);
  });
});
