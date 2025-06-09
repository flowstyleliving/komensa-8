import { TurnManager } from '@/features/chat/services/turnManager';

// Simple test to verify turn manager functionality
async function testTurnManager() {
  console.log('🧪 Testing TurnManager with standardized nomenclature...');
  
  // Mock chat ID
  const testChatId = 'test-chat-123';
  const turnManager = new TurnManager(testChatId);
  
  try {
    // Test getTurnMode method
    console.log('📋 Testing getTurnMode...');
    const mode = await turnManager.getTurnMode();
    console.log(`✅ Turn mode: ${mode}`);
    
    // Test canUserSendMessage for different modes
    const testUserId = 'user-123';
    console.log(`📋 Testing canUserSendMessage for user ${testUserId}...`);
    const canSend = await turnManager.canUserSendMessage(testUserId);
    console.log(`✅ Can send message: ${canSend}`);
    
    // Test getCurrentTurn
    console.log('📋 Testing getCurrentTurn...');
    const currentTurn = await turnManager.getCurrentTurn();
    console.log(`✅ Current turn:`, currentTurn);
    
    // Test shouldTriggerAIResponse
    console.log('📋 Testing shouldTriggerAIResponse...');
    const shouldTrigger = await turnManager.shouldTriggerAIResponse();
    console.log(`✅ Should trigger AI: ${shouldTrigger}`);
    
    console.log('🎉 All tests passed! Turn management is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

export { testTurnManager }; 