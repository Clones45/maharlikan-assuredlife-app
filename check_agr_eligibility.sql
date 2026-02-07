-- Function: check_agr_eligibility
-- Description: Checks if an agent is eligible for commissions based on AGR rules for a given period.
-- Logic: 
--   1. Target Period (Year, Month) requires qualification in the PREVIOUS month (7th to 7th).
--   2. Groups collections by Member Name (Last, First) to handle duplicate IDs or typos.
--   3. Rule A: >= 3 Membership Fees.
--   4. Rule B: At least 1 Membership Fee AND 1 Regular Payment for the same person.

CREATE OR REPLACE FUNCTION public.check_agr_eligibility(
  p_agent_id bigint, 
  p_year int, 
  p_month int
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_prev_year int;
  v_prev_month int;
  v_start_date date;
  v_end_date date;
  v_is_eligible boolean := false;
BEGIN
  -- 1. Determine Previous Month (The Qualification Period)
  v_prev_year := p_year;
  v_prev_month := p_month - 1;
  
  IF v_prev_month = 0 THEN
    v_prev_month := 12;
    v_prev_year := p_year - 1;
  END IF;

  -- 2. Calculate Cutoff Dates (7th of Prev Month to 7th of Current Month)
  -- Example: Target Feb (2) -> Qualify Jan (1) -> Jan 7 to Feb 7
  v_start_date := make_date(v_prev_year, v_prev_month, 7);
  
  IF v_prev_month = 12 THEN
    v_end_date := make_date(v_prev_year + 1, 1, 7);
  ELSE
    v_end_date := make_date(v_prev_year, v_prev_month + 1, 7);
  END IF;

  -- 3. Check Eligibility using Relaxed Logic (Group by Name)
  WITH raw_collections AS (
    SELECT 
      c.member_id,
      c.is_membership_fee,
      c.payment_for,
      c.payment,
      m.first_name,
      m.last_name
    FROM collections c
    JOIN members m ON c.member_id = m.id
    WHERE c.agent_id = p_agent_id
      AND c.date_paid >= v_start_date
      AND c.date_paid < v_end_date
  ),
  grouped_members AS (
    SELECT 
      UPPER(TRIM(last_name)) || '|' || UPPER(TRIM(first_name)) as member_key,
      BOOL_OR(is_membership_fee) as has_membership,
      BOOL_OR(NOT is_membership_fee AND payment_for = 'regular') as has_regular,
      COUNT(*) FILTER (WHERE is_membership_fee) as membership_count
    FROM raw_collections
    GROUP BY 1
  ),
  global_stats AS (
    SELECT 
      SUM(membership_count) as total_memberships,
      BOOL_OR(has_membership AND has_regular) as has_mixed_payment
    FROM grouped_members
  )
  SELECT 
    (COALESCE(total_memberships, 0) >= 3 OR COALESCE(has_mixed_payment, false))
  INTO v_is_eligible
  FROM global_stats;

  RETURN COALESCE(v_is_eligible, false);
END;
$function$;
