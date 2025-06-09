import { NextRequest, NextResponse } from 'next/server';
import { testAllTurnModes, testNonParticipantAccess } from '@/tests/api/turn-state/comprehensive-turn-test';

export async function GET(request: NextRequest) {
  console.log('🧪 Starting comprehensive turn mode testing...');
  
  try {
    // Capture console output
    const logs: string[] = [];
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleAssert = console.assert;
    
    console.log = (...args) => {
      const message = args.join(' ');
      logs.push(message);
      originalConsoleLog(...args);
    };
    
    console.error = (...args) => {
      const message = `ERROR: ${args.join(' ')}`;
      logs.push(message);
      originalConsoleError(...args);
    };
    
    console.assert = (condition, ...args) => {
      if (!condition) {
        const message = `ASSERTION FAILED: ${args.join(' ')}`;
        logs.push(message);
        originalConsoleError(message);
        throw new Error(message);
      }
    };
    
    // Run all tests
    await testAllTurnModes();
    await testNonParticipantAccess();
    
    // Restore console
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.assert = originalConsoleAssert;
    
    return NextResponse.json({
      success: true,
      message: 'All turn mode tests passed!',
      logs: logs,
      timestamp: new Date().toISOString()
    }, { status: 200 });
    
  } catch (error) {
    console.error('Turn mode tests failed:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Turn mode tests failed',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}