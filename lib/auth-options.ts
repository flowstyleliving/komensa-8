import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
  
  interface User {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
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

          if (!existingUser) {
            // Create new user if not found
            // Use their name to fill name and display_name, and their email username as fallback
            const emailUsername = user.email?.split('@')[0] || 'user';
            const displayName = user.name || emailUsername;
            
            console.log('[NextAuth] Creating new user:', { email: user.email, displayName });
            await prisma.user.create({
              data: {
                id: user.id,
                name: displayName,
                display_name: displayName,
                email: user.email,
              },
            });
          } else {
            console.log('[NextAuth] User already exists:', existingUser.email);
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
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Redirect to dashboard after successful sign in
      if (url.startsWith("/")) return `${baseUrl}/dashboard`;
      if (new URL(url).origin === baseUrl) return `${baseUrl}/dashboard`;
      return baseUrl;
    },
  },
}; 