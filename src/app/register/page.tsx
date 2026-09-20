import Login from '../../features/auth/Login';
import '../../features/marketing/public.css';
import '../../features/auth/login.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Turnli — Create your account' };
export default function Page() { return <Login initialScreen="register" />; }
