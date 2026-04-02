-- Chat conversations and messages for agentic AI chat
CREATE TABLE chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  title text NOT NULL DEFAULT 'New Conversation',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content text,
  tool_calls jsonb,
  tool_call_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_chat_conversations_org ON chat_conversations(org_id);
CREATE INDEX idx_chat_conversations_user ON chat_conversations(user_id);
CREATE INDEX idx_chat_messages_conversation ON chat_messages(conversation_id);

-- RLS
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org conversations" ON chat_conversations
  FOR ALL USING (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage messages in their conversations" ON chat_messages
  FOR ALL USING (conversation_id IN (
    SELECT id FROM chat_conversations WHERE org_id IN (
      SELECT org_id FROM memberships WHERE user_id = auth.uid()
    )
  ));

-- Auto-update updated_at on chat_conversations
CREATE TRIGGER set_chat_conversations_updated_at
  BEFORE UPDATE ON chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
