export type PasswordPolicy = {
  minLength: number; uppercase?: boolean; lowercase?: boolean;
  number?: boolean; nonAlphanumeric?: boolean;
};
export type AccountResponse = {
  user?: unknown; verificationRequired?: boolean; policy?: PasswordPolicy;
};
export class AccountError extends Error {
  constructor(message: string, public status: number, public nextAction?: string, public retryAfter?: number) { super(message); }
}
export async function requestAccount(body: Record<string, string>): Promise<AccountResponse> {
  const response = await fetch('/api/account', {
    method: 'POST', credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json();
  if (!response.ok) throw new AccountError(data.error || 'We couldn’t complete that request. Please try again.', response.status, data.nextAction, data.retryAfter);
  return data;
}
export function loginDestination(search: string, hash: string) {
  const value = new URLSearchParams(search).get('next') || '/app';
  if (['#regular', '#deep', '#faq'].includes(hash)) return '/app' + hash;
  return /^\/app(?:#[a-z-]+)?$/i.test(value) ? value : '/app';
}
export function policyMessage(policy: PasswordPolicy) {
  const needs = [policy.uppercase && 'an uppercase letter', policy.lowercase && 'a lowercase letter', policy.number && 'a number', policy.nonAlphanumeric && 'a symbol'].filter(Boolean);
  return `Use at least ${policy.minLength} characters${needs.length ? ', including ' + needs.join(', ') : ''}.`;
}
