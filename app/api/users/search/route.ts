import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.length < 2) {
      return NextResponse.json({
        success: true,
        users: []
      });
    }

    // Query Prisma/Neon database for users
    const users = await prisma.user.findMany({
      where: {
        OR: [
          {
            display_name: {
              contains: query,
              mode: 'insensitive'
            }
          },
          {
            email: {
              contains: query,
              mode: 'insensitive'
            }
          }
        ],
        // Exclude the current user from results
        NOT: {
          id: session.user.id
        }
      },
      select: {
        id: true,
        display_name: true,
        email: true
      },
      take: 10 // Limit results
    });

    return NextResponse.json({
      success: true,
      users
    });

  } catch (error: any) {
    console.error('Error searching users:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to search users',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 