import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    
    console.log(`[DEBUG] Searching for users with query: "${query || 'ALL USERS'}"`);
    
    let users;
    
    if (!query || query.trim() === '') {
      // If no query, return all users
      users = await prisma.user.findMany({
        select: {
          id: true,
          display_name: true,
          email: true,
          username: true,
          dateCreated: true,
          emailVerified: true
        },
        take: 20,
        orderBy: {
          dateCreated: 'desc'
        }
      });
    } else {
      // Search users by display_name, email, or username (case insensitive)
      users = await prisma.user.findMany({
        where: {
          OR: [
            {
              display_name: {
                contains: query.trim(),
                mode: 'insensitive'
              }
            },
            {
              email: {
                contains: query.trim(),
                mode: 'insensitive'
              }
            },
            {
              username: {
                contains: query.trim(),
                mode: 'insensitive'
              }
            }
          ]
        },
        select: {
          id: true,
          display_name: true,
          email: true,
          username: true,
          dateCreated: true,
          emailVerified: true
        },
        take: 20
      });
    }
    
    console.log(`[DEBUG] Found ${users.length} users matching "${query || 'ALL USERS'}"`);
    
    // Also get total user count for context
    const totalUsers = await prisma.user.count();
    
    return NextResponse.json({
      success: true,
      query: query || null,
      searchType: query ? 'filtered' : 'all',
      results: users,
      count: users.length,
      totalUsersInDb: totalUsers,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[DEBUG] Error searching users:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      query: new URL(request.url).searchParams.get('q'),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 