/*
  # Add Message Attachments and Disappearing Messages

  1. Changes to Messages Table
    - Add `attachment_url` column for file/image/GIF attachments
    - Add `attachment_type` column to store the type of attachment (image, video, gif, file)
    - Add `attachment_size` column to store file size
    - Add `attachment_name` column to store original filename
    - Add `expires_at` column for disappearing messages
    - Add `expire_duration` column to store the duration in seconds
    
  2. Security
    - Keep existing RLS policies
    - Add check constraint for valid attachment types
    - Add check constraint for valid expire durations
*/

-- Add new columns to messages table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'attachment_url'
  ) THEN
    ALTER TABLE messages ADD COLUMN attachment_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'attachment_type'
  ) THEN
    ALTER TABLE messages ADD COLUMN attachment_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'attachment_size'
  ) THEN
    ALTER TABLE messages ADD COLUMN attachment_size bigint;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'attachment_name'
  ) THEN
    ALTER TABLE messages ADD COLUMN attachment_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE messages ADD COLUMN expires_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'expire_duration'
  ) THEN
    ALTER TABLE messages ADD COLUMN expire_duration integer;
  END IF;
END $$;

-- Add check constraint for valid attachment types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_attachment_type'
  ) THEN
    ALTER TABLE messages ADD CONSTRAINT valid_attachment_type 
    CHECK (attachment_type IS NULL OR attachment_type IN ('image', 'video', 'gif', 'file'));
  END IF;
END $$;

-- Add check constraint for valid expire durations (5 seconds to 7 days)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_expire_duration'
  ) THEN
    ALTER TABLE messages ADD CONSTRAINT valid_expire_duration 
    CHECK (expire_duration IS NULL OR (expire_duration >= 5 AND expire_duration <= 604800));
  END IF;
END $$;

-- Create function to automatically delete expired messages
CREATE OR REPLACE FUNCTION delete_expired_messages()
RETURNS void AS $$
BEGIN
  DELETE FROM messages
  WHERE expires_at IS NOT NULL AND expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create index for faster expired message queries
CREATE INDEX IF NOT EXISTS idx_messages_expires_at ON messages(expires_at) WHERE expires_at IS NOT NULL;
