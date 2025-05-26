import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Stripe webhook handler will be implemented here
  return NextResponse.json({ message: 'Stripe webhook endpoint' });
}

export async function GET() {
  return NextResponse.json({ message: 'Stripe API endpoint' });
}

