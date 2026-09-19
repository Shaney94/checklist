import "server-only";
import handler from "../../../server/handlers/bootstrap.js";
import { adapt } from "../../../server/route-adapter";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = adapt(handler);
