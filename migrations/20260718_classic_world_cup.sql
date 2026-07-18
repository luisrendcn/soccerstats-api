ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS tournament_format text NOT NULL DEFAULT 'league';
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS champion_team_id integer;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS runner_up_team_id integer;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS third_place_team_id integer;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS fourth_place_team_id integer;

ALTER TABLE matches ALTER COLUMN home_team_id DROP NOT NULL;
ALTER TABLE matches ALTER COLUMN away_team_id DROP NOT NULL;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS tournament_phase text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS group_id integer;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS round_number integer;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS bracket_code text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS match_order integer;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS regulation_home_score integer;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS regulation_away_score integer;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS extra_time_home_score integer;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS extra_time_away_score integer;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS penalty_home_score integer;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS penalty_away_score integer;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS winner_team_id integer;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS victory_method text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS home_source_match_id integer;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS away_source_match_id integer;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS home_source_type text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS away_source_type text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS winner_advances_to_match_id integer;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS loser_advances_to_match_id integer;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS winner_advances_to_slot text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS loser_advances_to_slot text;

CREATE TABLE IF NOT EXISTS world_cup_groups (
  id serial PRIMARY KEY,
  tournament_id integer NOT NULL,
  name text NOT NULL,
  sort_order integer NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS world_cup_group_teams (
  id serial PRIMARY KEY,
  tournament_id integer NOT NULL,
  group_id integer NOT NULL,
  team_id integer NOT NULL,
  seed integer NOT NULL,
  manual_rank integer,
  created_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS world_cup_groups_tournament_order_idx
  ON world_cup_groups (tournament_id, sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS world_cup_groups_tournament_name_idx
  ON world_cup_groups (tournament_id, name);

CREATE UNIQUE INDEX IF NOT EXISTS world_cup_group_teams_unique_team_idx
  ON world_cup_group_teams (tournament_id, team_id);

CREATE UNIQUE INDEX IF NOT EXISTS world_cup_group_teams_unique_seed_idx
  ON world_cup_group_teams (group_id, seed);

CREATE UNIQUE INDEX IF NOT EXISTS matches_tournament_bracket_code_idx
  ON matches (tournament_id, bracket_code)
  WHERE bracket_code IS NOT NULL AND deleted_at IS NULL;
