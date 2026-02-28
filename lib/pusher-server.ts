import Pusher from "pusher";
import { getEnv } from "@/env";

const env = getEnv();

const pusherServer = new Pusher({
    appId: env.PUSHER_APP_ID,
    key: env.NEXT_PUBLIC_PUSHER_APP_KEY,
    secret: env.PUSHER_APP_SECRET,
    cluster: env.NEXT_PUBLIC_PUSHER_CLUSTER,
    useTLS: true,
});

export default pusherServer;