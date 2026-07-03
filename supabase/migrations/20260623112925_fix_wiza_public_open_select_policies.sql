
-- 2.9: Drop all open qual=true policies on both tables
DROP POLICY "wiza_messages_session_select" ON wiza_public_messages;
DROP POLICY "wiza_sessions_own_select" ON wiza_public_sessions;
DROP POLICY "wiza_sessions_own_update" ON wiza_public_sessions;

-- wiza_public_sessions: scope SELECT and UPDATE to own visitor_id
CREATE POLICY "wiza_sessions_own_select"
  ON wiza_public_sessions
  FOR SELECT
  TO anon, authenticated
  USING (visitor_id = auth.uid());

CREATE POLICY "wiza_sessions_own_update"
  ON wiza_public_sessions
  FOR UPDATE
  TO anon, authenticated
  USING (visitor_id = auth.uid())
  WITH CHECK (visitor_id = auth.uid());

-- wiza_public_messages: scope SELECT to sessions owned by this visitor
CREATE POLICY "wiza_messages_session_select"
  ON wiza_public_messages
  FOR SELECT
  TO anon, authenticated
  USING (
    session_id IN (
      SELECT id FROM wiza_public_sessions
      WHERE visitor_id = auth.uid()
    )
  );

-- Also tighten INSERT on sessions — visitor_id must match the inserting user
DROP POLICY "wiza_sessions_anon_insert" ON wiza_public_sessions;
CREATE POLICY "wiza_sessions_anon_insert"
  ON wiza_public_sessions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (visitor_id = auth.uid());

-- Tighten INSERT on messages — session must belong to the inserting user
DROP POLICY "wiza_messages_anon_insert" ON wiza_public_messages;
CREATE POLICY "wiza_messages_anon_insert"
  ON wiza_public_messages
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    session_id IN (
      SELECT id FROM wiza_public_sessions
      WHERE visitor_id = auth.uid()
    )
  );

