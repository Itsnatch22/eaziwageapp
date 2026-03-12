import Pusher from "pusher";
import { Response } from "node-fetch";
import { getEnv } from "@/env";

const env = getEnv();

const pusherServer = new Pusher({
    appId: env.PUSHER_APP_ID,
    key: env.NEXT_PUBLIC_PUSHER_APP_KEY,
    secret: env.PUSHER_APP_SECRET,
    cluster: env.NEXT_PUBLIC_PUSHER_CLUSTER,
    useTLS: true,
});

const rawTrigger: Pusher['trigger'] = pusherServer.trigger.bind(pusherServer);
pusherServer.trigger = async (...args: Parameters<Pusher['trigger']>) => {
    try {
        return await rawTrigger(...args);
    } catch (error) {
        console.warn("[pusher] trigger failed (non-fatal):", error);
        return new Response("Pusher trigger skipped", { status: 202 });
    }
};

export default pusherServer;
