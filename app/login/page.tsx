'use client';

import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) router.push('/');
  }, [session, router]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="font-display text-2xl italic" style={{ color: 'var(--accent)' }}>Orbit</div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-center h-screen"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div
        className="w-full max-w-sm p-10 rounded-lg border text-center"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        <div
          className="font-display text-5xl italic mb-2"
          style={{ color: 'var(--accent)', letterSpacing: '-0.02em' }}
        >
          Orbit
        </div>
        <div
          className="text-xs mb-10"
          style={{
            color: 'var(--text-dim)',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            fontSize: '0.6rem',
          }}
        >
          Networking Intelligence
        </div>

        <p className="text-sm mb-8" style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}>
          Sign in to access your private networking intelligence dashboard.
        </p>

        <button
          onClick={() => signIn('google', { callbackUrl: '/' })}
          className="w-full py-3 px-6 rounded text-sm font-medium transition-all"
          style={{
            backgroundColor: 'var(--accent)',
            color: '#0C0C0A',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--accent-bright)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--accent)';
          }}
        >
          Sign in with Google
        </button>

        <p
          className="text-xs mt-6"
          style={{ color: 'var(--text-dim)', fontSize: '0.65rem' }}
        >
          Private access only
        </p>
      </div>
    </div>
  );
}
