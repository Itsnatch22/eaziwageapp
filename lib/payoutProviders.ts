export interface PayoutProvider {
  validateDestination(payload: any): Promise<{ valid: boolean; reason?: string }>
  initiateTransfer(payload: any): Promise<{ success: boolean; reference?: string; error?: string }>
  getTransferStatus(reference: string): Promise<{ status: string; detail?: any }>
}

export class MpesaProvider implements PayoutProvider {
  async validateDestination(payload: any) {
    // stubbed - add real validation in future
    return { valid: true };
  }
  async initiateTransfer(payload: any) {
    throw new Error('MpesaProvider not implemented');
  }
  async getTransferStatus(reference: string) {
    throw new Error('MpesaProvider not implemented');
  }
}

export class AirtelMoneyProvider implements PayoutProvider {
  async validateDestination(payload: any) {
    return { valid: true };
  }
  async initiateTransfer(payload: any) {
    throw new Error('AirtelMoneyProvider not implemented');
  }
  async getTransferStatus(reference: string) {
    throw new Error('AirtelMoneyProvider not implemented');
  }
}

export class BankTransferProvider implements PayoutProvider {
  async validateDestination(payload: any) {
    return { valid: true };
  }
  async initiateTransfer(payload: any) {
    throw new Error('BankTransferProvider not implemented');
  }
  async getTransferStatus(reference: string) {
    throw new Error('BankTransferProvider not implemented');
  }
}
