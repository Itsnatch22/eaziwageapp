
CREATE POLICY "communications_employer_select" ON public.communications
  FOR SELECT TO authenticated
  USING (sender_id = auth.uid());

CREATE POLICY "communications_employee_select" ON public.communications
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.user_id = auth.uid()
        AND e.organization_id = communications.organization_id
    )
  );

CREATE POLICY "communications_employer_insert" ON public.communications
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.employers em
      WHERE em.user_id = auth.uid()
        AND em.organization_id = communications.organization_id
    )
  );

CREATE POLICY "communications_sender_delete" ON public.communications
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

CREATE POLICY "communications_admin_all" ON public.communications
  FOR ALL TO authenticated
  USING (current_user_is_admin())
  WITH CHECK (current_user_is_admin());

