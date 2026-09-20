-- `check_in_date`/`check_out_date` on guest_submissions are TEXT (canonical MM-DD-YYYY,
-- some legacy rows YYYY-MM-DD — see 20260502000000_widen_status_enum.sql's own comment).
-- A plain SQL ORDER BY sorts them lexically wrong, which is why listBookings
-- (_shared/databaseService.ts) has historically fetched every matching row and sorted in
-- JS instead of pushing `.order()` + `.range()` into the query — see
-- docs/workflow/planned/production-readiness-checklist/10-paginate-large-lists.md.
--
-- These generated columns carry a real `date` mirroring the same two-format parsing as
-- the TS `checkInDateToIso` helper (_shared/bookingsListSort.ts), so SQL can finally sort
-- by check-in/check-out correctly. A row whose text doesn't match either format, OR whose
-- month/day is not calendar-valid (e.g. "13-45-2024", "02-30-2024"), yields NULL rather
-- than throwing — mirrors `checkInDateToIso`'s fail-safe behavior (it returns the raw
-- string unchanged rather than erroring) and keeps a malformed legacy row from blocking
-- every future insert/update on the table.
--
-- Postgres requires a GENERATED column's expression to be IMMUTABLE. Neither `to_date()`
-- (locale/DateStyle-dependent) nor a plain `text::date` cast (also DateStyle-dependent)
-- qualify. `make_date(year int, month int, day int)` does — it takes explicit integer
-- parts, so extract those with `substring` and build the date from them instead of
-- casting or parsing text. `make_date` itself THROWS on an out-of-range month/day (it
-- does not return NULL) — confirmed locally (`make_date(2024, 13, 45)` and
-- `make_date(2023, 2, 29)` both raise "date field value out of range"), so the regex
-- alone (checking digit grouping, not calendar validity) is not enough: month/day must
-- be range-checked in the CASE guard BEFORE calling make_date, including the
-- days-in-month check (leap-year aware) for day, or a garbage-but-format-matching row
-- would fail every future write instead of degrading to NULL.
ALTER TABLE guest_submissions
  ADD COLUMN IF NOT EXISTS check_in_date_sql date GENERATED ALWAYS AS (
    CASE
      WHEN check_in_date ~ '^\d{4}-\d{2}-\d{2}$'
        AND substring(check_in_date FROM 6 FOR 2)::int BETWEEN 1 AND 12
        AND substring(check_in_date FROM 9 FOR 2)::int BETWEEN 1 AND
          extract(day FROM (
            make_date(substring(check_in_date FROM 1 FOR 4)::int, substring(check_in_date FROM 6 FOR 2)::int, 1)
            + interval '1 month' - interval '1 day'
          ))::int
      THEN
        make_date(
          substring(check_in_date FROM 1 FOR 4)::int,
          substring(check_in_date FROM 6 FOR 2)::int,
          substring(check_in_date FROM 9 FOR 2)::int
        )
      WHEN check_in_date ~ '^\d{2}-\d{2}-\d{4}$'
        AND substring(check_in_date FROM 1 FOR 2)::int BETWEEN 1 AND 12
        AND substring(check_in_date FROM 4 FOR 2)::int BETWEEN 1 AND
          extract(day FROM (
            make_date(substring(check_in_date FROM 7 FOR 4)::int, substring(check_in_date FROM 1 FOR 2)::int, 1)
            + interval '1 month' - interval '1 day'
          ))::int
      THEN
        make_date(
          substring(check_in_date FROM 7 FOR 4)::int,
          substring(check_in_date FROM 1 FOR 2)::int,
          substring(check_in_date FROM 4 FOR 2)::int
        )
      ELSE NULL
    END
  ) STORED,
  ADD COLUMN IF NOT EXISTS check_out_date_sql date GENERATED ALWAYS AS (
    CASE
      WHEN check_out_date ~ '^\d{4}-\d{2}-\d{2}$'
        AND substring(check_out_date FROM 6 FOR 2)::int BETWEEN 1 AND 12
        AND substring(check_out_date FROM 9 FOR 2)::int BETWEEN 1 AND
          extract(day FROM (
            make_date(substring(check_out_date FROM 1 FOR 4)::int, substring(check_out_date FROM 6 FOR 2)::int, 1)
            + interval '1 month' - interval '1 day'
          ))::int
      THEN
        make_date(
          substring(check_out_date FROM 1 FOR 4)::int,
          substring(check_out_date FROM 6 FOR 2)::int,
          substring(check_out_date FROM 9 FOR 2)::int
        )
      WHEN check_out_date ~ '^\d{2}-\d{2}-\d{4}$'
        AND substring(check_out_date FROM 1 FOR 2)::int BETWEEN 1 AND 12
        AND substring(check_out_date FROM 4 FOR 2)::int BETWEEN 1 AND
          extract(day FROM (
            make_date(substring(check_out_date FROM 7 FOR 4)::int, substring(check_out_date FROM 1 FOR 2)::int, 1)
            + interval '1 month' - interval '1 day'
          ))::int
      THEN
        make_date(
          substring(check_out_date FROM 7 FOR 4)::int,
          substring(check_out_date FROM 1 FOR 2)::int,
          substring(check_out_date FROM 4 FOR 2)::int
        )
      ELSE NULL
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_guest_submissions_check_in_date_sql
  ON guest_submissions (check_in_date_sql);

CREATE INDEX IF NOT EXISTS idx_guest_submissions_check_out_date_sql
  ON guest_submissions (check_out_date_sql);
