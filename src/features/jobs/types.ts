export type Job = { id: string; propertyId: string; propertyName: string; date: string; kind: "regular" | "deep"; state: "scheduled" | "cancelled"; revision: number; assigned: boolean };
export type AssignedJob = Job & { tasks: string[]; checked: number[]; faqs: { question: string; answer: string }[] };
