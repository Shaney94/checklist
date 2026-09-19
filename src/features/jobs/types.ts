export const stateLabels = { scheduled: "Scheduled", cancelled: "Cancelled", awaiting_review: "Completed · Awaiting Host review", approved: "Clean approved", issue_reported: "Issue reported · Evidence locked" };
export type JobState = keyof typeof stateLabels;
export type Job = { id: string; propertyId: string; propertyName: string; date: string; kind: "regular" | "deep"; state: JobState; revision: number; assigned: boolean };
export type AssignedJob = Job & { hostPhone?: string | null; tasks: string[]; checked: number[]; faqs: { question: string; answer: string }[] };
