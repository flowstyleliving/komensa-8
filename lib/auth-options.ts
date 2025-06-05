import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from 'uuid';

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      isGuest?: boolean;
      chatId?: string;
    };
  }
  
  interface User {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    isGuest?: boolean;
    chatId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    isGuest?: boolean;
    chatId?: string;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile"
        }
      }
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          // Find user by email (using raw query to bypass TypeScript issues)
          const user = await prisma.$queryRaw`
            SELECT id, email, display_name, name, image, username, password 
            FROM "User" 
            WHERE email = ${credentials.email.toLowerCase()}
          ` as Array<{
            id: string;
            email: string;
            display_name: string | null;
            name: string | null;
            image: string | null;
            username: string | null;
            password: string | null;
          }>;

          if (!user[0] || !user[0].password) {
            return null;
          }

          const foundUser = user[0];

          // Verify password
          const isPasswordValid = await bcrypt.compare(credentials.password, foundUser.password!);

          if (!isPasswordValid) {
            return null;
          }

          // Return user object
          return {
            id: foundUser.id,
            email: foundUser.email,
            name: foundUser.display_name || foundUser.name,
            image: foundUser.image,
          };
        } catch (error) {
          console.error("Error during credentials authentication:", error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/auth/signin",
  },
  debug: true,
  logger: {
    error(code, metadata) {
      console.error('[NextAuth Error]', code, metadata);
    },
    warn(code) {
      console.warn('[NextAuth Warning]', code);
    },
    debug(code, metadata) {
      console.log('[NextAuth Debug]', code, metadata);
    },
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log('[NextAuth SignIn]', { user: user.email, account: account?.provider, profile: profile?.email });
      if (account?.provider === "google") {
        try {
          // Check if user already exists
          const existingUser = await prisma.user.findFirst({
            where: {
              OR: [
                { email: user.email },
                { display_name: user.name }
              ]
            }
          });

          if (!existingUser && user.email) {
            // Generate a proper UUID for the user
            const userId = uuidv4();
            
            // Use their name to fill name and display_name, and their email username as fallback
            const emailUsername = user.email?.split('@')[0] || 'user';
            const displayName = user.name || emailUsername;
            
            console.log('[NextAuth] Creating new user:', { email: user.email, displayName, userId });
            const newUser = await prisma.user.create({
              data: {
                id: userId,
                name: displayName,
                display_name: displayName,
                email: user.email,
              },
            });
            
            // Update the user object with the new ID so JWT callback gets it
            user.id = userId;
            console.log('[NextAuth] User created successfully:', newUser.id);
          } else if (existingUser) {
            console.log('[NextAuth] User already exists:', existingUser.email);
            // Update the user object with the existing ID
            user.id = existingUser.id;
          }
          return true;
        } catch (error) {
          console.error("Error during Google sign in:", error);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      console.log('[NextAuth JWT]', { 
        hasUser: !!user, 
        tokenId: token.id, 
        tokenIsGuest: token.isGuest,
        tokenChatId: token.chatId,
        userIsGuest: user?.isGuest 
      });
      
      // Handle guest user sessions (when user is provided during login)
      if (user) {
        token.id = user.id;
        token.isGuest = user.isGuest || false; // Explicitly set to false if not provided
        token.chatId = user.chatId;
      }
      
      // For regular users, ensure isGuest is not set to true
      if (!token.isGuest) {
        token.isGuest = false;
        // Don't set chatId for non-guest users
        delete token.chatId;
      }
      
      return token;
    },
    async session({ session, token }) {
      console.log('[NextAuth Session]', { 
        tokenId: token.id, 
        tokenIsGuest: token.isGuest,
        tokenChatId: token.chatId 
      });
      
      if (session.user && token) {
        session.user.id = token.id;
        session.user.isGuest = token.isGuest || false; // Explicitly set to false if not provided
        session.user.chatId = token.chatId;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // For guest users, redirect to their specific chat
      if (url.includes('chatId=')) {
        const urlParams = new URLSearchParams(url.split('?')[1]);
        const chatId = urlParams.get('chatId');
        if (chatId) {
          return `${baseUrl}/chat/${chatId}`;
        }
      }
      
      // Redirect to dashboard after successful sign in for regular users
      if (url.startsWith("/")) return `${baseUrl}/dashboard`;
      if (new URL(url).origin === baseUrl) return `${baseUrl}/dashboard`;
      return baseUrl;
    },
  },
}; 