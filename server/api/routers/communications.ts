// Complete tRPC router code (TypeScript)
// Path: e.g., server/api/routers/communications.ts
// Assumes tRPC setup with createTRPCRouter, publicProcedure, etc.
// Context (ctx) assumes { user: { id: string, isAdmin: boolean } } from auth middleware
// Add middleware for admin guard if not already in root router

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';  // Adjust import based on your setup
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { TRPCError } from '@trpc/server';

export const communicationsRouter = createTRPCRouter({
  getCurrentDraft: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user.isAdmin) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Only admins can access drafts' });
    }

    const { data, error } = await supabaseAdmin
      .from('announcements')
      .select('*')
      .eq('author_id', ctx.user.id)
      .eq('is_draft', true)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    }

    return data?.[0] ?? null;
  }),

  list: protectedProcedure
    .input(z.object({ includeDrafts: z.boolean().optional().default(false) }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user.isAdmin) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Only admins can list announcements' });
      }

      let query = supabaseAdmin.from('announcements').select('*').order('published_at', { ascending: false });

      if (!input.includeDrafts) {
        query = query.eq('is_draft', false);
      } else {
        // Include user's drafts
        query = query.or(`is_draft.eq.false,author_id.eq.${ctx.user.id}`);
      }

      const { data, error } = await query;

      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      }

      return data ?? [];
    }),

  saveDraft: protectedProcedure
    .input(z.object({ id: z.string().uuid().optional(), title: z.string().min(1), content: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.isAdmin) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Only admins can save drafts' });
      }

      let result;
      if (input.id) {
        const { data, error } = await supabaseAdmin
          .from('announcements')
          .update({ title: input.title, content: input.content, updated_at: new Date() })
          .eq('id', input.id)
          .eq('author_id', ctx.user.id)
          .eq('is_draft', true)
          .select('*')
          .single();

        if (error) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
        }
        result = data;
      } else {
        const { data, error } = await supabaseAdmin
          .from('announcements')
          .insert({ author_id: ctx.user.id, title: input.title, content: input.content, is_draft: true })
          .select('*')
          .single();

        if (error) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
        }
        result = data;
      }

      return result;
    }),

  publish: protectedProcedure
    .input(z.object({ id: z.string().uuid(), broadcast: z.boolean().optional().default(false) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.isAdmin) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Only admins can publish announcements' });
      }

      const now = new Date().toISOString();
      const { data, error } = await supabaseAdmin
        .from('announcements')
        .update({ is_draft: false, published_at: now })
        .eq('id', input.id)
        .eq('author_id', ctx.user.id)
        .select('*')
        .single();

      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      }

      if (input.broadcast) {
        // Example background job enqueue (e.g., to Trigger.dev or custom API endpoint)
        try {
          await fetch(process.env.BROADCAST_WORKER_URL!, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.WORKER_SECRET}`,
            },
            body: JSON.stringify({ announcementId: input.id }),
          });
        } catch (fetchError) {
          console.error('Failed to enqueue broadcast:', fetchError);
          // Handle gracefully; don't throw to avoid blocking publish
        }
      }

      return data;
    }),
});
