import Login from '../features/auth/Login';
import '../features/auth/login.css';

// Session checks and CSP nonces must never be statically shared between requests.
export const dynamic = 'force-dynamic';
export default function LoginPage() { return <Login />; }
