
-- ============================================================
-- cookie_consents
-- ============================================================
CREATE POLICY "cookie_consents_anon_insert"
ON public.cookie_consents FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "cookie_consents_admin_select"
ON public.cookie_consents FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.system_admins
    WHERE id = auth.uid() AND is_admin = true
  )
);

-- ============================================================
-- dusupay_transactions
-- ============================================================
CREATE POLICY "dusupay_transactions_admin_select"
ON public.dusupay_transactions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.system_admins
    WHERE id = auth.uid() AND is_admin = true
  )
);

-- ============================================================
-- exchange_rates
-- ============================================================
CREATE POLICY "exchange_rates_authenticated_select"
ON public.exchange_rates FOR SELECT
TO authenticated
USING (true);

-- ============================================================
-- meeting_logs
-- ============================================================
CREATE POLICY "meeting_logs_admin_select"
ON public.meeting_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.system_admins
    WHERE id = auth.uid() AND is_admin = true
  )
);

CREATE POLICY "meeting_logs_own_select"
ON public.meeting_logs FOR SELECT
TO authenticated
USING (
  user_email = (
    SELECT email FROM auth.users WHERE id = auth.uid()
  )
);

-- ============================================================
-- password_resets
-- ============================================================
CREATE POLICY "password_resets_own_select"
ON public.password_resets FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- ============================================================
-- statements
-- ============================================================
CREATE POLICY "statements_admin_select"
ON public.statements FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.system_admins
    WHERE id = auth.uid() AND is_admin = true
  )
);

CREATE POLICY "statements_org_select"
ON public.statements FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT id FROM public.employers
    WHERE user_id = auth.uid()
  )
);

-- ============================================================
-- weekly_insights
-- ============================================================
CREATE POLICY "weekly_insights_admin_select"
ON public.weekly_insights FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.system_admins
    WHERE id = auth.uid() AND is_admin = true
  )
);

CREATE POLICY "weekly_insights_org_select"
ON public.weekly_insights FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT id FROM public.employers
    WHERE user_id = auth.uid()
  )
);

-- ============================================================
-- wiza_public_sessions
-- ============================================================
CREATE POLICY "wiza_sessions_anon_insert"
ON public.wiza_public_sessions FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "wiza_sessions_own_select"
ON public.wiza_public_sessions FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "wiza_sessions_own_update"
ON public.wiza_public_sessions FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- ============================================================
-- wiza_public_messages
-- ============================================================
CREATE POLICY "wiza_messages_anon_insert"
ON public.wiza_public_messages FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "wiza_messages_session_select"
ON public.wiza_public_messages FOR SELECT
TO anon, authenticated
USING (true);

