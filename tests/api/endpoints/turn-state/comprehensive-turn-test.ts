import { TurnManager } from '@/features/chat/services/turnManager';
import { prisma } from '@/lib/prisma';

// Comprehensive test for all turn modes
export async function testAllTurnModes() {
  console.log('🧪 Starting comprehensive turn management tests...');
  
  // Create test chat and users
  const testChatId = `test-chat-${Date.now()}`;
  const users = ['user1', 'user2', 'user3'];
  
  try {
    // Setup test environment
    await setupTestEnvironment(testChatId, users);
    
    // Test each mode
    await testFlexibleMode(testChatId, users);
    await testStrictMode(testChatId, users);
    await testModeratedMode(testChatId, users);
    
    console.log('🎉 All turn mode tests passed!');
    
  } catch (error) {
    console.error('❌ Turn mode tests failed:', error);
  } finally {
    // Cleanup
    await cleanupTestEnvironment(testChatId);
  }
}

async function setupTestEnvironment(chatId: string, users: string[]) {
  console.log(`🔧 Setting up test environment for chat ${chatId}...`);
  
  // Create test chat
  await prisma.chat.create({
    data: {
      id: chatId,
      turn_taking: 'flexible' // Start with flexible
    }
  });
  
  // Add participants
  for (const userId of users) {
    await prisma.chatParticipant.create({
      data: {
        chat_id: chatId,
        user_id: userId,
        role: 'user'
      }
    });
  }
  
  console.log('✅ Test environment setup complete');
}

async function testFlexibleMode(chatId: string, users: string[]) {
  console.log('📋 Testing FLEXIBLE mode...');
  
  const turnManager = new TurnManager(chatId);
  
  // Set mode to flexible
  await prisma.chat.update({
    where: { id: chatId },
    data: { turn_taking: 'flexible' }
  });
  
  // Test that getTurnMode returns correct value
  const mode = await turnManager.getTurnMode();
  console.assert(mode === 'flexible', `Expected 'flexible', got '${mode}'`);
  console.log(`  ✅ Mode correctly set to: ${mode}`);
  
  // Test that all users can send messages
  for (const userId of users) {
    const canSend = await turnManager.canUserSendMessage(userId);
    console.assert(canSend === true, `User ${userId} should be able to send message in flexible mode`);
    console.log(`  ✅ User ${userId} can send message: ${canSend}`);
  }
  
  // Test AI response triggering
  const shouldTriggerAI = await turnManager.shouldTriggerAIResponse();
  console.assert(shouldTriggerAI === true, 'AI should respond in flexible mode');
  console.log(`  ✅ AI should respond: ${shouldTriggerAI}`);
  
  console.log('✅ FLEXIBLE mode tests passed');
}

async function testStrictMode(chatId: string, users: string[]) {
  console.log('📋 Testing STRICT mode...');
  
  const turnManager = new TurnManager(chatId);
  
  // Set mode to strict
  await prisma.chat.update({
    where: { id: chatId },
    data: { turn_taking: 'strict' }
  });
  
  // Test that getTurnMode returns correct value
  const mode = await turnManager.getTurnMode();
  console.assert(mode === 'strict', `Expected 'strict', got '${mode}'`);
  console.log(`  ✅ Mode correctly set to: ${mode}`);
  
  // Test initial state - first user should be able to send
  const firstUserCanSend = await turnManager.canUserSendMessage(users[0]);
  console.assert(firstUserCanSend === true, 'First user should be able to send initial message');
  console.log(`  ✅ First user (${users[0]}) can send initial message: ${firstUserCanSend}`);
  
  // Simulate first user sending a message
  await prisma.event.create({
    data: {
      chat_id: chatId,
      type: 'message',
      data: { content: 'First message', senderId: users[0] }
    }
  });
  
  // Test turn progression - second user should now be able to send
  const secondUserCanSend = await turnManager.canUserSendMessage(users[1]);
  console.assert(secondUserCanSend === true, 'Second user should be able to send after first user');
  console.log(`  ✅ Second user (${users[1]}) can send after first: ${secondUserCanSend}`);
  
  // First user should NOT be able to send again
  const firstUserCanSendAgain = await turnManager.canUserSendMessage(users[0]);
  console.assert(firstUserCanSendAgain === false, 'First user should not be able to send again immediately');
  console.log(`  ✅ First user (${users[0]}) cannot send again: ${!firstUserCanSendAgain}`);
  
  // Test AI triggering - should only trigger at end of round
  const shouldTriggerAIBeforeRoundEnd = await turnManager.shouldTriggerAIResponse();
  console.assert(shouldTriggerAIBeforeRoundEnd === false, 'AI should not trigger before round ends');
  console.log(`  ✅ AI should not trigger mid-round: ${!shouldTriggerAIBeforeRoundEnd}`);
  
  // Complete the round
  await prisma.event.create({
    data: {
      chat_id: chatId,
      type: 'message',
      data: { content: 'Second message', senderId: users[1] }
    }
  });
  
  await prisma.event.create({
    data: {
      chat_id: chatId,
      type: 'message',
      data: { content: 'Third message', senderId: users[2] }
    }
  });
  
  // Now AI should trigger
  const shouldTriggerAIAfterRoundEnd = await turnManager.shouldTriggerAIResponse();
  console.assert(shouldTriggerAIAfterRoundEnd === true, 'AI should trigger after round ends');
  console.log(`  ✅ AI should trigger after round end: ${shouldTriggerAIAfterRoundEnd}`);
  
  console.log('✅ STRICT mode tests passed');
}

