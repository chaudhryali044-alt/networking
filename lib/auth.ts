import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

const ALLOWED_EMAIL = 'chaudhry.ali044@gmail.com';

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: number } | null> {
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      console.error('[NextAuth] Token refresh failed:', data.error);
      return null;
    }
    return {
      accessToken: data.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
    };
  } catch (err) {
    console.error('[NextAuth] Token refresh error:', err);
    return null;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/gmail.readonly',
          ].join(' '),
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      return user.email === ALLOWED_EMAIL;
    },
    async jwt({ token, account }) {
      if (account) {
        console.log('[NextAuth] Initial sign-in — storing access token, refresh token, expiry');
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
        };
      }

      const expiresAt = token.expiresAt as number | undefined;
      if (expiresAt && Date.now() / 1000 < expiresAt - 60) {
        return token;
      }

      const refreshToken = token.refreshToken as string | undefined;
      if (!refreshToken) {
        console.error('[NextAuth] No refresh token available — cannot refresh');
        return { ...token, error: 'RefreshTokenMissing' };
      }

      console.log('[NextAuth] Access token expired — refreshing...');
      const refreshed = await refreshAccessToken(refreshToken);
      if (!refreshed) {
        return { ...token, error: 'RefreshAccessTokenError' };
      }

      console.log('[NextAuth] Token refreshed successfully');
      return {
        ...token,
        accessToken: refreshed.accessToken,
        expiresAt: refreshed.expiresAt,
        error: undefined,
      };
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string | undefined;
      session.error = token.error as string | undefined;
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    error?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    error?: string;
  }
}
