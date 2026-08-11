import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center text-slate-500">
      <Loader2 className="h-6 w-6 animate-spin mb-3" />
      <p className="text-sm">Pulling everything we can find on this store&hellip;</p>
    </main>
  );
}
