-- Add optional emoji icon for dashboard sections.
-- Used by Views preview sidebar "menu section" labels.

ALTER TABLE IF EXISTS dashboard_sections
  ADD COLUMN IF NOT EXISTS icon_emoji TEXT;

COMMENT ON COLUMN dashboard_sections.icon_emoji IS 'Optional emoji icon for section navigation labels.';
