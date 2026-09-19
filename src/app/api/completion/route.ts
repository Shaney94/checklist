import 'server-only';
import handler from '../../../server/handlers/completion.js';
import { adapt } from '../../../server/route-adapter';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// One bounded photo per request, including base64/JSON overhead; below platform limits.
const route = adapt(handler, 4 * 1024 * 1024 + 8192);
export { route as GET, route as POST, route as PUT, route as PATCH, route as DELETE, route as HEAD, route as OPTIONS };
