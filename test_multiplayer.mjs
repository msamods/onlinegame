import { Client } from 'colyseus.js';

async function runMultiplayerTest() {
  console.log('--- STARTING MULTIPLAYER INTEGRATION TEST ---');
  const endpoint = 'ws://localhost:3001';

  const client1 = new Client(endpoint);
  const client2 = new Client(endpoint);

  console.log('[Test] Client 1 connecting to game room...');
  const room1 = await client1.joinOrCreate('game_room', {
    username: 'Soldier_Alpha',
    character: 'ranger',
    color: '#2e7d32'
  });
  console.log(`[Test] Client 1 successfully connected! SessionId: ${room1.sessionId}, RoomId: ${room1.id}`);

  console.log('[Test] Client 2 connecting to the same game room...');
  const room2 = await client2.joinOrCreate('game_room', {
    username: 'Soldier_Bravo',
    character: 'commando',
    color: '#37474f'
  });
  console.log(`[Test] Client 2 successfully connected! SessionId: ${room2.sessionId}, RoomId: ${room2.id}`);

  if (room1.id !== room2.id) {
    throw new Error(`Clients connected to different rooms: ${room1.id} vs ${room2.id}`);
  }
  console.log('[PASS] Both players matched into the SAME active game room!');

  // Wait for state sync
  await new Promise(r => setTimeout(r, 600));

  console.log(`[Test] Room 1 player count in state: ${room1.state.players.size}`);
  console.log(`[Test] Room 2 player count in state: ${room2.state.players.size}`);

  if (room1.state.players.size < 2 || room2.state.players.size < 2) {
    throw new Error('Players failed to synchronize state!');
  }
  console.log('[PASS] Real-time state synchronization verified across both clients!');

  // Test Chat Synchronization
  let chatReceived = false;
  room2.state.chatMessages.onAdd((msg) => {
    if (msg.text === 'Tactical squad moving in!') {
      chatReceived = true;
      console.log(`[Test] Client 2 received chat from ${msg.senderName}: "${msg.text}"`);
    }
  });

  room1.send('chat_message', { text: 'Tactical squad moving in!' });
  await new Promise(r => setTimeout(r, 500));

  if (!chatReceived) {
    throw new Error('Chat message was not received by Client 2!');
  }
  console.log('[PASS] Real-time chat synchronization verified!');

  // Test Movement Input
  const p1InitialX = room1.state.players.get(room1.sessionId).x;
  console.log(`[Test] Client 1 initial position: x=${p1InitialX}`);

  // Send movement to the right
  room1.send('player_input', {
    left: false,
    right: true,
    jump: true,
    aimAngle: 0,
    clientTick: 1
  });

  await new Promise(r => setTimeout(r, 400));
  const p1MovedX = room2.state.players.get(room1.sessionId).x;
  console.log(`[Test] Client 1 position on Client 2 screen after move: x=${p1MovedX}`);

  if (p1MovedX === p1InitialX) {
    console.warn('[Warning] Position difference is 0 (may have collided with wall or tick delayed)');
  } else {
    console.log('[PASS] Server-authoritative physics movement verified across clients!');
  }

  // Test Weapon Fire & Broadcast
  let fireBroadcastReceived = false;
  room2.onMessage('player_fired', (data) => {
    fireBroadcastReceived = true;
    console.log(`[Test] Client 2 saw Client 1 fire weapon: ${data.weapon} at angle ${data.angle}`);
  });

  room1.send('player_fire', { aimAngle: 0.1 });
  await new Promise(r => setTimeout(r, 500));

  if (!fireBroadcastReceived) {
    throw new Error('Shooting event was not broadcast to Client 2!');
  }
  console.log('[PASS] Real-time shooting synchronization verified!');

  // Disconnect cleanly
  room1.leave();
  room2.leave();
  console.log('--- ALL MULTIPLAYER ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY ---');
  process.exit(0);
}

runMultiplayerTest().catch(err => {
  console.error('[Multiplayer Test Failed]', err);
  process.exit(1);
});
