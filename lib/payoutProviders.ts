export interface PayoutProvider {
  validateDestination(payload: any): Promise<{ valid: boolean; reason?: string }>
  initiateTransfer(payload: any): Promise<{ success: boolean; reference?: string; error?: string }>
  getTransferStatus(reference: string): Promise<{ status: string; detail?: any }>
}

// Payout provider interface and helpers
export interface PayoutProvider {
  validateDestination(payload: any): Promise<{ valid: boolean; reason?: string }>;
  initiateTransfer(payload: any): Promise<{ success: boolean; reference?: string; error?: string }>;
  getTransferStatus(reference: string): Promise<{ status: string; detail?: any }>;
}

export { getProviderByKey } from './providers/factory';
export { GenericHttpProvider } from './providers/genericHttpProvider';
