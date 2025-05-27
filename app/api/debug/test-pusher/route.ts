import { NextResponse } from 'next/server';
import { pusherServer, PUSHER_EVENTS } from '@/lib/pusher';

export async function GET(request: Request) {
  const channelName = 'private-test-pusher-channel'; // Hardcoded test channel
  const eventName = 'debug-test-event'; // MODIFIED: Use a simple string for the event name
  const testPayload = { message: 'Pusher test from Vercel API route', timestamp: new Date().toISOString() };

  console.log(`[Test Pusher API] Attempting to trigger event '${eventName}' on channel '${channelName}' with payload:`, testPayload);

  try {
    await pusherServer.trigger(channelName, eventName, testPayload);
    console.log('[Test Pusher API] SUCCESSFULLY triggered Pusher event.');
    return NextResponse.json({ 
      success: true, 
      message: 'Pusher event triggered successfully.',
      channel: channelName,
      event: eventName,
      payload: testPayload
    });
  } catch (error) {
    console.error('[Test Pusher API] ERROR: Failed to trigger Pusher event:', error);
    let errorDetails: any = { message: 'Unknown error' };
    if (error instanceof Error) {
      errorDetails.message = error.message;
      errorDetails.stack = error.stack;
      // Log all properties of the error object for maximum detail
      if ((error as any).code) errorDetails.code = (error as any).code;
      if ((error as any).statusCode) errorDetails.statusCode = (error as any).statusCode;
      if ((error as any).response) errorDetails.response = (error as any).response.data || (error as any).response;
      if ((error as any).body) errorDetails.body = (error as any).body;
      if (error.cause) errorDetails.cause = error.cause;
      console.error('[Test Pusher API] Pusher error all properties:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    } else {
      errorDetails.message = String(error);
      console.error('[Test Pusher API] Pusher error (not an Error object):', String(error));
    }
    
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to trigger Pusher event.',
      error: errorDetails
    }, { status: 500 });
  }
} 