import 'server-only';
import handler from '../../../server/handlers/quote.js';
import { adapt } from '../../../server/route-adapter';
export const runtime = 'nodejs';
const route = adapt(handler);
export { route as GET, route as POST, route as PUT, route as DELETE };
