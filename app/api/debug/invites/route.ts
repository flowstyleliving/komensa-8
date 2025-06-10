import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chatId');

    console.log('[Debug Invites] Looking for invites, chatId filter:', chatId);

    // Get all invites (optionally filtered by chatId)
    const whereClause = chatId ? { chat_id: chatId } : {};
    
    const invites = await prisma.chatInvite.findMany({
      where: whereClause
    });

    const inviteData = invites.map(invite => ({
      id: invite.id,
      token: invite.token,
      chatId: invite.chat_id,
      expiresAt: invite.expires_at,
      acceptedAt: invite.accepted_at,
      isExpired: invite.expires_at < new Date(),
      inviteUrl: `${process.env.NEXTAUTH_URL}/invite/${invite.id}`
    }));

    console.log('[Debug Invites] Found invites:', inviteData);

    return NextResponse.json({
      success: true,
      totalInvites: invites.length,
      chatIdFilter: chatId,
      invites: inviteData
    });

  } catch (error: any) {
    console.error('[Debug Invites] Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch invites',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 