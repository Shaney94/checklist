import Login from '../../features/auth/Login';
import '../../features/marketing/public.css';
import '../../features/auth/login.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Turnli — Log in' };
export default function Page() { return <Login initialScreen="password" />; }
