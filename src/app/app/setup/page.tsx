import AccountSetup from '../../../features/auth/AccountSetup';
import '../../../features/marketing/public.css';
import '../../../features/auth/login.css';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Account setup — Turnli', robots: { index: false, follow: false } };
export default function Page() { return <AccountSetup />; }
