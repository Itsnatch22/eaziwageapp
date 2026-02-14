import { TRPCError, initTRPC } from '@trpc/server';

export type TRPCContext = {
  user?: {
    id: string;
    isAdmin: boolean;
  };
};

const t = initTRPC.context<TRPCContext>().create();

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthed);
