'use server';

import { signIn } from '@/auth';

export async function loginAction(email: string, password: string, callbackUrl: string) {
  try {
    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      return { error: result.error };
    }

    return { success: true, url: callbackUrl };
  } catch (error) {
    return { error: 'An unexpected error occurred' };
  }
}
