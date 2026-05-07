-- Phase δ W1 D1: 預約系統 schema (2026-05-07)

CREATE TABLE IF NOT EXISTS booking_configs (
  id SERIAL PRIMARY KEY,
  field_id VARCHAR(50) NOT NULL UNIQUE,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  is_paid BOOLEAN NOT NULL DEFAULT FALSE,
  price_per_slot_cents INTEGER NOT NULL DEFAULT 0,
  currency VARCHAR(8) NOT NULL DEFAULT 'TWD',
  cancellable BOOLEAN NOT NULL DEFAULT TRUE,
  cancel_before_minutes INTEGER NOT NULL DEFAULT 0,
  reminder_minutes_before INTEGER NOT NULL DEFAULT 30,
  schedule_template JSONB NOT NULL,
  admin_notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_booking_configs_field ON booking_configs(field_id);

CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  booking_code VARCHAR(12) NOT NULL UNIQUE,
  field_id VARCHAR(50) NOT NULL,
  line_user_id VARCHAR(64) NOT NULL,
  display_name VARCHAR(100),
  phone VARCHAR(20),
  slot_start TIMESTAMPTZ NOT NULL,
  slot_end TIMESTAMPTZ NOT NULL,
  party_size INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'confirmed',
  payment_required BOOLEAN NOT NULL DEFAULT FALSE,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'none',
  payment_method VARCHAR(20),
  payment_id VARCHAR(80),
  amount_cents INTEGER NOT NULL DEFAULT 0,
  confirm_notified_at TIMESTAMPTZ,
  reminder_sent_at TIMESTAMPTZ,
  completed_notified_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  cancelled_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
  customer_note TEXT,
  admin_note TEXT,
  game_session_id INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bookings_field_slot ON bookings(field_id, slot_start);
CREATE INDEX IF NOT EXISTS idx_bookings_line_user ON bookings(line_user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_code ON bookings(booking_code);

CREATE TABLE IF NOT EXISTS booking_blackouts (
  id SERIAL PRIMARY KEY,
  field_id VARCHAR(50) NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_blackouts_field_start ON booking_blackouts(field_id, start_at);

CREATE TABLE IF NOT EXISTS booking_notification_templates (
  id SERIAL PRIMARY KEY,
  field_id VARCHAR(50) NOT NULL,
  template_key VARCHAR(40) NOT NULL,
  message_text TEXT NOT NULL,
  flex_message_json JSONB,
  action_url TEXT,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_booking_notif_templates_field_key ON booking_notification_templates(field_id, template_key);

SELECT 'Migration complete' AS status;
