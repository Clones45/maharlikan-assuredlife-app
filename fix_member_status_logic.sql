
-- 1. Helper Function to Calculate Paid Until (Handling Reinstatement)
CREATE OR REPLACE FUNCTION public.calculate_paid_until(p_member_id BIGINT) 
RETURNS DATE 
LANGUAGE plpgsql 
STABLE
AS $$
DECLARE
  v_plan_start DATE;
  v_monthly_due NUMERIC;
  v_paid_until DATE;
  v_last_activity DATE;
  v_collection RECORD;
  v_months_diff INTEGER;
  v_total_paid_after_reinstatement NUMERIC := 0;
BEGIN
  SELECT plan_start_date, date_joined, monthly_due 
  INTO v_plan_start, v_plan_start, v_monthly_due
  FROM members WHERE id = p_member_id;

  v_plan_start := COALESCE(v_plan_start, v_plan_start, CURRENT_DATE); -- Fallback
  v_last_activity := v_plan_start;
  v_paid_until := v_plan_start;

  IF v_monthly_due IS NULL OR v_monthly_due <= 0 THEN
      RETURN v_paid_until; 
  END IF;

  FOR v_collection IN 
      SELECT date_paid, payment 
      FROM collections 
      WHERE member_id = p_member_id 
        AND (is_membership_fee IS FALSE OR is_membership_fee IS NULL)
      ORDER BY date_paid ASC
  LOOP
      -- Calculate Month Difference (JS Logic Alignment)
      -- JS: (Year2 - Year1) * 12 + (Month2 - Month1)
      v_months_diff := (EXTRACT(YEAR FROM v_collection.date_paid) - EXTRACT(YEAR FROM v_last_activity)) * 12 + 
                       (EXTRACT(MONTH FROM v_collection.date_paid) - EXTRACT(MONTH FROM v_last_activity));

      -- Reinstatement Logic: Gap >= 3 months (Matches JS view_soa.js)
      IF v_months_diff >= 3 THEN
          v_plan_start := v_collection.date_paid;
          v_total_paid_after_reinstatement := 0; 
      END IF;
      v_last_activity := v_collection.date_paid;

      -- Logic Change: Count ALL payments regardless of plan_start, unless a gap resets it.
      -- This matches the JS logic where valid payments are summed if no reinstatement happened.
      v_total_paid_after_reinstatement := v_total_paid_after_reinstatement + v_collection.payment;
  END LOOP;

  v_paid_until := v_plan_start + (FLOOR(v_total_paid_after_reinstatement / v_monthly_due) || ' months')::INTERVAL;
  v_paid_until := v_paid_until + (MOD(v_total_paid_after_reinstatement, v_monthly_due) / v_monthly_due * 30 || ' days')::INTERVAL;

  RETURN v_paid_until;
END;
$$;

-- 2. Update get_lapsed_members (>= 60 Days after Next Due Date)
DROP FUNCTION IF EXISTS public.get_lapsed_members();
CREATE OR REPLACE FUNCTION public.get_lapsed_members()
 RETURNS TABLE(id bigint, maf_no text, last_name text, first_name text, middle_name text, address text, contact_number text, religion text, birth_date date, age integer, monthly_due numeric, plan_type text, contracted_price numeric, date_joined date, balance numeric, gender text, civil_status text, zipcode text, birthplace text, nationality text, height text, weight text, casket_type text, membership text, occupation text, agent_id bigint, created_at timestamp with time zone, plan_start_date date, months_paid bigint, months_behind double precision)
 LANGUAGE sql
AS $function$
  SELECT 
      m.id, m.maf_no, m.last_name, m.first_name, m.middle_name, m.address, m.contact_number, m.religion, m.birth_date, m.age, m.monthly_due, m.plan_type, m.contracted_price, m.date_joined, m.balance, m.gender, m.civil_status, m.zipcode, m.birthplace, m.nationality, m.height, m.weight, m.casket_type, m.membership, m.occupation, m.agent_id, m.created_at, m.plan_start_date,
      (COALESCE(SUM(CASE WHEN c.is_membership_fee = true THEN 0 ELSE c.payment END), 0) / NULLIF(m.monthly_due, 0))::bigint AS months_paid,
      EXTRACT(DAY FROM (CURRENT_DATE - (public.calculate_paid_until(m.id) + INTERVAL '1 day'))) AS months_behind
  FROM members m
  LEFT JOIN collections c ON c.member_id = m.id
  WHERE m.plan_type LIKE 'PACKAGE%'
  GROUP BY m.id
  HAVING EXTRACT(DAY FROM (CURRENT_DATE - (public.calculate_paid_until(m.id) + INTERVAL '1 day'))) >= 60
     AND m.plan_type IS DISTINCT FROM 'MS'
  ORDER BY m.last_name ASC;
