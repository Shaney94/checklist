// Field definitions only; sensitive values are loaded from the authenticated API.
import { guideFields } from "../../../lib/property-guide.cjs";
export { guideFields };
export type Guide = Partial<Record<keyof typeof guideFields, string>>;
export type SavedGuide = { revision: number; guide: Guide };
