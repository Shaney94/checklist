export type User = {
  id: string;
  email: string;
  canInvite: boolean;
  legacyAccess: boolean;
  workspaceId: string;
};
export type RichNode =
  | string
  | { tag: string; href?: string; children: RichNode[] }
  | RichNode[];
export type PrivateContent = {
  regular: [string, string[]][];
  deep: [string, string[]][];
  faqs: { question: string; answer: RichNode[] }[];
  reminders: RichNode[][];
  hostPhone: string;
  propertyName: string;
  originalCalendar: string;
};
export type Kind = "regular" | "deep" | "faqs";
export type Property = {
  id: string;
  name: string;
  phone: string;
  notes: string;
  regular: string[];
  deep: string[];
  faqs: { question: string; answer: string }[];
  checked: { regular: number[]; deep: number[] };
};
export type Workspace = {
  revision: number;
  data: {
    properties: Property[];
    legacyProgress?: Partial<
      Record<"regular" | "deep", { checked: boolean[] }>
    >;
  };
};
export type Calendar = {
  id: string;
  name: string;
  platform: string;
  status: string;
  host?: string;
  lastSuccess?: string;
  lastAttempt?: string;
  error?: string;
  enabled: boolean;
  checkIn: string;
  checkOut: string;
};
export type Booking = {
  id: string;
  property: string;
  source?: string;
  sourceKey?: string;
  guests?: number;
  isNew?: boolean;
  canContactHost?: boolean;
  arrival: { date: string; time?: string; timeSource?: string };
  checkout: { date: string; time?: string; timeSource?: string };
};