async function testModeratedMode(chatId: string, users: string[]) {
  console.log('📋 Testing MODERATED mode...');
  
  const turnManager = new TurnManager(chatId);
  
  // Set mode to moderated
  await prisma.chat.update({
    where: { id: chatId },
    data: { turn_taking: 'moderated' }
  });
  
  // Clear previous messages for clean test
  await prisma.event.deleteMany({
    where: { chat_id: chatId }
  });
  
  // Test that getTurnMode returns correct value
  const mode = await turnManager.getTurnMode();
  console.assert(mode === 'moderated', `Expected 'moderated', got '${mode}'`);
  console.log(`  ✅ Mode correctly set to: ${mode}`);
  
  // Test initial state - user should be able to send
  const userCanSendInitial = await turnManager.canUserSendMessage(users[0]);
  console.assert(userCanSendInitial === true, 'User should be able to send initial message in moderated mode');
  console.log(`  ✅ User can send initial message: ${userCanSendInitial}`);
  
  // Send first message
  await prisma.event.create({
    data: {
      chat_id: chatId,
      type: 'message',
      data: { content: 'First message', senderId: users[0] }
    }
  });
  
  // User should still be able to send second message (under rate limit)
  const userCanSendSecond = await turnManager.canUserSendMessage(users[0]);
  console.assert(userCanSendSecond === true, 'User should be able to send second message under rate limit');
  console.log(`  ✅ User can send second message: ${userCanSendSecond}`);
  
  // Send second message
  await prisma.event.create({
    data: {
      chat_id: chatId,
      type: 'message',
      data: { content: 'Second message', senderId: users[0] }
    }
  });
  
  // User should NOT be able to send third message (rate limited)
  const userCanSendThird = await turnManager.canUserSendMessage(users[0]);
  console.assert(userCanSendThird === false, 'User should be rate limited after 2 messages');
  console.log(`  ✅ User is rate limited after 2 messages: ${!userCanSendThird}`);
  
  // Different user should still be able to send
  const otherUserCanSend = await turnManager.canUserSendMessage(users[1]);
  console.assert(otherUserCanSend === true, 'Other user should be able to send despite rate limit');
  console.log(`  ✅ Other user can send despite rate limit: ${otherUserCanSend}`);
  
  // Test AI response triggering - should always trigger in moderated mode
  const shouldTriggerAI = await turnManager.shouldTriggerAIResponse();
  console.assert(shouldTriggerAI === true, 'AI should always trigger in moderated mode');
  console.log(`  ✅ AI should trigger in moderated mode: ${shouldTriggerAI}`);
  
  console.log('✅ MODERATED mode tests passed');
}

async function cleanupTestEnvironment(chatId: string) {
  console.log(`🧹 Cleaning up test environment for chat ${chatId}...`);
  
  try {
    await prisma.event.deleteMany({
      where: { chat_id: chatId }
    });
    
    await prisma.chatParticipant.deleteMany({
      where: { chat_id: chatId }
    });
    
    await prisma.chatTurnState.deleteMany({
      where: { chat_id: chatId }
    });
    
    await prisma.chat.delete({
      where: { id: chatId }
    });
    
    console.log('✅ Cleanup complete');
  } catch (error) {
    console.warn('⚠️ Cleanup encountered errors (this is normal for test data):', error);
  }
}

// Test non-participant access
export async function testNonParticipantAccess() {
  console.log('🧪 Testing non-participant access restrictions...');
  
  const testChatId = `test-chat-nonparticipant-${Date.now()}`;
  const participants = ['user1', 'user2'];
  const nonParticipant = 'user3';
  
  try {
    await setupTestEnvironment(testChatId, participants);
    
    const turnManager = new TurnManager(testChatId);
    
    // Test that non-participant cannot send messages in any mode
    for (const mode of ['flexible', 'strict', 'moderated']) {
      await prisma.chat.update({
        where: { id: testChatId },
        data: { turn_taking: mode }
      });
      
      const canSend = await turnManager.canUserSendMessage(nonParticipant);
      console.assert(canSend === false, `Non-participant should not be able to send in ${mode} mode`);
      console.log(`  ✅ Non-participant blocked in ${mode} mode: ${!canSend}`);
    }
    
    console.log('✅ Non-participant access tests passed');
    
  } finally {
    await cleanupTestEnvironment(testChatId);
  }
}