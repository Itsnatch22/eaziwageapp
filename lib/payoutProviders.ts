export interface PayoutProvider {
  validateDestination(payload: Record<string, unknown>): Promise<{ valid: boolean; reason?: string }>;
  initiateTransfer(payload: Record<string, unknown>): Promise<{ success: boolean; reference?: string; error?: string }>;
  getTransferStatus(reference: string): Promise<{ status: string; detail?: unknown }>;
}

export { getProviderByKey } from './providers/factory';
export { GenericHttpProvider } from './providers/genericHttpProvider';
