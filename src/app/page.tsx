import Home from '../features/marketing/Home';
import Login from '../features/auth/Login';
import '../features/marketing/public.css';
import '../features/auth/login.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Turnli — Cleaning without the managing', description: 'Connect reservation calendars, planned cleaning jobs, property checklists and Host review in one Turnli workspace.' };
export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  // Preserve already-issued invitation/recovery links and protected-page redirects.
  if (['join', 't', 'reset', 'next'].some(key => params[key] !== undefined)) return <Login />;
  return <Home />;
}