$function$;

-- 3. Update get_at_risk_members (Lapsable: 30 to 59 Days after Next Due Date)
DROP FUNCTION IF EXISTS public.get_at_risk_members();
CREATE OR REPLACE FUNCTION public.get_at_risk_members()
 RETURNS TABLE(id bigint, maf_no text, last_name text, first_name text, middle_name text, address text, contact_number text, religion text, birth_date date, age integer, monthly_due numeric, plan_type text, contracted_price numeric, date_joined date, balance numeric, gender text, civil_status text, zipcode text, birthplace text, nationality text, height text, weight text, casket_type text, membership text, occupation text, agent_id bigint, created_at timestamp with time zone, plan_start_date date, months_paid bigint, months_behind double precision)
 LANGUAGE sql
AS $function$
  SELECT 
      m.id, m.maf_no, m.last_name, m.first_name, m.middle_name, m.address, m.contact_number, m.religion, m.birth_date, m.age, m.monthly_due, m.plan_type, m.contracted_price, m.date_joined, m.balance, m.gender, m.civil_status, m.zipcode, m.birthplace, m.nationality, m.height, m.weight, m.casket_type, m.membership, m.occupation, m.agent_id, m.created_at, m.plan_start_date,
      (COALESCE(SUM(CASE WHEN c.is_membership_fee = true THEN 0 ELSE c.payment END), 0) / NULLIF(m.monthly_due, 0))::bigint AS months_paid,
      EXTRACT(DAY FROM (CURRENT_DATE - (public.calculate_paid_until(m.id) + INTERVAL '1 day'))) AS months_behind
  FROM members m
  LEFT JOIN collections c ON c.member_id = m.id
  WHERE m.plan_type LIKE 'PACKAGE%'
  GROUP BY m.id
  HAVING EXTRACT(DAY FROM (CURRENT_DATE - (public.calculate_paid_until(m.id) + INTERVAL '1 day'))) BETWEEN 30 AND 59
     AND m.plan_type IS DISTINCT FROM 'MS'
  ORDER BY m.last_name ASC;
$function$;

-- 4. Update get_warning_members (1 to 29 Days after Next Due Date)
DROP FUNCTION IF EXISTS public.get_warning_members();
CREATE OR REPLACE FUNCTION public.get_warning_members()
 RETURNS TABLE(id bigint, maf_no text, last_name text, first_name text, middle_name text, address text, contact_number text, religion text, birth_date date, age integer, monthly_due numeric, plan_type text, contracted_price numeric, date_joined date, balance numeric, gender text, civil_status text, zipcode text, birthplace text, nationality text, height text, weight text, casket_type text, membership text, occupation text, agent_id bigint, status text, plan_start_date date, membership_paid boolean, membership_paid_date date, phone_number text, months_paid bigint, months_since_start double precision, months_behind double precision)
 LANGUAGE sql
AS $function$
  SELECT
      m.id, m.maf_no, m.last_name, m.first_name, m.middle_name, m.address, m.contact_number, m.religion, m.birth_date, m.age, m.monthly_due, m.plan_type, m.contracted_price, m.date_joined, m.balance, m.gender, m.civil_status, m.zipcode, m.birthplace, m.nationality, m.height, m.weight, m.casket_type, m.membership, m.occupation, m.agent_id, m.status, m.plan_start_date, m.membership_paid, m.membership_paid_date, m.phone_number,
      (COALESCE(SUM(CASE WHEN c.is_membership_fee = true THEN 0 ELSE c.payment END), 0) / NULLIF(m.monthly_due, 0))::bigint AS months_paid,
      0::double precision as months_since_start, 
      EXTRACT(DAY FROM (CURRENT_DATE - (public.calculate_paid_until(m.id) + INTERVAL '1 day'))) AS months_behind
  FROM members m
  LEFT JOIN collections c ON c.member_id = m.id
  WHERE m.plan_type LIKE 'PACKAGE%'
  GROUP BY m.id
  HAVING 
      EXTRACT(DAY FROM (CURRENT_DATE - (public.calculate_paid_until(m.id) + INTERVAL '1 day'))) >= 1
      AND
      EXTRACT(DAY FROM (CURRENT_DATE - (public.calculate_paid_until(m.id) + INTERVAL '1 day'))) <= 29
      AND m.plan_type IS DISTINCT FROM 'MS'
  ORDER BY m.last_name ASC;
$function$;

