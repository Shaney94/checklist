import 'server-only';
import handler from '../../../server/handlers/cleaning-jobs.js';
import { adapt } from '../../../server/route-adapter';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const route = adapt(handler, 10000);
export { route as GET, route as POST, route as PUT, route as PATCH, route as DELETE, route as HEAD, route as OPTIONS };
