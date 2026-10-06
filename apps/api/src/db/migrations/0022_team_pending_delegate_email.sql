-- Pending delegate assignment by email.
-- When an admin bulk-creates a team whose delegate has no app account yet, the
-- admin stays as provisional director and the delegate's email is stored here.
-- On first login, the app claims any team matching the user's email (see
-- mobile-players.service claimPendingDelegateTeams) and promotes them to director.
ALTER TABLE teams ADD COLUMN pending_delegate_email varchar(160);
CREATE INDEX teams_pending_delegate_email_lower_idx ON teams (lower(pending_delegate_email));
