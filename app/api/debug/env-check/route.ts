import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    openai_api_key_exists: !!process.env.OPENAI_API_KEY,
    openai_api_key_length: process.env.OPENAI_API_KEY?.length || 0,
    openai_assistant_id_exists: !!process.env.OPENAI_ASSISTANT_ID,
    pusher_app_id_exists: !!process.env.PUSHER_APP_ID,
    pusher_key_exists: !!process.env.PUSHER_KEY,
    pusher_secret_exists: !!process.env.PUSHER_SECRET,
    pusher_cluster: process.env.PUSHER_CLUSTER,
    node_env: process.env.NODE_ENV
  });
} 