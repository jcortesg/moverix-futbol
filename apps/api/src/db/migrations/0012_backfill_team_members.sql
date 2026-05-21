-- Backfill team_members from registration_players
-- Players who are in registration_players but not yet in team_members
INSERT INTO team_members (team_id, player_uid, player_name, role)
SELECT DISTINCT ON (r.team_id, rp.player_uid)
  r.team_id,
  rp.player_uid,
  rp.player_name,
  'player'
FROM registration_players rp
JOIN registrations r ON r.id = rp.registration_id
LEFT JOIN team_members tm ON tm.team_id = r.team_id AND tm.player_uid = rp.player_uid
WHERE tm.id IS NULL
ORDER BY r.team_id, rp.player_uid, rp.added_at DESC;
