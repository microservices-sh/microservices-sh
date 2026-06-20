-- Submission moderation lifecycle. Adds a review state machine to form_submissions
-- so intake can be human-approved without re-modelling status in route code.
-- New submissions default to 'pending'; reviewSubmission moves them to a terminal
-- 'approved'/'rejected' or back to 're-reviewable' 'changes_requested'.

ALTER TABLE form_submissions ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';  -- pending | approved | rejected | changes_requested
ALTER TABLE form_submissions ADD COLUMN reviewed_at TEXT;     -- ISO timestamp; null until reviewed
ALTER TABLE form_submissions ADD COLUMN reviewed_by TEXT;     -- opaque reviewer actor id; null until reviewed
ALTER TABLE form_submissions ADD COLUMN review_note TEXT;     -- optional reason / requested changes

-- Review-queue reads are tenant + form + status scoped; index supports them.
CREATE INDEX IF NOT EXISTS idx_form_submissions_status ON form_submissions(tenant_id, form_id, status, submitted_at);
