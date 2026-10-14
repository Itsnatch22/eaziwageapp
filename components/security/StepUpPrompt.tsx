'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface StepUpPromptProps {
  apiBase: string;
  onCancel: () => void;
  onVerified: () => Promise<void>;
}

export function StepUpPrompt({ apiBase, onCancel, onVerified }: StepUpPromptProps) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const verify = async () => {
    if (!/^\d{6}$/.test(code)) {
      toast.error('Enter the 6-digit code from your authenticator app.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'step_up', code }),
      });
      const result = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        toast.error(result?.error || 'Could not verify your authenticator code.');
        return;
      }

      setCode('');
      await onVerified();
    } catch {
      toast.error('Could not verify your authenticator code.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="presentation">
      <section
        aria-labelledby="step-up-title"
        aria-modal="true"
        className="w-full max-w-sm space-y-4 rounded-xl border bg-background p-6 shadow-xl"
        role="dialog"
      >
        <div>
          <h2 id="step-up-title" className="text-lg font-semibold">Verify it&apos;s you</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter a current code from your authenticator app to continue.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="step-up-code">Authenticator code</Label>
          <Input
            autoComplete="one-time-code"
            id="step-up-code"
            inputMode="numeric"
            maxLength={6}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            value={code}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button disabled={submitting} onClick={onCancel} variant="outline">Cancel</Button>
          <Button disabled={submitting || code.length !== 6} onClick={verify}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Verify and continue
          </Button>
        </div>
      </section>
    </div>
  );
}