-- 5. Update get_all_members_expanded (Return Grace Days based on Next Due Date)
DROP FUNCTION IF EXISTS public.get_all_members_expanded(integer, integer);
CREATE OR REPLACE FUNCTION public.get_all_members_expanded(p_offset integer, p_limit integer)
 RETURNS TABLE(id bigint, maf_no text, last_name text, first_name text, middle_name text, address text, contact_number text, religion text, birth_date date, age integer, monthly_due numeric, plan_type text, contracted_price numeric, date_joined date, balance numeric, gender text, civil_status text, zipcode text, birthplace text, nationality text, height text, weight text, casket_type text, membership text, occupation text, agent_id bigint, status text, plan_start_date date, membership_paid boolean, membership_paid_date date, phone_number text, months_paid bigint, months_since_start double precision, months_behind double precision, computed_status text)
 LANGUAGE sql
AS $function$
  SELECT
      m.id, m.maf_no, m.last_name, m.first_name, m.middle_name, m.address, m.contact_number, m.religion, m.birth_date, m.age, m.monthly_due, m.plan_type, m.contracted_price, m.date_joined, m.balance, m.gender, m.civil_status, m.zipcode, m.birthplace, m.nationality, m.height, m.weight, m.casket_type, m.membership, m.occupation, m.agent_id, m.status, m.plan_start_date, m.membership_paid, m.membership_paid_date, m.phone_number,
      
      -- Months Paid (Approx)
      (COALESCE(SUM(CASE WHEN c.is_membership_fee = true THEN 0 ELSE c.payment END), 0) / NULLIF(m.monthly_due, 0))::bigint AS months_paid,
      
      0::double precision as months_since_start, 
      
      -- Grace Days (hijacking months_behind column for compatibility) based on Next Due Date
      EXTRACT(DAY FROM (CURRENT_DATE - (public.calculate_paid_until(m.id) + INTERVAL '1 day'))) AS months_behind,

      -- Computed Status Column
      CASE 
        WHEN EXTRACT(DAY FROM (CURRENT_DATE - (public.calculate_paid_until(m.id) + INTERVAL '1 day'))) >= 60 THEN 'LAPSED'
        WHEN EXTRACT(DAY FROM (CURRENT_DATE - (public.calculate_paid_until(m.id) + INTERVAL '1 day'))) BETWEEN 30 AND 59 THEN 'LAPSABLE'
        WHEN EXTRACT(DAY FROM (CURRENT_DATE - (public.calculate_paid_until(m.id) + INTERVAL '1 day'))) BETWEEN 1 AND 29 THEN 'WARNING'
        ELSE 'ACTIVE'
      END as computed_status
      
  FROM members m
  LEFT JOIN collections c ON c.member_id = m.id
  WHERE (m.plan_type LIKE 'PACKAGE%' OR m.plan_type = 'MS')
  GROUP BY m.id
  ORDER BY m.last_name ASC
  OFFSET p_offset
  LIMIT p_limit;
$function$;

-- 6. Update get_active_members (Grace Days <= 0)
DROP FUNCTION IF EXISTS public.get_active_members();
CREATE OR REPLACE FUNCTION public.get_active_members()
 RETURNS TABLE(id bigint, maf_no text, last_name text, first_name text, middle_name text, address text, contact_number text, religion text, birth_date date, age integer, monthly_due numeric, plan_type text, contracted_price numeric, date_joined date, balance numeric, gender text, civil_status text, zipcode text, birthplace text, nationality text, height text, weight text, casket_type text, membership text, occupation text, agent_id bigint, status text, plan_start_date date, membership_paid boolean, membership_paid_date date, phone_number text, months_paid bigint, months_since_start double precision, months_behind double precision)
 LANGUAGE sql
AS $function$
  SELECT
      m.id, m.maf_no, m.last_name, m.first_name, m.middle_name, m.address, m.contact_number, m.religion, m.birth_date, m.age, m.monthly_due, m.plan_type, m.contracted_price, m.date_joined, m.balance, m.gender, m.civil_status, m.zipcode, m.birthplace, m.nationality, m.height, m.weight, m.casket_type, m.membership, m.occupation, m.agent_id, m.status, m.plan_start_date, m.membership_paid, m.membership_paid_date, m.phone_number,
      (COALESCE(SUM(CASE WHEN c.is_membership_fee = true THEN 0 ELSE c.payment END), 0) / NULLIF(m.monthly_due, 0))::bigint AS months_paid,
      0::double precision as months_since_start, 
      EXTRACT(DAY FROM (CURRENT_DATE - (public.calculate_paid_until(m.id) + INTERVAL '1 day'))) AS months_behind
  FROM members m
  LEFT JOIN collections c ON c.member_id = m.id
  WHERE m.plan_type LIKE 'PACKAGE%'
  GROUP BY m.id
  HAVING 
      EXTRACT(DAY FROM (CURRENT_DATE - (public.calculate_paid_until(m.id) + INTERVAL '1 day'))) <= 0
      AND m.plan_type IS DISTINCT FROM 'MS'
  ORDER BY m.last_name ASC;
$function$;
