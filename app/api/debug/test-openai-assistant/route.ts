import { NextResponse } from 'next/server';
import { openai } from '@/lib/openai';

export async function GET() {
  console.log('[OpenAI Assistant Test] Starting OpenAI Assistant validation test...');
  
  const assistantId = process.env.OPENAI_ASSISTANT_ID;
  
  if (!assistantId) {
    return NextResponse.json({ 
      success: false,
      error: 'OPENAI_ASSISTANT_ID environment variable is not set'
    }, { status: 500 });
  }

  console.log('[OpenAI Assistant Test] Testing assistant ID:', assistantId);

  try {
    // Test 1: Retrieve the assistant
    console.log('[OpenAI Assistant Test] Attempting to retrieve assistant...');
    const assistant = await openai.beta.assistants.retrieve(assistantId);
    console.log('[OpenAI Assistant Test] Assistant retrieved successfully:', {
      id: assistant.id,
      name: assistant.name,
      model: assistant.model,
      created_at: assistant.created_at
    });

    // Test 2: Create a test thread
    console.log('[OpenAI Assistant Test] Creating test thread...');
    const thread = await openai.beta.threads.create();
    console.log('[OpenAI Assistant Test] Test thread created:', thread.id);

    // Test 3: Add a test message to the thread
    console.log('[OpenAI Assistant Test] Adding test message to thread...');
    await openai.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: 'This is a test message to verify the assistant works.'
    });
    console.log('[OpenAI Assistant Test] Test message added successfully');

    // Test 4: Try to create a run with the assistant
    console.log('[OpenAI Assistant Test] Attempting to create run with assistant...');
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId
    });
    console.log('[OpenAI Assistant Test] Run created successfully:', {
      id: run.id,
      status: run.status,
      assistant_id: run.assistant_id
    });

    // Test 5: Clean up - delete the test thread
    console.log('[OpenAI Assistant Test] Cleaning up test thread...');
    await openai.beta.threads.del(thread.id);
    console.log('[OpenAI Assistant Test] Test thread deleted successfully');

    return NextResponse.json({ 
      success: true, 
      message: 'OpenAI Assistant test passed',
      assistant: {
        id: assistant.id,
        name: assistant.name,
        model: assistant.model,
        created_at: assistant.created_at
      },
      testRun: {
        id: run.id,
        status: run.status,
        assistant_id: run.assistant_id
      }
    });

  } catch (error) {
    console.error('[OpenAI Assistant Test] Test failed:', error);
    
    // Enhanced error logging
    if (error instanceof Error) {
      console.error('[OpenAI Assistant Test] Error message:', error.message);
      console.error('[OpenAI Assistant Test] Error stack:', error.stack);
      if ((error as any).code) console.error('[OpenAI Assistant Test] Error code:', (error as any).code);
      if ((error as any).status) console.error('[OpenAI Assistant Test] Error status:', (error as any).status);
      if ((error as any).statusCode) console.error('[OpenAI Assistant Test] Error statusCode:', (error as any).statusCode);
      if ((error as any).response) {
        console.error('[OpenAI Assistant Test] Error response:', (error as any).response);
        if ((error as any).response?.data) {
          console.error('[OpenAI Assistant Test] Error response data:', (error as any).response.data);
        }
      }
      if ((error as any).body) console.error('[OpenAI Assistant Test] Error body:', (error as any).body);
      if (error.cause) console.error('[OpenAI Assistant Test] Error cause:', error.cause);
    }

    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      details: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
        status: (error as any).status,
        statusCode: (error as any).statusCode
      } : undefined
    }, { status: 500 });
  }
} 