'use server';
import { dusupay } from '@/lib/dusupay';

export async function disburseMobileMoney(formData: FormData) {
  const result = await dusupay.createMobileMoneyPayout(
    Number(formData.get('amount')),
    'KE',
    'mpesa',
    formData.get('phone') as string,
    formData.get('name') as string
  );

  return result;
}