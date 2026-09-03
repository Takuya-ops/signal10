import Dashboard from '@/app/components/Dashboard';
import latestDigest from '@/public/data/latest.json';
import type { Digest } from '@/lib/types';

export default function Home() {
  return <Dashboard initialDigest={latestDigest as Digest} />;
}
