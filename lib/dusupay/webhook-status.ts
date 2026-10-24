export interface DusupayWebhookStatusPayload {
  transaction_status?: string;
  status?: string;
}

export function normalizeDusuPayStatus(
  event: string,
  payload: DusupayWebhookStatusPayload,
): 'COMPLETED' | 'FAILED' | 'PENDING' | 'REJECTED' {
  const rawValues = [event, payload.transaction_status, payload.status];
  const values = rawValues
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim().toUpperCase());

  const isCompleted = values.some((value) => ['COMPLETED', 'SUCCESS', 'SETTLED', 'PAID'].includes(value))
    || event === 'transaction.completed';
  const isFailed = values.some((value) => ['FAILED', 'REJECTED', 'DECLINED', 'CANCELLED'].includes(value))
    || ['transaction.failed', 'request.failed', 'request.cancelled'].includes(event);
  const isPending = values.some((value) => ['PENDING', 'PROCESSING', 'INITIATED', 'QUEUED', 'REQUESTED'].includes(value))
    || ['request.pending', 'transaction.pending'].includes(event);

  if (isCompleted && isFailed) return 'REJECTED';
  if (isCompleted) return 'COMPLETED';
  if (isFailed) return 'FAILED';
  if (isPending) return 'PENDING';
  return 'PENDING';
}
