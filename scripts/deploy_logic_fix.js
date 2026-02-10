
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read Service Key from Desktop .env
const envPath = path.resolve(__dirname, '../../Desktop/.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const match = envContent.match(/SUPABASE_SERVICE_KEY=(.+)/);
const SERVICE_KEY = match ? match[1].trim() : null;

const appJsonPath = path.resolve(__dirname, '../app.json');
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
const SUPABASE_URL = appJson.expo.extra.SUPABASE_URL;

if (!SERVICE_KEY) {
    console.error("Could not find SUPABASE_SERVICE_KEY in Desktop/.env");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function runSql(sql) {
    // We cannot run SQL directly via client unless we use a hack or if 'execute_sql' RPC exists.
    // Try calling the standard postgres interface? No.
    // Try calling the 'execute_sql' function found in MCP tools? 
    // It might be a custom function 'execute_sql' or 'exec_sql'.
    // Let's try to CREATE it first using a common trick? No.

    // We will assume 'execute_sql' or 'exec_sql' or 'run_sql' doesn't exist.
    // BUT! I can use the REST API 'POST /rest/v1/rpc/...' 
    // If I can't run DDL, I am stuck.

    // HOWEVER! The user might have installed the "Supabase Wrapper" or standard helpers.
    // Let's try to call 'exec_sql' which is common.

    // Wait... I am using the SERVICE KEY.
    // If I use the Service Key, I can modify the 'members' table directly.
    // Can I modify '_prisma_migrations'? No.

    // Pivot:
    // I can't execute DDL via 'supabase-js' if no helper RPC exists.
    // I will try to call 'debug_export_schema' to see its code again?
    // It was 'LANGUAGE plpgsql'.

    // I'll try to use the raw POST to /v1/query if enabled?
    // Not enabled by default.

    // LET'S TRY 'rpc' with a dummy function setup? No.

    // WHAT IF I JUST ASK THE USER TO RUN IT?
    // The previous Plan said "Provide SQL".
    // But I want to try one thing:
    // Does 'get_lapsed_members' use 'security definer'?
    // 'LANGUAGE sql'.

    // Okay. I will just output the SQL to a file and tell the user.
    // I cannot reliably execute DDL without a known RPC.
    console.error("Cannot execute DDL automatically without a helper RPC.");
}

const SQL_FIX = `
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
        -- AND (payment_for IS NULL OR NOT lower(payment_for) LIKE '%membership%') -- optional strictness
      ORDER BY date_paid ASC
  LOOP
      IF v_collection.date_paid > v_last_activity + INTERVAL '3 months' THEN
          v_plan_start := v_collection.date_paid;
          v_total_paid_after_reinstatement := 0; 
      END IF;
      v_last_activity := v_collection.date_paid;

      IF v_collection.date_paid >= v_plan_start THEN
          v_total_paid_after_reinstatement := v_total_paid_after_reinstatement + v_collection.payment;
      END IF;
  END LOOP;

  v_paid_until := v_plan_start + (FLOOR(v_total_paid_after_reinstatement / v_monthly_due) || ' months')::INTERVAL;
  v_paid_until := v_paid_until + (MOD(v_total_paid_after_reinstatement, v_monthly_due) / v_monthly_due * 30 || ' days')::INTERVAL;

  RETURN v_paid_until;
END;
$$;

-- 2. Update 'get_lapsed_members' (Grace Period >= 61 days)
DROP FUNCTION IF EXISTS public.get_lapsed_members();
CREATE OR REPLACE FUNCTION public.get_lapsed_members()
 RETURNS TABLE(id bigint, maf_no text, last_name text, first_name text, middle_name text, address text, contact_number text, religion text, birth_date date, age integer, monthly_due numeric, plan_type text, contracted_price numeric, date_joined date, balance numeric, gender text, civil_status text, zipcode text, birthplace text, nationality text, height text, weight text, casket_type text, membership text, occupation text, agent_id bigint, created_at timestamp with time zone, plan_start_date date, months_paid bigint, months_since_start double precision)
 LANGUAGE sql
AS $function$
  SELECT 
      m.id, m.maf_no, m.last_name, m.first_name, m.middle_name, m.address, m.contact_number, m.religion, m.birth_date, m.age, m.monthly_due, m.plan_type, m.contracted_price, m.date_joined, m.balance, m.gender, m.civil_status, m.zipcode, m.birthplace, m.nationality, m.height, m.weight, m.casket_type, m.membership, m.occupation, m.agent_id, m.created_at, m.plan_start_date,
      (COALESCE(SUM(CASE WHEN c.is_membership_fee = true THEN 0 ELSE c.payment END), 0) / NULLIF(m.monthly_due, 0)) AS months_paid,
      
      -- Grace Days
      (CURRENT_DATE - public.calculate_paid_until(m.id))::double precision AS months_since_start
  FROM members m
  LEFT JOIN collections c ON c.member_id = m.id
  WHERE m.plan_type LIKE 'PACKAGE%'
  GROUP BY m.id
  HAVING (CURRENT_DATE - public.calculate_paid_until(m.id)) >= 61;
$function$;

-- 3. Update 'get_at_risk_members' (Lapsable: 31 - 60 days)
DROP FUNCTION IF EXISTS public.get_at_risk_members();
CREATE OR REPLACE FUNCTION public.get_at_risk_members()
 RETURNS TABLE(id bigint, maf_no text, last_name text, first_name text, middle_name text, address text, contact_number text, religion text, birth_date date, age integer, monthly_due numeric, plan_type text, contracted_price numeric, date_joined date, balance numeric, gender text, civil_status text, zipcode text, birthplace text, nationality text, height text, weight text, casket_type text, membership text, occupation text, agent_id bigint, status text, plan_start_date date, membership_paid boolean, membership_paid_date date, phone_number text, months_paid bigint, months_since_start double precision, months_behind double precision)
 LANGUAGE sql
AS $function$
  SELECT
      m.id, m.maf_no, m.last_name, m.first_name, m.middle_name, m.address, m.contact_number, m.religion, m.birth_date, m.age, m.monthly_due, m.plan_type, m.contracted_price, m.date_joined, m.balance, m.gender, m.civil_status, m.zipcode, m.birthplace, m.nationality, m.height, m.weight, m.casket_type, m.membership, m.occupation, m.agent_id, m.status, m.plan_start_date, m.membership_paid, m.membership_paid_date, m.phone_number,
      (COALESCE(SUM(CASE WHEN c.is_membership_fee = true THEN 0 ELSE c.payment END), 0) / NULLIF(m.monthly_due, 0)) AS months_paid,
      0 as months_since_start, 
      (CURRENT_DATE - public.calculate_paid_until(m.id))::double precision AS months_behind
  FROM members m
  LEFT JOIN collections c ON c.member_id = m.id
  WHERE m.plan_type LIKE 'PACKAGE%'
  GROUP BY m.id
  HAVING 
      (CURRENT_DATE - public.calculate_paid_until(m.id)) >= 31
      AND
      (CURRENT_DATE - public.calculate_paid_until(m.id)) <= 60;
$function$;

-- 4. Update 'get_warning_members' (Warning: 1 - 30 days)
DROP FUNCTION IF EXISTS public.get_warning_members();
CREATE OR REPLACE FUNCTION public.get_warning_members()
 RETURNS TABLE(id bigint, maf_no text, last_name text, first_name text, middle_name text, address text, contact_number text, religion text, birth_date date, age integer, monthly_due numeric, plan_type text, contracted_price numeric, date_joined date, balance numeric, gender text, civil_status text, zipcode text, birthplace text, nationality text, height text, weight text, casket_type text, membership text, occupation text, agent_id bigint, status text, plan_start_date date, membership_paid boolean, membership_paid_date date, phone_number text, months_paid bigint, months_since_start double precision, months_behind double precision)
 LANGUAGE sql
AS $function$
  SELECT
      m.id, m.maf_no, m.last_name, m.first_name, m.middle_name, m.address, m.contact_number, m.religion, m.birth_date, m.age, m.monthly_due, m.plan_type, m.contracted_price, m.date_joined, m.balance, m.gender, m.civil_status, m.zipcode, m.birthplace, m.nationality, m.height, m.weight, m.casket_type, m.membership, m.occupation, m.agent_id, m.status, m.plan_start_date, m.membership_paid, m.membership_paid_date, m.phone_number,
      (COALESCE(SUM(CASE WHEN c.is_membership_fee = true THEN 0 ELSE c.payment END), 0) / NULLIF(m.monthly_due, 0)) AS months_paid,
      0 as months_since_start, 
      (CURRENT_DATE - public.calculate_paid_until(m.id))::double precision AS months_behind
  FROM members m
  LEFT JOIN collections c ON c.member_id = m.id
  WHERE m.plan_type LIKE 'PACKAGE%'
  GROUP BY m.id
  HAVING 
      (CURRENT_DATE - public.calculate_paid_until(m.id)) >= 1
      AND
      (CURRENT_DATE - public.calculate_paid_until(m.id)) <= 30;
$function$;

-- 5. Update 'get_all_members_expanded' (Main List) to return Grace Days
DROP FUNCTION IF EXISTS public.get_all_members_expanded(integer, integer);
CREATE OR REPLACE FUNCTION public.get_all_members_expanded(p_offset integer, p_limit integer)
 RETURNS TABLE(id bigint, maf_no text, last_name text, first_name text, middle_name text, address text, contact_number text, religion text, birth_date date, age integer, monthly_due numeric, plan_type text, contracted_price numeric, date_joined date, balance numeric, gender text, civil_status text, zipcode text, birthplace text, nationality text, height text, weight text, casket_type text, membership text, occupation text, agent_id bigint, status text, plan_start_date date, membership_paid boolean, membership_paid_date date, phone_number text, months_paid bigint, months_since_start double precision, months_behind double precision)
 LANGUAGE sql
AS $function$
  SELECT
      m.id, m.maf_no, m.last_name, m.first_name, m.middle_name, m.address, m.contact_number, m.religion, m.birth_date, m.age, m.monthly_due, m.plan_type, m.contracted_price, m.date_joined, m.balance, m.gender, m.civil_status, m.zipcode, m.birthplace, m.nationality, m.height, m.weight, m.casket_type, m.membership, m.occupation, m.agent_id, m.status, m.plan_start_date, m.membership_paid, m.membership_paid_date, m.phone_number,
      
      -- Months Paid (Approx)
      (COALESCE(SUM(CASE WHEN c.is_membership_fee = true THEN 0 ELSE c.payment END), 0) / NULLIF(m.monthly_due, 0)) AS months_paid,
      
      0::double precision as months_since_start, 
      
      -- Grace Days (hijacking months_behind column for compatibility)
      (CURRENT_DATE - public.calculate_paid_until(m.id))::double precision AS months_behind
      
  FROM members m
  LEFT JOIN collections c ON c.member_id = m.id
  GROUP BY m.id
  ORDER BY m.last_name ASC
  OFFSET p_offset
  LIMIT p_limit;
$function$;
`;

console.log("Generating SQL Fix file...");
const outPath = path.resolve(__dirname, '../fix_member_status_logic.sql');
fs.writeFileSync(outPath, SQL_FIX);
console.log(`SQL file written to: ${outPath}`);
console.log("Please run this SQL in your Supabase Dashboard SQL Editor.");

