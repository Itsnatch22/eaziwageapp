import Pusher from 'pusher-js';
import { getEnv } from '@/env';

const env = typeof window !== 'undefined' ? getEnv() : null;

const pusherClient = env ? new Pusher(env.NEXT_PUBLIC_PUSHER_APP_KEY, {
  cluster: env.NEXT_PUBLIC_PUSHER_CLUSTER,
  forceTLS: true,
}) : null;

export default pusherClient;