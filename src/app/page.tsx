import { publicMetadata, publicPages, ORIGIN } from '../features/marketing/metadata';
import StructuredData from '../features/marketing/StructuredData';
import Home from '../features/marketing/Home';
import Login from '../features/auth/Login';
import '../features/marketing/public.css';
import '../features/auth/login.css';

export const dynamic = 'force-dynamic';
type Params = Record<string, string | string[] | undefined>;
const isAuth = (params: Params) => ['join', 't', 'reset', 'next'].some(key => params[key] !== undefined);
export async function generateMetadata({ searchParams }: { searchParams: Promise<Params> }) {
  return isAuth(await searchParams) ? { title: 'Turnli — Log in' } : publicMetadata(publicPages[0]);
}
export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  // Preserve already-issued invitation/recovery links and protected-page redirects.
  if (isAuth(params)) return <Login />;
  return <><Home /><StructuredData data={{ '@context': 'https://schema.org', '@graph': [
    { '@type': 'Organization', '@id': `${ORIGIN}/#organization`, name: 'Turnli', url: `${ORIGIN}/`, logo: `${ORIGIN}/icons/icon-512.png` },
    { '@type': 'WebSite', '@id': `${ORIGIN}/#website`, name: 'Turnli', url: `${ORIGIN}/`, publisher: { '@id': `${ORIGIN}/#organization` } },
  ] }} /></>;
}
