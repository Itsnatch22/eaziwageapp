export async function isStepUpRequiredResponse(response: Response): Promise<boolean> {
  if (response.status !== 403) return false;
  const body = await response.clone().json().catch(() => null) as { code?: string } | null;
  return body?.code === 'STEP_UP_REQUIRED';
}
