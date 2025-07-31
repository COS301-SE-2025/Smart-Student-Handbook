import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  env: {
    NEXT_PUBLIC_FIREBASE_DATABASE_URL: 'https://dummy-default-rtdb.firebaseio.com/',
    NEXT_PUBLIC_FIREBASE_API_KEY: 'dummy',
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'dummy.firebaseapp.com',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'dummy',
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'dummy.appspot.com',
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: 'dummy',
    NEXT_PUBLIC_FIREBASE_APP_ID: 'dummy',
  },
};

export default nextConfig;