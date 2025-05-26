-- Komensa v3 — Comprehensive SQL Schema

-- USERS & AUTH
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE auth_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT,
  provider_id TEXT,
  UNIQUE (provider, provider_id)
);

-- CHATS
CREATE TABLE chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origin TEXT CHECK (origin IN ('web', 'slack', 'email')),
  mediator_style TEXT DEFAULT 'default',
  turn_taking TEXT DEFAULT 'strict',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE chat_participants (
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT,
  PRIMARY KEY (chat_id, user_id)
);

-- EVENTS
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  type TEXT,
  data JSONB,
  seq BIGINT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- TURN STATE
CREATE TABLE chat_turn_state (
  chat_id UUID PRIMARY KEY REFERENCES chats(id) ON DELETE CASCADE,
  next_user_id UUID,
  idx INT DEFAULT 0,
  turn_expires_at TIMESTAMPTZ
);

CREATE TABLE participant_state (
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  feelings JSONB DEFAULT '[]',
  needs JSONB DEFAULT '[]',
  viewpoints JSONB DEFAULT '[]',
  PRIMARY KEY (chat_id, user_id)
);

-- USER CONTEXT
CREATE TABLE user_context_snapshots (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  summary_json JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE context_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE thread_events (
  thread_id UUID REFERENCES context_threads(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id),
  PRIMARY KEY (thread_id, event_id)
);

-- EXTENSIONS
CREATE TABLE extensions (
  id TEXT PRIMARY KEY,
  kind TEXT,
  name TEXT,
  latest_version TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE extension_versions (
  ext_id TEXT REFERENCES extensions(id) ON DELETE CASCADE,
  version TEXT,
  manifest_json JSONB,
  entry_path TEXT,
  PRIMARY KEY (ext_id, version)
);

CREATE TABLE chat_extensions (
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  ext_id TEXT REFERENCES extensions(id),
  settings_json JSONB DEFAULT '{}',
  PRIMARY KEY (chat_id, ext_id)
);

CREATE TABLE mediator_profiles (
  id TEXT PRIMARY KEY,
  label TEXT,
  assistant_id TEXT,
  system_prompt TEXT
);

-- BILLING
CREATE TABLE billing_customers (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_product_id TEXT,
  label TEXT,
  ext_id TEXT NULL REFERENCES extensions(id)
);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  stripe_subscription_id TEXT UNIQUE,
  status TEXT,
  current_period_end TIMESTAMPTZ
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES subscriptions(id),
  stripe_invoice_id TEXT UNIQUE,
  amount INT,
  currency TEXT,
  paid_at TIMESTAMPTZ
);

CREATE TABLE redeemed_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  code TEXT,
  stripe_coupon_id TEXT,
  redeemed_at TIMESTAMPTZ DEFAULT now()
);

-- TODOS
CREATE TABLE todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  label TEXT,
  is_done BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- MEDIA & SHARED SPACE
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  uploader_id UUID REFERENCES users(id),
  storage_key TEXT,
  mime TEXT,
  size INT,
  transcript TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  type TEXT,
  started_by UUID REFERENCES users(id),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);

CREATE TABLE shared_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  ext_id TEXT REFERENCES extensions(id),
  state_json JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- INVITES & ACCESS
CREATE TABLE chat_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  email TEXT,
  token TEXT,
  expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ
);

-- INTEGRATIONS
CREATE TABLE oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  provider TEXT,
  access_token TEXT,
  refresh_token TEXT,
  scopes TEXT,
  expires_at TIMESTAMPTZ
);

-- NOTIFICATIONS
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  device_type TEXT,
  token TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ
);

-- SCHEDULING
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES chats(id),
  external_id TEXT,
  provider TEXT,
  created_by UUID REFERENCES users(id),
  summary TEXT,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ
);

-- GAMIFICATION
CREATE TABLE badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT,
  label TEXT,
  icon TEXT
);

CREATE TABLE user_badges (
  user_id UUID REFERENCES users(id),
  badge_id UUID REFERENCES badges(id),
  earned_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, badge_id)
);

-- ANALYTICS
CREATE TABLE daily_chat_metrics (
  chat_id UUID REFERENCES chats(id),
  date DATE,
  message_count INT,
  avg_response_time INT,
  sentiment_score FLOAT,
  heat_peak TIMESTAMPTZ,
  PRIMARY KEY (chat_id, date)
);

-- WEBHOOKS
CREATE TABLE webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT,
  payload JSONB,
  received_at TIMESTAMPTZ,
  status TEXT
);