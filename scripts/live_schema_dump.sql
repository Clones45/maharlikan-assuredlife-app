
-- === TABLES ===
Table: beneficiaries
Table: payouts
Table: audit_logs
Table: agents
Table: users_profile
Table: _member_agent_key
Table: promotions
Table: members
Table: agent_members
Table: notifications
Table: agent_commission_rollups
Table: member_regular_coverage
Table: new_members_by_month
Table: member_plans_view
Table: user_agent_info
Table: member_total_paid
Table: agent_active_status_by_month
Table: plan_commission_map
Table: se_active_status_by_month
Table: soa_view
Table: as_active_status_by_month
Table: withdrawal_requests
Table: commissions
Table: inquiries
Table: hierarchy_tree_view
Table: eligible_promotions_view
Table: withdrawal_fees_log
Table: commissions_backup_20251207
Table: member_users
Table: ms_mh_active_status_by_month
Table: soa_summary
Table: member_last_payment
Table: member_paid_this_month
Table: full_hierarchy_downlines
Table: agent_commission_rollups_backup
Table: debug_logs
Table: agent_wallets
Table: override_commissions_v
Table: collections
Table: soa_transactions
Table: se_promotion_status_view
Table: agent_team_view
Table: as_promotion_status_view
Table: withdrawal_transactions
Table: agent_monthly_summary_view
Table: access_codes
Table: unified_active_status
Table: hierarchy_status_view
Table: ms_promotion_status_view

-- === FUNCTIONS ===
Function: tg__set_updated_at
CREATE OR REPLACE FUNCTION public.tg__set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at := now();
  return new;
end $function$


Function: is_admin
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select exists(
    select 1 from public.users_profile p
    where p.user_id = uid and p.role = 'admin'
  );
$function$


Function: get_monthly_agent_collections
CREATE OR REPLACE FUNCTION public.get_monthly_agent_collections(start_date date, end_date date)
 RETURNS TABLE(agent_id integer, lastname text, firstname text, total_this_month numeric)
 LANGUAGE sql
AS $function$
  select 
    a.id as agent_id,
    a.lastname,
    a.firstname,
    sum(c.payment) as total_this_month
  from collections c
  join members m on c.maf_no = m.maf_no
  join agents a on m.agent_id = a.id
  where c.date_paid >= start_date and c.date_paid <= end_date
  group by a.id, a.lastname, a.firstname;
$function$


Function: release_agent_rollup
CREATE OR REPLACE FUNCTION public.release_agent_rollup(p_agent_id bigint, p_year integer, p_month integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE agent_commission_rollups
     SET status                = 'released',
         is_finalized          = TRUE,
         monthly_commission    = 0,
         membership_commission = 0,
         override_commission   = 0,
         recruiter_bonus       = 0,
         grand_total_commission= 0,
         total_collection      = 0,
         updated_at            = NOW()
   WHERE agent_id = p_agent_id
     AND period_year = p_year
     AND period_month = p_month;
END;
$function$


Function: notify_withdrawal_update
CREATE OR REPLACE FUNCTION public.notify_withdrawal_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  target_user_uuid UUID;
  v_period_text TEXT;
BEGIN
  -- 🔍 LOOKUP: Get the Supabase Auth User UUID for this Agent
  SELECT user_id INTO target_user_uuid
  FROM users_profile
  WHERE agent_id = NEW.agent_id
  LIMIT 1;

  -- Format Period Text (e.g., "12/2025")
  v_period_text := NEW.period_month || '/' || NEW.period_year;

  -- ✅ APPROVED NOTIFICATION
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    INSERT INTO notifications (
      user_id, 
      title, 
      message, 
      type, 
      is_read, 
      extra,
      created_at
    )
    VALUES (
      target_user_uuid, 
      'Withdrawal Approved', 
      'Your withdrawal request for ₱' || NEW.amount || ' (period ' || v_period_text || ') has been approved.', 
      'withdrawal_status', -- Standardized Type
      false, 
      jsonb_build_object('agent_id', NEW.agent_id, 'request_id', NEW.id),
      NOW()
    );
  
  -- ❌ REJECTED NOTIFICATION
  ELSIF NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
    INSERT INTO notifications (
      user_id, 
      title, 
      message, 
      type, 
      is_read, 
      extra,
      created_at
    )
    VALUES (
      target_user_uuid, 
      'Withdrawal Rejected', 
      'Your withdrawal request for ₱' || NEW.amount || ' (period ' || v_period_text || ') was rejected.', 
      'withdrawal_status', -- Standardized Type
      false, 
      jsonb_build_object('agent_id', NEW.agent_id, 'request_id', NEW.id),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$function$


Function: identity_to_email
CREATE OR REPLACE FUNCTION public.identity_to_email(p_identity text)
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when position('@' in $1) > 0 then lower($1)      -- already an email
    else (
      select lower(u.email)
      from auth.users u
      join public.users_profile p on lower(p.email) = lower(u.email)
      where lower(p.username) = lower($1)
      limit 1
    )
  end
$function$


Function: soa_for_key
CREATE OR REPLACE FUNCTION public.soa_for_key(p_maf_no text, p_last_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m_id int;
  s_row jsonb;
  t_rows jsonb;
begin
  -- Find the member by AF/MAF number + last name (case-insensitive).
  -- If your column is named "af_no" instead of "maf_no", OR it can be in either one,
  -- keep both checks like below.
  select id
  into m_id
  from members
  where (maf_no = p_maf_no or af_no = p_maf_no)
    and lower(last_name) = lower(p_last_name)
  limit 1;

  if m_id is null then
    return jsonb_build_object('found', false);
  end if;

  -- Summary (use your view/table name; this assumes soa_summary exists)
  select to_jsonb(s.*)
  into s_row
  from soa_summary s
  where s.member_id = m_id;

  -- Transactions: prefer soa_transactions; fallback to collections if you don’t have a view
  select coalesce(jsonb_agg(to_jsonb(t) order by t.date), '[]'::jsonb)
  into t_rows
  from soa_transactions t
  where t.member_id = m_id;

  return jsonb_build_object(
    'found', true,
    'member_id', m_id,
    'summary', coalesce(s_row, '{}'::jsonb),
    'txns', t_rows
  );
end
$function$


Function: auth_email_for_username
CREATE OR REPLACE FUNCTION public.auth_email_for_username(_username text)
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select email
  from public.users_profile
  where lower(username) = lower(_username)
  limit 1;
$function$


Function: collections_after_delete
CREATE OR REPLACE FUNCTION public.collections_after_delete()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  DELETE FROM public.commissions
  WHERE collection_id = OLD.id
    AND commission_type IN (
      'plan_monthly',
      'travel_allowance',
      'override_asst_supervisor',
      'override_mkt_supervisor',
      'override_mkt_head'
    );
  RETURN OLD;
END
$function$


Function: username_to_email
CREATE OR REPLACE FUNCTION public.username_to_email(p_username text)
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select u.email
  from auth.users u
  join public.users_profile p
    on lower(p.email) = lower(u.email)
  where lower(p.username) = lower(p_username)
  limit 1;
$function$


Function: global_member_update
CREATE OR REPLACE FUNCTION public.global_member_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_total_paid numeric := 0;
BEGIN
  BEGIN
    -- ✅ 1. Agent changes
    IF NEW.agent_id IS DISTINCT FROM OLD.agent_id THEN
      UPDATE beneficiaries SET agent_id = NEW.agent_id WHERE member_id = NEW.id;
      UPDATE collections SET agent_id = NEW.agent_id WHERE member_id = NEW.id;
      UPDATE agent_members SET agent_id = NEW.agent_id WHERE member_id = NEW.id;
      UPDATE commissions SET agent_id = NEW.agent_id WHERE member_id = NEW.id;
      UPDATE member_users SET agent_id = NEW.agent_id WHERE member_id = NEW.id;
      UPDATE soa_transactions SET agent_id = NEW.agent_id WHERE member_id = NEW.id;
    END IF;

    -- ✅ 2. Name / contact / address sync
    IF (NEW.first_name IS DISTINCT FROM OLD.first_name)
       OR (NEW.middle_name IS DISTINCT FROM OLD.middle_name)
       OR (NEW.last_name IS DISTINCT FROM OLD.last_name)
       OR (NEW.address IS DISTINCT FROM OLD.address)
       OR (NEW.phone_number IS DISTINCT FROM OLD.phone_number) THEN

      UPDATE beneficiaries
        SET first_name   = COALESCE(NEW.first_name, first_name),
            middle_name  = COALESCE(NEW.middle_name, middle_name),
            last_name    = COALESCE(NEW.last_name, last_name),
            address      = COALESCE(NEW.address, address),
            phone_number = COALESCE(NEW.phone_number, phone_number)
        WHERE member_id = NEW.id;

      UPDATE collections
        SET member_name = CONCAT_WS(' ', NEW.first_name, NEW.middle_name, NEW.last_name)
        WHERE member_id = NEW.id;

      UPDATE commissions
        SET member_name = CONCAT_WS(' ', NEW.first_name, NEW.middle_name, NEW.last_name)
        WHERE member_id = NEW.id;
    END IF;

    -- ✅ 3. Plan / price / balance sync
    IF (NEW.plan_type IS DISTINCT FROM OLD.plan_type)
       OR (NEW.contracted_price IS DISTINCT FROM OLD.contracted_price)
       OR (NEW.balance IS DISTINCT FROM OLD.balance)
       OR (NEW.status IS DISTINCT FROM OLD.status)
       OR (NEW.membership_paid IS DISTINCT FROM OLD.membership_paid)
       OR (NEW.membership_paid_date IS DISTINCT FROM OLD.membership_paid_date) THEN

      UPDATE collections
        SET plan_type = NEW.plan_type
        WHERE member_id = NEW.id;

      UPDATE commissions
        SET plan_type = NEW.plan_type
        WHERE member_id = NEW.id;

      UPDATE soa_transactions
        SET plan_type = NEW.plan_type
        WHERE member_id = NEW.id;
    END IF;

    RETURN NEW;

  EXCEPTION WHEN OTHERS THEN
    INSERT INTO debug_logs (trigger_name, member_id, error_message)
    VALUES ('global_member_update', NEW.id, SQLERRM);
    RETURN NEW;
  END;
END;
$function$


Function: sync_date_paid_date
CREATE OR REPLACE FUNCTION public.sync_date_paid_date()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.date_paid_date := new.date_paid::date;
  return new;
end;
$function$


Function: user_role
CREATE OR REPLACE FUNCTION public.user_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select up.role
  from public.users_profile up
  where up.user_id = auth.uid()
  limit 1
$function$


Function: sync_smart_soa
CREATE OR REPLACE FUNCTION public.sync_smart_soa()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- delete existing row for this collection
  DELETE FROM public.soa_transactions WHERE collection_id = NEW.id;

  -- only insert valid ones
  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSIF (NEW.payment IS NOT NULL AND NEW.member_id IS NOT NULL) THEN
    INSERT INTO public.soa_transactions (
      member_id, date, amount, plan_type, or_no,
      payment_for, is_membership_fee, agent_id, collection_id
    )
    VALUES (
      NEW.member_id,
      COALESCE(NEW.date_paid::date, CURRENT_DATE),
      NEW.payment,
      NEW.plan_type,
      NEW.or_no,
      COALESCE(NEW.payment_for,
               CASE WHEN NEW.is_membership_fee THEN 'Membership' ELSE 'Regular' END),
      NEW.is_membership_fee,
      NEW.agent_id,
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$function$


Function: check_and_release_agr
CREATE OR REPLACE FUNCTION public.check_and_release_agr(p_agent_id bigint, p_year integer, p_month integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    prev_year int;
    prev_month int;
    prev_start date;
    prev_end date;
    is_eligible boolean := false;
    
    target_start date;
    target_end date;
    
    receivable_amount numeric := 0;
    already_released boolean := false;
BEGIN
    -- A. Determine Previous Period (The Qualifier)
    -- If Target is Feb (2), Prev is Jan (1).
    if p_month = 1 then
        prev_month := 12;
        prev_year := p_year - 1;
    else
        prev_month := p_month - 1;
        prev_year := p_year;
    end if;

    -- Check if ALREADY Released
    SELECT (status = 'released') INTO already_released
    FROM agent_commission_rollups
    WHERE agent_id = p_agent_id AND period_year = p_year AND period_month = p_month;

    IF already_released THEN
        RETURN; -- Nothing to do
    END IF;

    -- NEW: Enforce Date Check (Wait for Cutoff)
    SELECT start_date, end_date INTO target_start, target_end FROM get_cutoff_range(p_year, p_month);
    
    -- If today is BEFORE the start date (the 7th), DO NOT RELEASE.
    IF CURRENT_DATE < target_start THEN
        -- Optional: Raise notice for debug
        -- RAISE NOTICE 'Too early to release %-%. Current: %, Wait for %', p_year, p_month, CURRENT_DATE, target_start;
        RETURN; 
    END IF;

    -- B. Check Eligibility in Prev Period
    SELECT start_date, end_date INTO prev_start, prev_end FROM get_cutoff_range(prev_year, prev_month);

    WITH agent_colls AS (
        SELECT member_id, is_membership_fee, payment_for
        FROM collections
        WHERE agent_id = p_agent_id
          AND date_paid >= prev_start 
          AND date_paid < prev_end
    ),
    stats AS (
        SELECT 
            count(*) filter (where is_membership_fee) as mem_count,
            bool_or(
                exists(
                    select 1 from agent_colls c2 
                    where c2.member_id = agent_colls.member_id 
                    and c2.is_membership_fee != agent_colls.is_membership_fee
                )
            ) as has_mix
        FROM agent_colls
    )
    SELECT (mem_count >= 3 OR has_mix) INTO is_eligible FROM stats;

    IF is_eligible IS NULL THEN is_eligible := false; END IF;

    IF NOT is_eligible THEN
        RETURN; -- Not eligible yet
    END IF;

    -- C. Calculate Receivable for Target Period
    -- (Reuse target_start/end from above)

    SELECT COALESCE(SUM(
        CASE 
            WHEN commission_type IN ('override', 'recruiter_bonus') THEN 
                CASE WHEN override_commission > 0 THEN override_commission ELSE amount END
            WHEN is_receivable THEN amount 
            ELSE 0 
        END
    ), 0)
    INTO receivable_amount
    FROM commissions
    WHERE agent_id = p_agent_id
      AND date_earned >= target_start
      AND date_earned < target_end;

    IF receivable_amount <= 0 THEN
        NULL;
    ELSE
        -- D. UPDATE WALLET
        UPDATE agent_wallets 
        SET balance = balance + receivable_amount, 
            lifetime_commission = lifetime_commission + receivable_amount,
            updated_at = now()
        WHERE agent_id = p_agent_id;

        IF NOT FOUND THEN
             INSERT INTO agent_wallets (agent_id, balance, lifetime_commission) 
             VALUES (p_agent_id, receivable_amount, receivable_amount);
        END IF;
    END IF;

    -- E. Mark Rollup as Released
    INSERT INTO agent_commission_rollups (agent_id, period_year, period_month, status, receivable)
    VALUES (p_agent_id, p_year, p_month, 'released', receivable_amount)
    ON CONFLICT (agent_id, period_year, period_month)
    DO UPDATE SET status = 'released', receivable = EXCLUDED.receivable;

END;
$function$


Function: debug_export_schema
CREATE OR REPLACE FUNCTION public.debug_export_schema()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result text := '';
    r record;
BEGIN
    result := result || E'\n-- === TABLES ===\n';
    FOR r IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
    LOOP
        result := result || 'Table: ' || r.table_name || E'\n';
    END LOOP;

    result := result || E'\n-- === FUNCTIONS ===\n';
    FOR r IN 
        SELECT p.proname as func_name, pg_get_functiondef(p.oid) as def
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
    LOOP
        result := result || 'Function: ' || r.func_name || E'\n';
        result := result || r.def || E'\n\n';
    END LOOP;

    result := result || E'\n-- === TRIGGERS ===\n';
    FOR r IN 
        SELECT event_object_table, trigger_name, action_statement
        FROM information_schema.triggers
        WHERE trigger_schema = 'public'
    LOOP
         result := result || 'Trigger: ' || r.trigger_name || ' ON ' || r.event_object_table || E'\n';
         result := result || r.action_statement || E'\n';
    END LOOP;

    RETURN result;
END;
$function$


Function: finalize_rollup_reset_totals
CREATE OR REPLACE FUNCTION public.finalize_rollup_reset_totals()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Only act when status changes to 'released'
  IF NEW.status = 'released' AND OLD.status <> 'released' THEN
    UPDATE agent_commission_rollups
    SET
      monthly_commission = 0,
      membership_commission = 0,
      override_commission = 0,
      recruiter_bonus = 0,
      grand_total_commission = 0,
      total_collection = 0,
      is_finalized = TRUE,
      updated_at = NOW()
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$function$


Function: whoami
CREATE OR REPLACE FUNCTION public.whoami()
 RETURNS uuid
 LANGUAGE sql
 STABLE
AS $function$ SELECT auth.uid(); $function$


Function: admin_agents_count
CREATE OR REPLACE FUNCTION public.admin_agents_count()
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.is_admin()
              THEN (SELECT COUNT(*) FROM public.agents)
              ELSE 0
         END;
$function$


Function: apply_cutoff_to_collection_month
CREATE OR REPLACE FUNCTION public.apply_cutoff_to_collection_month()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  d date := new.date_paid_date; -- use your column name
  cutoff_month date;
begin
  if d is null then
    return new;
  end if;

  -- 💡 1st–6th of month → previous month; 7th+ → same month
  if extract(day from d) <= 6 then
    cutoff_month := date_trunc('month', d) - interval '1 month';
  else
    cutoff_month := date_trunc('month', d);
  end if;

  -- Store result as YYYY-MM (text)
  new.collection_month := to_char(cutoff_month, 'YYYY-MM');
  return new;
end;
$function$


Function: upsert_commissions_for_collection
CREATE OR REPLACE FUNCTION public.upsert_commissions_for_collection(p_collection_id bigint)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  c RECORD;
  v_monthly_due numeric;
  v_months int;
  v_earned_date date;
BEGIN
  SELECT col.id, col.member_id, col.agent_id, col.date_paid::date AS pay_date,
         col.payment, col.payment_for, col.is_membership_fee
  INTO c
  FROM public.collections col
  WHERE col.id = p_collection_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT m.monthly_due INTO v_monthly_due
  FROM public.members m
  WHERE m.id = c.member_id;

  IF v_monthly_due IS NULL OR v_monthly_due <= 0 THEN
    v_monthly_due := c.payment;
  END IF;

  -- Number of months covered (e.g., advance payment)
  v_months := GREATEST(1, FLOOR(c.payment / v_monthly_due));

  -- ✅ Compute single cutoff period (e.g., Nov 7 - Dec 6 => earned = Nov 7)
  v_earned_date := public.cutoff_period_start(c.pay_date);

  -- 🧹 Remove any old commissions for this collection
  DELETE FROM public.commissions
  WHERE collection_id = c.id
    AND commission_type IN (
      'plan_monthly',
      'travel_allowance',
      'override_asst_supervisor',
      'override_mkt_supervisor',
      'override_mkt_head'
    );

  -- 🧮 Base Monthly Commission (multiply by months but keep same period)
  INSERT INTO public.commissions (
    collection_id, agent_id, member_id, commission_type,
    amount, override_commission,
    monthly_commission_given, travel_allowance_given, override_released,
    date_earned
  )
  VALUES (
    c.id, c.agent_id, c.member_id, 'plan_monthly',
    120.00 * v_months, 0.00,
    FALSE, FALSE, FALSE,
    v_earned_date
  );

  -- 🚌 Travel Allowance (× months, same date)
  INSERT INTO public.commissions (
    collection_id, agent_id, member_id, commission_type,
    amount, override_commission,
    monthly_commission_given, travel_allowance_given, override_released,
    date_earned
  )
  VALUES (
    c.id, c.agent_id, c.member_id, 'travel_allowance',
    30.00 * v_months, 0.00,
    FALSE, FALSE, FALSE,
    v_earned_date
  );

  -- 🧾 Overrides (× months, same date)
  INSERT INTO public.commissions (
    collection_id, agent_id, member_id, commission_type,
    amount, override_commission,
    monthly_commission_given, travel_allowance_given, override_released,
    date_earned
  )
  SELECT
    c.id, h.id, c.member_id, 'override_asst_supervisor',
    0.00, 16.00 * v_months,
    FALSE, FALSE, FALSE,
    v_earned_date
  FROM public.hierarchy_status_view h
  WHERE h.id = c.agent_id AND h.role = 'assistant_supervisor'
  LIMIT 1;

  INSERT INTO public.commissions (
    collection_id, agent_id, member_id, commission_type,
    amount, override_commission,
    monthly_commission_given, travel_allowance_given, override_released,
    date_earned
  )
  SELECT
    c.id, h.id, c.member_id, 'override_mkt_supervisor',
    0.00, 12.00 * v_months,
    FALSE, FALSE, FALSE,
    v_earned_date
  FROM public.hierarchy_status_view h
   WHERE h.id = c.agent_id AND h.role = 'marketing_supervisor'
  LIMIT 1;

  INSERT INTO public.commissions (
    collection_id, agent_id, member_id, commission_type,
    amount, override_commission,
    monthly_commission_given, travel_allowance_given, override_released,
    date_earned
  )
  SELECT
    c.id, h.id, c.member_id, 'override_mkt_head',
    0.00, 8.00 * v_months,
    FALSE, FALSE, FALSE,
    v_earned_date
  FROM public.hierarchy_status_view h
 WHERE h.id = c.agent_id AND h.role = 'marketing_head'
  LIMIT 1;
END;
$function$


Function: trg_set_collection_month
CREATE OR REPLACE FUNCTION public.trg_set_collection_month()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.collection_month := compute_collection_month(NEW.date_paid);
  RETURN NEW;
END;
$function$


Function: log_member_changes
CREATE OR REPLACE FUNCTION public.log_member_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    diff jsonb;
    old_row jsonb;
    new_row jsonb;
    key text;
    val_old jsonb;
    val_new jsonb;
    desc_list text[];
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.audit_logs (table_name, record_id, operation, new_data, changed_by, description)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(NEW)::jsonb, auth.uid(), 'New record created');
        RETURN NEW;

    ELSIF (TG_OP = 'UPDATE') THEN
        IF NEW IS DISTINCT FROM OLD THEN
            old_row := row_to_json(OLD)::jsonb;
            new_row := row_to_json(NEW)::jsonb;
            diff := '{}'::jsonb;
            desc_list := ARRAY[]::text[];

            -- Compare every field
            FOR key IN SELECT jsonb_object_keys(old_row)
            LOOP
                val_old := old_row->key;
                val_new := new_row->key;

                IF val_old IS DISTINCT FROM val_new THEN
                    diff := diff || jsonb_build_object(key, jsonb_build_object('from', val_old, 'to', val_new));
                    -- Human Readable Text
                    desc_list := array_append(desc_list, key || ': ' || COALESCE(val_old::text, 'null') || ' -> ' || COALESCE(val_new::text, 'null'));
                END IF;
            END LOOP;

            IF diff != '{}'::jsonb THEN
                INSERT INTO public.audit_logs (table_name, record_id, operation, old_data, new_data, changed_fields, changed_by, description)
                VALUES (TG_TABLE_NAME, OLD.id, TG_OP, old_row, new_row, diff, auth.uid(), array_to_string(desc_list, ', '));
            END IF;
        END IF;
        RETURN NEW;

    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO public.audit_logs (table_name, record_id, operation, old_data, changed_by, description)
        VALUES (TG_TABLE_NAME, OLD.id, TG_OP, row_to_json(OLD)::jsonb, auth.uid(), 'Record deleted');
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$function$


Function: notify_withdrawal_approved
CREATE OR REPLACE FUNCTION public.notify_withdrawal_approved()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  -- Only notify when status changes TO 'approved'
  if NEW.status = 'approved' and OLD.status is distinct from NEW.status then

    -- Prevent duplicates:
    if not exists (
      select 1 from notifications
      where user_id = (
        select user_id from agents where id = NEW.agent_id
      )
      and type = 'withdrawal_status'
      and message like '%' || NEW.amount || '%'
    ) then

      insert into notifications (
        user_id,
        title,
        message,
        type,
        target_role,
        extra
      )
      select
        a.user_id,
        'Withdrawal Approved',
        'Your withdrawal request for ₱' || NEW.amount || ' (period ' || NEW.period_month || '/' || NEW.period_year || ') has been approved.',
        'withdrawal_status',
        'agent',
        jsonb_build_object(
          'agent_id', NEW.agent_id,
          'amount', NEW.amount
        )
      from agents a
      where a.id = NEW.agent_id;

    end if;

  end if;

  return NEW;
end;
$function$


Function: delete_commissions_on_collection_delete
CREATE OR REPLACE FUNCTION public.delete_commissions_on_collection_delete()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  DELETE FROM commissions WHERE collection_id = OLD.id;
  RETURN OLD;
END;
$function$


Function: get_at_risk_members
CREATE OR REPLACE FUNCTION public.get_at_risk_members()
 RETURNS TABLE(id bigint, maf_no text, last_name text, first_name text, middle_name text, address text, contact_number text, religion text, birth_date date, age integer, monthly_due numeric, plan_type text, contracted_price numeric, date_joined date, balance numeric, gender text, civil_status text, zipcode text, birthplace text, nationality text, height text, weight text, casket_type text, membership text, occupation text, agent_id bigint, status text, plan_start_date date, membership_paid boolean, membership_paid_date date, phone_number text, months_paid bigint, months_since_start double precision, months_behind double precision)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
      m.id, m.maf_no::text, m.last_name::text, m.first_name::text, m.middle_name::text, 
      m.address::text, m.contact_number::text, m.religion::text, m.birth_date, m.age, 
      m.monthly_due, m.plan_type::text, m.contracted_price, m.date_joined, 
      m.balance, m.gender::text, m.civil_status::text, m.zipcode::text, m.birthplace::text, 
      m.nationality::text, m.height::text, m.weight::text, m.casket_type::text, m.membership::text, 
      m.occupation::text, m.agent_id, m.status::text,
      m.plan_start_date,
      m.membership_paid, m.membership_paid_date, m.phone_number::text,
      0::bigint, 
      0::double precision,
      calculate_months_behind_v4(m.id)
  FROM members m
  WHERE calculate_months_behind_v4(m.id) >= 2 
    AND calculate_months_behind_v4(m.id) <= 3
    AND m.balance > 0;
END;
$function$


Function: get_warning_members
CREATE OR REPLACE FUNCTION public.get_warning_members()
 RETURNS TABLE(id bigint, maf_no text, last_name text, first_name text, middle_name text, address text, contact_number text, religion text, birth_date date, age integer, monthly_due numeric, plan_type text, contracted_price numeric, date_joined date, balance numeric, gender text, civil_status text, zipcode text, birthplace text, nationality text, height text, weight text, casket_type text, membership text, occupation text, agent_id bigint, created_at timestamp with time zone, plan_start_date date, phone_number text, months_paid bigint, months_since_start double precision, months_behind double precision)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
      m.id, m.maf_no::text, m.last_name::text, m.first_name::text, m.middle_name::text, 
      m.address::text, m.contact_number::text, m.religion::text, m.birth_date, m.age, 
      m.monthly_due, m.plan_type::text, m.contracted_price, m.date_joined, 
      m.balance, m.gender::text, m.civil_status::text, m.zipcode::text, m.birthplace::text, 
      m.nationality::text, m.height::text, m.weight::text, m.casket_type::text, m.membership::text, 
      m.occupation::text, m.agent_id, 
      m.created_at,
      m.plan_start_date,
      m.phone_number::text,
      0::bigint, 
      0::double precision,
      calculate_months_behind_v4(m.id)
  FROM members m
  WHERE calculate_months_behind_v4(m.id) >= 1 
    AND calculate_months_behind_v4(m.id) < 2
    AND m.balance > 0;
END;
$function$


Function: link_member_user_by_maf
CREATE OR REPLACE FUNCTION public.link_member_user_by_maf(p_user uuid, p_maf text)
 RETURNS void
 LANGUAGE sql
AS $function$
  insert into public.member_users (user_id, member_id)
  select p_user, m.id
  from public.members m
  where lower(m.maf_no) = lower(p_maf)
  on conflict (user_id) do update
    set member_id = excluded.member_id;
$function$


Function: collections_after_write
CREATE OR REPLACE FUNCTION public.collections_after_write()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Call your existing commission logic with the new collection id
  PERFORM public.upsert_commissions_for_collection(NEW.id);
  RETURN NEW;
END;
$function$


Function: email_for_login
CREATE OR REPLACE FUNCTION public.email_for_login(p_identifier text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  out_email text;
BEGIN
  -- If the user typed an email, just use it (normalized)
  IF position('@' in p_identifier) > 0 THEN
    out_email := lower(p_identifier);
    RETURN out_email;
  END IF;

  -- Otherwise, treat it as a username and resolve via users_profile → auth.users
  SELECT lower(u.email) INTO out_email
  FROM public.users_profile up
  JOIN auth.users u ON u.id = up.user_id
  WHERE lower(up.username) = lower(p_identifier)
  LIMIT 1;

  RETURN out_email;  -- may be NULL if no match
END
$function$


Function: get_lapsed_members
CREATE OR REPLACE FUNCTION public.get_lapsed_members()
 RETURNS TABLE(id bigint, maf_no text, last_name text, first_name text, middle_name text, address text, contact_number text, religion text, birth_date date, age integer, monthly_due numeric, plan_type text, contracted_price numeric, date_joined date, balance numeric, gender text, civil_status text, zipcode text, birthplace text, nationality text, height text, weight text, casket_type text, membership text, occupation text, agent_id bigint, created_at timestamp with time zone, plan_start_date date, months_paid bigint, months_since_start double precision, months_behind double precision)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
      m.id, 
      m.maf_no::text, 
      m.last_name::text, 
      m.first_name::text, 
      m.middle_name::text, 
      m.address::text, 
      m.contact_number::text, 
      m.religion::text, 
      m.birth_date, 
      m.age, 
      m.monthly_due, 
      m.plan_type::text, 
      m.contracted_price, 
      m.date_joined, 
      m.balance, 
      m.gender::text, 
      m.civil_status::text, 
      m.zipcode::text, 
      m.birthplace::text, 
      m.nationality::text, 
      m.height::text, 
      m.weight::text, 
      m.casket_type::text, 
      m.membership::text, 
      m.occupation::text, 
      m.agent_id, 
      m.created_at,
      m.plan_start_date,
      0::bigint, 
      0::double precision,
      calculate_months_behind_v4(m.id)
  FROM members m
  WHERE calculate_months_behind_v4(m.id) > 3 AND m.balance > 0;
END;
$function$


Function: get_active_members
CREATE OR REPLACE FUNCTION public.get_active_members()
 RETURNS TABLE(id bigint, maf_no text, last_name text, first_name text, middle_name text, address text, contact_number text, religion text, birth_date date, age integer, monthly_due numeric, plan_type text, contracted_price numeric, date_joined date, balance numeric, gender text, civil_status text, zipcode text, birthplace text, nationality text, height text, weight text, casket_type text, membership text, occupation text, agent_id bigint, created_at timestamp with time zone, plan_start_date date, phone_number text, months_paid bigint, months_since_start double precision, months_behind double precision)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
      m.id, m.maf_no::text, m.last_name::text, m.first_name::text, m.middle_name::text, 
      m.address::text, m.contact_number::text, m.religion::text, m.birth_date, m.age, 
      m.monthly_due, m.plan_type::text, m.contracted_price, m.date_joined, 
      m.balance, m.gender::text, m.civil_status::text, m.zipcode::text, m.birthplace::text, 
      m.nationality::text, m.height::text, m.weight::text, m.casket_type::text, m.membership::text, 
      m.occupation::text, m.agent_id, 
      m.created_at,
      m.plan_start_date,
      m.phone_number::text,
      0::bigint, 
      0::double precision,
      calculate_months_behind_v4(m.id)
  FROM members m
  WHERE calculate_months_behind_v4(m.id) < 1;
END;
$function$


Function: _normalize_maf
CREATE OR REPLACE FUNCTION public._normalize_maf(input text)
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  select regexp_replace(regexp_replace(coalesce(input,''), '[^0-9a-zA-Z]', '', 'g'), '^0+', '');
$function$


Function: lookup_member_v1
CREATE OR REPLACE FUNCTION public.lookup_member_v1(maf_input text, last_input text)
 RETURNS TABLE(id bigint, maf_no text, first_name text, last_name text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select m.id, m.maf_no, m.first_name, m.last_name
  from public.members m
  where
    -- last name case-insensitive (exact-ish)
    m.last_name ilike last_input
    and (
      -- exact maf_no first
      m.maf_no = maf_input
      or m.maf_no = public._normalize_maf(maf_input)
      or public._normalize_maf(m.maf_no) = public._normalize_maf(maf_input)
      or m.maf_no ilike '%' || maf_input || '%'
    )
  order by m.id
  limit 5;
$function$


Function: cutoff_period_start
CREATE OR REPLACE FUNCTION public.cutoff_period_start(pay_date date)
 RETURNS date
 LANGUAGE plpgsql
AS $function$
DECLARE
  start_this_month date := date_trunc('month', pay_date)::date + 6;  -- 7th of this month
  start_prev_month date := (date_trunc('month', pay_date)::date - interval '1 month')::date + 6; -- 7th prev
BEGIN
  IF pay_date >= start_this_month THEN
    RETURN start_this_month;     -- e.g., Nov 7–Nov 30 → Nov 7
  ELSE
    RETURN start_prev_month;     -- e.g., Dec 1–Dec 6 → Nov 7
  END IF;
END
$function$


Function: sync_parent_and_recruiter
CREATE OR REPLACE FUNCTION public.sync_parent_and_recruiter()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Only mirror on INSERT
  IF TG_OP = 'INSERT' THEN
    IF NEW.recruiter_id IS NULL AND NEW.parent_id IS NOT NULL THEN
      NEW.recruiter_id := NEW.parent_id;
    END IF;
    RETURN NEW;
  END IF;

  -- On UPDATE: do not change recruiter_id at all
  RETURN NEW;
END;
$function$


Function: handle_member_reinstatement
CREATE OR REPLACE FUNCTION public.handle_member_reinstatement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_plan_start_date DATE;
  v_monthly_due NUMERIC;
  v_existing_payments_count INTEGER;
  v_months_since_start INTEGER;
  v_months_behind DOUBLE PRECISION;
  v_new_total_payments INTEGER;
BEGIN
  -- 1. Get Member Details
  SELECT plan_start_date, monthly_due
  INTO v_plan_start_date, v_monthly_due
  FROM members
  WHERE id = NEW.member_id;

  -- Safety check
  IF v_plan_start_date IS NULL OR v_monthly_due IS NULL OR v_monthly_due = 0 THEN
    RETURN NEW;
  END IF;

  -- 2. Count EXISTING payments (Excluding this one because it's BEFORE INSERT)
  SELECT COUNT(*)
  INTO v_existing_payments_count
  FROM collections
  WHERE member_id = NEW.member_id;
  
  -- The count determining the new state should include the new payment
  v_new_total_payments := v_existing_payments_count + 1;

  -- 3. Calculate status BEFORE reinstatement
  -- Logic: If they were Lapsed (months_behind > 3) essentially
  -- "Real" months behind calculation considering this payment helps reduce it by 1 conceptually
  
  -- Months since start
  SELECT (
    DATE_PART('year', AGE(CURRENT_DATE, v_plan_start_date)) * 12 +
    DATE_PART('month', AGE(CURRENT_DATE, v_plan_start_date))
  ) INTO v_months_since_start;
  
  -- Months behind (Current state before this payment is effectively applied)
  -- If we want to see if they ARE/WERE Lapsed, we compare (Months Since - Existing Count)
  -- Example: 5 months since start. 0 existing payments. Months Behind = 5. (> 3 Lapsed).
  v_months_behind := v_months_since_start - v_existing_payments_count;

  -- 4. Check if Lapsed trigger condition
  IF v_months_behind > 3 THEN
      -- Reset Plan Start Date
      -- We want to make them "Active" (< 1 month behind).
      -- So we set start date s.t. MonthsSinceStart == NewTotalPayments.
      -- NewStart = Now - NewTotalPayments months.
      UPDATE members
      SET plan_start_date = (CURRENT_DATE - (v_new_total_payments || ' months')::INTERVAL)
      WHERE id = NEW.member_id;
      
      -- MARK THIS PAYMENT AS REINSTATEMENT DIRECTLY
      NEW.is_reinstatement := TRUE;
  END IF;

  RETURN NEW;
END;
$function$


Function: sync_agent_member_links
CREATE OR REPLACE FUNCTION public.sync_agent_member_links()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.agent_id IS NOT NULL THEN
    INSERT INTO public.agent_members(agent_id, member_id)
    VALUES (NEW.agent_id, NEW.id)
    ON CONFLICT (agent_id, member_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$


Function: notify_payout_request
CREATE OR REPLACE FUNCTION public.notify_payout_request()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status = 'unreleased' AND (OLD.status IS NULL OR OLD.status <> 'unreleased') THEN
    INSERT INTO public.notifications (title, message, type, target_role, extra)
    VALUES (
      'Withdrawal Submitted',
      'Your payout request for ' || TO_CHAR(CURRENT_DATE, 'Month YYYY') || ' has been submitted.',
      'payout_request',
      'agent',
      JSONB_BUILD_OBJECT(
        'agent_id', NEW.agent_id,
        'rollup_id', NEW.id
      )
    );
  END IF;
  RETURN NEW;
END;
$function$


Function: notify_admin_on_agent_withdrawal
CREATE OR REPLACE FUNCTION public.notify_admin_on_agent_withdrawal()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  agent_info RECORD;
BEGIN
  IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status = 'unreleased' AND OLD.status IS DISTINCT FROM 'unreleased')) THEN
    SELECT
      firstname,
      lastname,
      gcash_number,
      gcash_qr
    INTO agent_info
    FROM public.agents
    WHERE id = NEW.agent_id;

    INSERT INTO public.notifications (
      title,
      message,
      type,
      target_role,
      extra
    )
    VALUES (
      'Withdrawal Request Submitted',
      agent_info.firstname || ' ' || agent_info.lastname || ' has requested a payout.',
      'payout_request',
      'admin',
      jsonb_build_object(
        'agent_id', NEW.agent_id,
        'agent_name', agent_info.firstname || ' ' || agent_info.lastname,
        'gcash_number', agent_info.gcash_number,
        'gcash_qr', agent_info.gcash_qr,
        'rollup_id', NEW.id
      )
    );
  END IF;
  RETURN NEW;
END;
$function$


Function: recompute_recruiter_bonus
CREATE OR REPLACE FUNCTION public.recompute_recruiter_bonus()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  r RECORD;
BEGIN
  -- 1️⃣ Reset recruiter bonus for all UNRELEASED rows
  UPDATE agent_commission_rollups
  SET recruiter_bonus = 0
  WHERE status <> 'released';

  -- 2️⃣ For each recruiter, sum DOWNLINE commissions per period
  FOR r IN
    SELECT
      recruiter.id AS recruiter_id,
      child_roll.period_year,
      child_roll.period_month,
      SUM(
        COALESCE(child_roll.monthly_commission, 0)
        + COALESCE(child_roll.membership_commission, 0)
        + COALESCE(child_roll.override_commission, 0)
      ) AS base_total
    FROM agents child
    JOIN agents recruiter
      ON child.recruiter_id = recruiter.id       -- 🔴 recruiter gets 10% of this child
    JOIN agent_commission_rollups child_roll
      ON child_roll.agent_id = child.id
    WHERE child_roll.status <> 'released'        -- only active / unreleased periods
    GROUP BY
      recruiter.id,
      child_roll.period_year,
      child_roll.period_month
  LOOP
    -- 3️⃣ Set recruiter_bonus = 10% of downline base total for that period
    UPDATE agent_commission_rollups parent_roll
    SET recruiter_bonus = ROUND(r.base_total * 0.10, 2)
    WHERE parent_roll.agent_id    = r.recruiter_id
      AND parent_roll.period_year = r.period_year
      AND parent_roll.period_month= r.period_month
      AND parent_roll.status <> 'released';
  END LOOP;

  -- 4️⃣ Recompute grand_total_commission AFTER recruiter_bonus
  UPDATE agent_commission_rollups
  SET grand_total_commission =
        COALESCE(monthly_commission, 0)
      + COALESCE(membership_commission, 0)
      + COALESCE(override_commission, 0)
      + COALESCE(recruiter_bonus, 0)
  WHERE status <> 'released';
END;
$function$


Function: rebuild_all_agent_commission_rollups
CREATE OR REPLACE FUNCTION public.rebuild_all_agent_commission_rollups(p_period_date date)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    yr  INT := EXTRACT(YEAR FROM p_period_date);
    mo  INT := EXTRACT(MONTH FROM p_period_date);
BEGIN
    -- DELETE old rollups for this period
    DELETE FROM agent_commission_rollups
    WHERE period_year = yr AND period_month = mo;

    -------------------------------------------------------------------------
    -- 1️⃣ REBUILD BASE COMMISSIONS (monthly + travel + membership + overrides)
    -------------------------------------------------------------------------
    INSERT INTO agent_commission_rollups (
        agent_id,
        period_year,
        period_month,
        monthly_commission,
        membership_commission,
        override_commission,
        recruiter_bonus,
        grand_total_commission,
        total_collection,
        is_finalized,
        status,
        computed_at,
        updated_at
    )
    SELECT
        c.agent_id,
        yr,
        mo,

        -- MONTHLY (plan_monthly + travel_allowance)
        SUM(
            CASE 
              WHEN c.commission_type IN ('plan_monthly') THEN c.amount
              WHEN c.commission_type = 'travel_allowance' THEN c.amount
              ELSE 0
            END
        ) AS monthly_total,

        -- MEMBERSHIP
        SUM(
            CASE
              WHEN c.commission_type IN ('membership_outright','membership_monthly')
              THEN c.amount ELSE 0
            END
        ) AS membership_total,

        -- OVERRIDES
        SUM(
            CASE 
              WHEN c.commission_type IN (
                    'override_asst_supervisor',
                    'override_mkt_supervisor',
                    'override_mkt_head'
                  )
              THEN COALESCE(c.override_commission,0)
              ELSE 0
            END
        ) AS override_total,

        -- recruiter_bonus (TEMP = 0; will compute in step 2)
        0 AS recruiter_bonus,

        -- GRAND TOTAL
        SUM(
            CASE 
              WHEN c.commission_type IN (
                  'plan_monthly','travel_allowance',
                  'membership_outright','membership_monthly')
              THEN c.amount

              WHEN c.commission_type IN (
                    'override_asst_supervisor',
                    'override_mkt_supervisor',
                    'override_mkt_head')
              THEN COALESCE(c.override_commission,0)

              ELSE 0
            END
        ) AS grand_total,

        -- COLLECTION TOTAL
        (
          SELECT COALESCE(SUM(col.payment),0)
          FROM collections col
          WHERE col.agent_id = c.agent_id
            AND EXTRACT(YEAR FROM col.date_paid_date) = yr
            AND (
                (EXTRACT(DAY FROM col.date_paid_date) <= 6 AND mo = EXTRACT(MONTH FROM col.date_paid_date - INTERVAL '1 month'))
                OR
                (EXTRACT(DAY FROM col.date_paid_date) > 6 AND mo = EXTRACT(MONTH FROM col.date_paid_date))
            )
        ),

        FALSE,
        'unreleased',
        NOW(),
        NOW()
    FROM commissions c
    WHERE c.period_year = yr
      AND c.period_month = mo
    GROUP BY c.agent_id;

    -------------------------------------------------------------------------
    -- 2️⃣ APPLY RECRUITER BONUS (10% of downline's total commissions)
    -------------------------------------------------------------------------
    UPDATE agent_commission_rollups r
    SET recruiter_bonus =
    (
        SELECT COALESCE(ROUND(SUM(child.grand_total_commission) * 0.10, 2), 0)
        FROM agent_commission_rollups child
        JOIN agents a ON child.agent_id = a.id
        WHERE a.recruiter_id = r.agent_id
          AND child.period_year  = yr
          AND child.period_month = mo
    ),
    updated_at = NOW();

    -------------------------------------------------------------------------
    -- 3️⃣ FINALIZE grand_total (monthly + membership + override + recruiter)
    -------------------------------------------------------------------------
    UPDATE agent_commission_rollups
    SET grand_total_commission =
        monthly_commission +
        membership_commission +
        override_commission +
        recruiter_bonus,
        updated_at = NOW()
    WHERE period_year = yr AND period_month = mo;

END;
$function$


Function: compute_collection_month
CREATE OR REPLACE FUNCTION public.compute_collection_month(p_date date)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
BEGIN
  IF EXTRACT(day FROM p_date) >= 7 THEN
    RETURN to_char(p_date, 'YYYY-MM');
  END IF;
  RETURN to_char((p_date - INTERVAL '1 month'), 'YYYY-MM');
END;
$function$


Function: propagate_agent_update
CREATE OR REPLACE FUNCTION public.propagate_agent_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.agent_id IS DISTINCT FROM OLD.agent_id THEN
    -- Update collections
    UPDATE collections
    SET agent_id = NEW.agent_id
    WHERE member_id = NEW.id;

    -- Update commissions
    UPDATE commissions
    SET agent_id = NEW.agent_id
    WHERE member_id = NEW.id;

    -- Optionally, also soa_transactions if you want consistency
    UPDATE soa_transactions
    SET agent_id = NEW.agent_id
    WHERE member_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$function$


Function: sync_soa_transactions
CREATE OR REPLACE FUNCTION public.sync_soa_transactions()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- 🧹 Remove any existing SOA entry linked to this collection
  DELETE FROM public.soa_transactions
  WHERE collection_id = NEW.id;

  -- 🧾 Only insert if payment and member_id exist
  IF NEW.payment IS NOT NULL AND NEW.member_id IS NOT NULL THEN
    INSERT INTO public.soa_transactions (
      member_id,
      date,
      amount,
      plan_type,
      or_no,
      payment_for,
      is_membership_fee,
      agent_id,
      collection_id
    )
    VALUES (
      NEW.member_id,
      COALESCE(NEW.date_paid::date, CURRENT_DATE),
      NEW.payment,
      NEW.plan_type,
      NEW.or_no,
      COALESCE(NEW.payment_for, CASE WHEN NEW.is_membership_fee THEN 'Membership' ELSE 'Regular' END),
      NEW.is_membership_fee,
      NEW.agent_id,
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$function$


Function: refresh_all_agent_rollups__deprecated
CREATE OR REPLACE FUNCTION public.refresh_all_agent_rollups__deprecated()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO agent_commission_rollups (
    agent_id,
    period_year,
    period_month,
    monthly_commission,
    membership_commission,
    override_commission,
    grand_total_commission,
    recruiter_bonus,
    total_collection,
    status,
    is_finalized,
    computed_at,
    updated_at
  )
  SELECT
    c.agent_id,
    EXTRACT(YEAR FROM c.date_earned)::INT,
    CASE
      WHEN EXTRACT(DAY FROM c.date_earned) <= 6 THEN (EXTRACT(MONTH FROM c.date_earned - INTERVAL '1 month'))::INT
      ELSE (EXTRACT(MONTH FROM c.date_earned))::INT
    END,
    -- 🧮 Monthly (plan + travel)
    SUM(CASE WHEN c.commission_type IN ('plan_monthly','travel_allowance') THEN c.amount ELSE 0 END),
    -- 🧾 Membership
    SUM(CASE WHEN c.commission_type IN ('membership_outright','membership_monthly') THEN c.amount ELSE 0 END),
    -- 🧍 Overrides
    SUM(CASE WHEN c.commission_type IN ('override_asst_supervisor','override_mkt_supervisor','override_mkt_head')
             THEN COALESCE(c.override_commission,0) ELSE 0 END),
    -- 💵 Grand Total
    SUM(
      CASE
        WHEN c.commission_type IN ('plan_monthly','travel_allowance','membership_outright','membership_monthly')
          THEN c.amount
        WHEN c.commission_type IN ('override_asst_supervisor','override_mkt_supervisor','override_mkt_head')
          THEN COALESCE(c.override_commission,0)
        ELSE 0
      END
    ),
    -- 🧠 Recruiter Bonus (10% of grand total)
    ROUND(
      SUM(
        CASE
          WHEN c.commission_type IN ('plan_monthly','travel_allowance','membership_outright','membership_monthly')
            THEN c.amount
          WHEN c.commission_type IN ('override_asst_supervisor','override_mkt_supervisor','override_mkt_head')
            THEN COALESCE(c.override_commission,0)
          ELSE 0
        END
      ) * 0.10, 2
    ),
    -- 💰 Total Collection
    (SELECT COALESCE(SUM(payment),0)
       FROM collections col
      WHERE col.agent_id = c.agent_id
        AND EXTRACT(YEAR FROM col.date_paid_date) = EXTRACT(YEAR FROM c.date_earned)
        AND EXTRACT(MONTH FROM col.date_paid_date) = EXTRACT(MONTH FROM c.date_earned)),
    'unreleased',
    FALSE,
    NOW(),
    NOW()
  FROM commissions c
  WHERE c.date_earned IS NOT NULL
  GROUP BY c.agent_id,
           EXTRACT(YEAR FROM c.date_earned),
           CASE
             WHEN EXTRACT(DAY FROM c.date_earned) <= 6 THEN (EXTRACT(MONTH FROM c.date_earned - INTERVAL '1 month'))
             ELSE (EXTRACT(MONTH FROM c.date_earned))
           END
  ON CONFLICT (agent_id, period_year, period_month)
  DO UPDATE
  SET
    monthly_commission      = EXCLUDED.monthly_commission,
    membership_commission   = EXCLUDED.membership_commission,
    override_commission     = EXCLUDED.override_commission,
    grand_total_commission  = EXCLUDED.grand_total_commission,
    recruiter_bonus         = EXCLUDED.recruiter_bonus,
    total_collection        = EXCLUDED.total_collection,
    computed_at             = NOW(),
    updated_at              = NOW()
  WHERE agent_commission_rollups.status <> 'released';
END;
$function$


Function: sync_agent_wallet_from_rollup
CREATE OR REPLACE FUNCTION public.sync_agent_wallet_from_rollup()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE agent_wallets w
  SET balance = w.balance + NEW.grand_total_commission,
      lifetime_commission = w.lifetime_commission + NEW.grand_total_commission,
      updated_at = now()
  WHERE w.agent_id = NEW.agent_id;

  RETURN NEW;
END;
$function$


Function: rebuild_rollup_for_period
CREATE OR REPLACE FUNCTION public.rebuild_rollup_for_period(p_agent_id integer, p_date date)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    yr int;
    mo int;

    v_monthly numeric := 0;
    v_membership numeric := 0;
    v_override numeric := 0;

    v_grand_total numeric := 0;
    v_recruiter_bonus numeric := 0;
BEGIN
    -- Extract year and month
    yr := EXTRACT(YEAR FROM p_date);
    mo := EXTRACT(MONTH FROM p_date);

    --------------------------------------------------------------------
    -- 1. Compute MONTHLY (includes travel allowance)
    --------------------------------------------------------------------
    SELECT
        COALESCE(SUM(CASE WHEN commission_type = 'plan_monthly'
                           THEN amount ELSE 0 END), 0)
        +
        COALESCE(SUM(CASE WHEN commission_type = 'travel_allowance'
                           THEN amount ELSE 0 END), 0)
    INTO v_monthly
    FROM commissions
    WHERE agent_id = p_agent_id
      AND period_year = yr
      AND period_month = mo;

    --------------------------------------------------------------------
    -- 2. Compute MEMBERSHIP COMMISSION
    --------------------------------------------------------------------
    SELECT
        COALESCE(SUM(CASE WHEN commission_type IN ('membership_monthly','membership_outright')
                           THEN amount ELSE 0 END), 0)
    INTO v_membership
    FROM commissions
    WHERE agent_id = p_agent_id
      AND period_year = yr
      AND period_month = mo;

    --------------------------------------------------------------------
    -- 3. Compute OVERRIDE COMMISSION
    --------------------------------------------------------------------
    SELECT
        COALESCE(SUM(CASE WHEN commission_type LIKE 'override_%'
                           THEN amount ELSE 0 END), 0)
    INTO v_override
    FROM commissions
    WHERE agent_id = p_agent_id
      AND period_year = yr
      AND period_month = mo;

    --------------------------------------------------------------------
    -- 4. Compute GRAND TOTAL (WITHOUT recruiter bonus)
    --------------------------------------------------------------------
    v_grand_total := v_monthly + v_membership + v_override;

    --------------------------------------------------------------------
    -- 5. Compute RECRUITER BONUS (10% of child’s total)
    --------------------------------------------------------------------
    SELECT
        COALESCE(SUM(grand_total_commission) * 0.10, 0)
    INTO v_recruiter_bonus
    FROM agent_commission_rollups
    WHERE recruiter_id = p_agent_id
      AND period_year = yr
      AND period_month = mo;

    --------------------------------------------------------------------
    -- 6. Update agent_commission_rollups
    --------------------------------------------------------------------
    UPDATE agent_commission_rollups
    SET
        monthly_commission     = v_monthly,
        membership_commission  = v_membership,
        override_commission    = v_override,
        grand_total_commission = v_grand_total,
        recruiter_bonus        = v_recruiter_bonus,
        updated_at             = NOW()
    WHERE agent_id = p_agent_id
      AND period_year = yr
      AND period_month = mo;

END $function$


Function: check_agr_eligibility
CREATE OR REPLACE FUNCTION public.check_agr_eligibility(p_agent_id bigint, p_year integer, p_month integer)
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
  v_membership_count int;
  v_has_mixed_payment boolean;
BEGIN
  -- 1. Determine Previous Month (The Qualification Period)
  -- For Target Month M, we need to qualify in Month M-1
  v_prev_year := p_year;
  v_prev_month := p_month - 1;
  
  IF v_prev_month = 0 THEN
    v_prev_month := 12;
    v_prev_year := p_year - 1;
  END IF;

  -- 2. Calculate Cutoff Dates (7th of Prev Month to 7th of Prev Month + 1)
  -- Example: Target Feb (2) -> Qualify Jan (1) -> Use Jan 7 to Feb 7
  -- make_date(year, month, day)
  
  -- Handle December rollover for end date
  IF v_prev_month = 12 THEN
     v_start_date := make_date(v_prev_year, v_prev_month, 7);
     v_end_date := make_date(v_prev_year + 1, 1, 7);
  ELSE
     v_start_date := make_date(v_prev_year, v_prev_month, 7);
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
      COALESCE(SUM(membership_count), 0) as total_memberships,
      BOOL_OR(has_membership AND has_regular) as has_mixed_payment
    FROM grouped_members
  )
  SELECT 
    total_memberships,
    COALESCE(has_mixed_payment, false)
  INTO 
    v_membership_count,
    v_has_mixed_payment
  FROM global_stats;

  -- Logic: >= 3 Membership Fees OR (1 Membership + 1 Regular)
  v_is_eligible := (COALESCE(v_membership_count, 0) >= 3) OR COALESCE(v_has_mixed_payment, false);

  RETURN v_is_eligible;
END;
$function$


Function: admin_list_agents
CREATE OR REPLACE FUNCTION public.admin_list_agents(p_search text DEFAULT NULL::text, p_from integer DEFAULT 0, p_to integer DEFAULT 99)
 RETURNS SETOF agents
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Only allow if caller is admin
  SELECT *
  FROM public.agents a
  WHERE public.is_admin()
    AND (
      p_search IS NULL
      OR a.firstname  ILIKE '%' || p_search || '%'
      OR a.lastname   ILIKE '%' || p_search || '%'
      OR a.middlename ILIKE '%' || p_search || '%'
    )
  ORDER BY a.created_at DESC
  OFFSET p_from
  LIMIT GREATEST(p_to - p_from + 1, 0);
$function$


Function: get_collections_by_month
CREATE OR REPLACE FUNCTION public.get_collections_by_month(target_month text)
 RETURNS TABLE(id integer, maf_no text, last_name text, first_name text, address text, plan_type text, or_no text, payment_for text, payment numeric, date_paid_date date, collection_month text)
 LANGUAGE sql
AS $function$
  select c.id,
         c.maf_no,
         c.last_name,
         c.first_name,
         c.address,
         c.plan_type,
         c.or_no,
         c.payment_for,
         c.payment,
         c.date_paid_date,
         c.collection_month
  from collections c
  where c.collection_month = target_month
  order by c.date_paid_date desc;
$function$


Function: notify_payout_released
CREATE OR REPLACE FUNCTION public.notify_payout_released()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status = 'released' AND OLD.status <> 'released' THEN
    INSERT INTO public.notifications (title, message, type, target_role, extra)
    VALUES (
      'Withdrawal Released',
      'Your payout for ' || TO_CHAR(CURRENT_DATE, 'Month YYYY') || ' has been released successfully!',
      'payout_released',
      'agent',
      JSONB_BUILD_OBJECT(
        'agent_id', NEW.agent_id,
        'rollup_id', NEW.id,
        'amount', NEW.grand_total_commission
      )
    );
  END IF;
  RETURN NEW;
END;
$function$


Function: create_wallet_for_new_agent
CREATE OR REPLACE FUNCTION public.create_wallet_for_new_agent()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    INSERT INTO public.agent_wallets (agent_id, balance, lifetime_commission, updated_at)
    VALUES (NEW.id, 0, 0, now())
    ON CONFLICT (agent_id) DO NOTHING;
    RETURN NEW;
END;
$function$


Function: sync_soa_transaction
CREATE OR REPLACE FUNCTION public.sync_soa_transaction()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO soa_transactions (
    member_id,
    date,
    amount,
    plan_type,
    or_no,
    payment_for,
    is_membership_fee
  )
  VALUES (
    NEW.member_id,
    NEW.date_paid,
    NEW.payment,
    NEW.plan_type,
    NEW.or_no,
    NEW.payment_for,
    NEW.is_membership_fee
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$


Function: set_collection_month
CREATE OR REPLACE FUNCTION public.set_collection_month()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Use the real payment date as basis
  IF EXTRACT(DAY FROM NEW.date_paid_date) <= 6 THEN
    -- Anything on or before the 6th → previous month
    NEW.collection_month := to_char((NEW.date_paid_date - interval '1 month'), 'YYYY-MM');
  ELSE
    -- Anything after the 6th → current month
    NEW.collection_month := to_char(NEW.date_paid_date, 'YYYY-MM');
  END IF;

  RETURN NEW;
END;
$function$


Function: is_admin
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.users_profile p
    WHERE p.user_id = auth.uid()
      AND p.role::text = 'admin'  -- <- compare ENUM as text
  );
$function$


Function: is_agent
CREATE OR REPLACE FUNCTION public.is_agent()
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select exists (
    select 1 from public.users_profile
    where user_id = auth.uid() and role = 'agent'
  );
$function$


Function: is_member
CREATE OR REPLACE FUNCTION public.is_member()
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select exists (
    select 1 from public.users_profile
    where user_id = auth.uid() and role = 'member'
  );
$function$


Function: set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at := now();
  return new;
end $function$


Function: touch_updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin new.updated_at := now(); return new; end $function$


Function: notify_admin_on_payout_request
CREATE OR REPLACE FUNCTION public.notify_admin_on_payout_request()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  agent_rec RECORD;
BEGIN
  -- only trigger when a new unreleased payout request is created
  IF NEW.status = 'unreleased' AND (OLD.status IS NULL OR OLD.status <> 'unreleased') THEN
    SELECT firstname, lastname, gcash_number, gcash_qr
    INTO agent_rec
    FROM public.agents
    WHERE id = NEW.agent_id;

    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      type,
      target_role,
      extra
    )
    VALUES (
      NULL, -- no specific user, sent to admin
      'New Withdrawal Request',
      agent_rec.firstname || ' ' || agent_rec.lastname || ' requested a payout.',
      'payout_request',
      'admin',
      jsonb_build_object(
        'agent_name', agent_rec.firstname || ' ' || agent_rec.lastname,
        'gcash_number', agent_rec.gcash_number,
        'gcash_qr', agent_rec.gcash_qr
      )
    );
  END IF;
  RETURN NEW;
END;
$function$


Function: notify_agent_on_payout_release
CREATE OR REPLACE FUNCTION public.notify_agent_on_payout_release()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  agent_rec RECORD;
BEGIN
  -- Only trigger when status becomes 'released'
  IF (TG_OP = 'UPDATE' AND NEW.status = 'released' AND (OLD.status IS DISTINCT FROM 'released')) THEN
    -- Get agent info
    SELECT firstname, lastname
    INTO agent_rec
    FROM public.agents
    WHERE id = NEW.agent_id;

    -- Insert notification for the agent
    INSERT INTO public.notifications (
      title,
      message,
      type,
      target_role,
      extra
    )
    VALUES (
      'Withdrawal Released',
      'Your payout has been released successfully by the Admin.',
      'payout_released',
      'agent',
      jsonb_build_object(
        'agent_id', NEW.agent_id,
        'agent_name', agent_rec.firstname || ' ' || agent_rec.lastname,
        'rollup_id', NEW.id,
        'amount', NEW.grand_total_commission
      )
    );
  END IF;

  RETURN NEW;
END;
$function$


Function: sync_position_and_role
CREATE OR REPLACE FUNCTION public.sync_position_and_role()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Normalize case (avoid "agent" vs "AGENT" mismatch)
  IF NEW.position IS NOT NULL THEN
    NEW.position := INITCAP(LOWER(NEW.position));
  END IF;

  -- Assign role code based on position
  CASE
    WHEN UPPER(NEW.position) = 'AGENT' THEN
      NEW.hier_role := 'SE';
    WHEN UPPER(NEW.position) = 'ASSISTANT SUPERVISOR' THEN
      NEW.hier_role := 'AS';
    WHEN UPPER(NEW.position) = 'MARKETING SUPERVISOR' THEN
      NEW.hier_role := 'MS';
    WHEN UPPER(NEW.position) = 'MARKETING HEAD' THEN
      NEW.hier_role := 'MH';
    ELSE
      -- For any unexpected or null position, default to NULL
      NEW.hier_role := NULL;
  END CASE;

  RETURN NEW;
END;
$function$


Function: withdraw_commission
CREATE OR REPLACE FUNCTION public.withdraw_commission(p_agent_id bigint, p_amount numeric, p_method text DEFAULT 'Gcash'::text, p_notes text DEFAULT ''::text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_balance numeric;
  v_month int;
  v_year int;
  
  -- Deductions
  v_tax numeric;
  v_fee numeric := 50; -- Fixed processing fee
  v_net numeric;
  v_request_id bigint; -- To store the new request ID
BEGIN
  -- 1. Check current balance
  SELECT balance INTO v_balance
  FROM agent_wallets
  WHERE agent_id = p_agent_id;

  IF v_balance IS NULL OR v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient funds (You requested %, but only have %)', p_amount, COALESCE(v_balance, 0);
  END IF;

  -- 1.5. CHECK FOR EXISTING PENDING REQUESTS (Anti-Spam / Single Request Rule)
  IF EXISTS (SELECT 1 FROM withdrawal_requests WHERE agent_id = p_agent_id AND status = 'pending') THEN
    RAISE EXCEPTION 'You already have a pending withdrawal request. Please wait for it to be processed.';
  END IF;

  -- 2. Calculate Deductions
  -- Tax is 10% of the GROSS withdrawal amount
  v_tax := p_amount * 0.10;
  
  -- Net is Amount - Tax - Fee
  v_net := p_amount - v_tax - v_fee;

  IF v_net < 0 THEN
    RAISE EXCEPTION 'Withdrawal amount too low to cover fees and tax.';
  END IF;

  -- 3. Determine current period
  v_month := EXTRACT(MONTH FROM NOW());
  v_year := EXTRACT(YEAR FROM NOW());

  -- 4. Deduct TOTAL GROSS AMOUNT from wallet
  UPDATE agent_wallets
  SET balance = balance - p_amount
  WHERE agent_id = p_agent_id;

  -- 5. Create Withdrawal Request (Capture ID)
  -- UPDATED: 'amount' column now stores NET (Receivable) amount.
  -- 'gross_amount' stores the original requested amount.
  INSERT INTO withdrawal_requests (
    agent_id, 
    amount,        -- NET Amount (Payable)
    gross_amount,  -- Gross Amount
    tax,           -- 10%
    fee,           -- 50
    net_amount,    -- (Redundant now, but keeping for compatibility)
    period_month, 
    period_year, 
    status, 
    withdrawal_method, 
    notes,         -- NEW
    created_at
  )
  VALUES (
    p_agent_id, 
    v_net,         -- Store NET here
    p_amount,      -- Store GROSS here
    v_tax,
    v_fee,
    v_net,
    v_month, 
    v_year, 
    'pending', 
    p_method,      
    p_notes,       -- NEW
    NOW()
  )
  RETURNING id INTO v_request_id;

  -- 6. Insert into Fees Log
  INSERT INTO withdrawal_fees_log (
    withdrawal_request_id,
    agent_id,
    processing_fee,
    tax,
    total_deduction
  )
  VALUES (
    v_request_id,
    p_agent_id,
    v_fee,
    v_tax,
    v_fee + v_tax
  );

END;
$function$


Function: check_agent_commission_status
CREATE OR REPLACE FUNCTION public.check_agent_commission_status()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  agent RECORD;
  v_is_eligible BOOLEAN;
  v_target_date DATE;
  v_target_year INT;
  v_target_month INT;
BEGIN
  -- We are checking NOW (Current Month) to see if they qualify for THIS Month's commission.
  -- Example:
  --   Today is Feb 7 (Month 2). We want to know if we Qualified for Feb Commissions.
  --   We call check_agr_eligibility(..., Year, 2).
  --   Internally, it checks Month 2-1 = Month 1 (Jan 7 - Feb 7) performance.
  
  v_target_date := CURRENT_DATE;
  v_target_year := EXTRACT(YEAR FROM v_target_date)::INT;
  v_target_month := EXTRACT(MONTH FROM v_target_date)::INT;

  FOR agent IN 
    SELECT id, user_id FROM agents
  LOOP

    -- 🔍 CALL THE SHARED LOGIC
    v_is_eligible := public.check_agr_eligibility(agent.id, v_target_year, v_target_month);

    /* -----------------------------
       INSERT NOTIFICATION
       (Only insert if user_id exists)
    ------------------------------*/
    IF agent.user_id IS NOT NULL THEN
        IF v_is_eligible THEN

          INSERT INTO notifications (title, message, type, user_id, created_at)
          VALUES (
            'Commission Qualified',
            'Congratulations! You are qualified to receive a commission next month!',
            'commission_status',
            agent.user_id,
            NOW()
          );

        ELSE

          INSERT INTO notifications (title, message, type, user_id, created_at)
          VALUES (
            'Commission Not Qualified',
            'You are not yet qualified. Please complete AGR requirements before the cut-off.',
            'commission_status',
            agent.user_id,
            NOW()
          );

        END IF;
    END IF;

  END LOOP;
END;
$function$


Function: rebuild_rollups_for_month
CREATE OR REPLACE FUNCTION public.rebuild_rollups_for_month(p_year integer, p_month integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    aid int;
    start_date date;
BEGIN
    -- The period date = {year}-{month}-07 (cutoff start)
    start_date := make_date(p_year, p_month, 7);

    RAISE NOTICE 'Rebuilding rollups for %-% (cutoff start %)', p_year, p_month, start_date;

    -- Loop through ALL agents
    FOR aid IN SELECT id FROM agents ORDER BY id LOOP
        RAISE NOTICE '  → Rebuilding for agent %', aid;

        -- Recompute his commissions for this period
        PERFORM rebuild_rollup_for_period(aid, start_date);

        -- Mark the row as unreleased (fresh rebuild needs manual release)
        UPDATE agent_commission_rollups
        SET status = 'unreleased',
            is_finalized = FALSE,
            computed_at = NOW()
        WHERE agent_id = aid
          AND period_year = p_year
          AND period_month = p_month;
    END LOOP;

    -- After reconstructing all direct commissions,
    -- REBUILD RECRUITER BONUSES (parent earns 10% of child's total)
    RAISE NOTICE 'Recomputing recruiter bonuses…';

    UPDATE agent_commission_rollups parent
    SET recruiter_bonus = sub.tot * 0.10,
        grand_total_commission = 
            (parent.monthly_commission +
             parent.membership_commission +
             parent.override_commission +
             (sub.tot * 0.10))
    FROM (
        SELECT 
            c.parent_id AS parent_id,
            c.period_year,
            c.period_month,
            SUM(c.grand_total_commission) AS tot
        FROM agent_commission_rollups c
        JOIN agents a ON c.agent_id = a.id
        WHERE c.period_year = p_year
          AND c.period_month = p_month
          AND a.parent_id IS NOT NULL
        GROUP BY 1,2,3
    ) sub
    WHERE parent.agent_id = sub.parent_id
      AND parent.period_year = sub.period_year
      AND parent.period_month = sub.period_month;

    RAISE NOTICE 'Rebuild finished.';
END $function$


Function: credit_wallet_from_rollup
CREATE OR REPLACE FUNCTION public.credit_wallet_from_rollup(p_agent_id bigint, p_period_year integer, p_period_month integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  v_amount numeric;
begin
  select grand_total_commission
  into v_amount
  from agent_commission_rollups
  where agent_id = p_agent_id
    and period_year = p_period_year
    and period_month = p_period_month
    and is_finalized = true;

  if v_amount is null then
    return;
  end if;

  insert into agent_wallets (agent_id, balance)
  values (p_agent_id, v_amount)
  on conflict (agent_id)
  do update set balance = agent_wallets.balance + excluded.balance,
               updated_at = now();
end;
$function$


Function: set_default_role_se
CREATE OR REPLACE FUNCTION public.set_default_role_se()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  -- If role is NULL or empty, set to SE
  if new.role is null or new.role = '' then
    new.role := 'SE';
  end if;

  return new;
end;
$function$


Function: auto_mark_membership_paid
CREATE OR REPLACE FUNCTION public.auto_mark_membership_paid()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Check if this collection is a membership payment
  IF NEW.is_membership_fee = TRUE OR LOWER(NEW.payment_for) = 'membership' THEN
    UPDATE members
    SET membership_paid = TRUE
    WHERE id = NEW.member_id;
  END IF;
  RETURN NEW;
END;
$function$


Function: global_agent_auto_update
CREATE OR REPLACE FUNCTION public.global_agent_auto_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- 1️⃣ Hierarchy sync (recruiter / parent)
  IF NEW.recruiter_id IS DISTINCT FROM OLD.recruiter_id
     OR NEW.parent_id IS DISTINCT FROM OLD.parent_id THEN

    UPDATE agents
      SET recruiter_id = NEW.recruiter_id
      WHERE recruiter_id = OLD.id;

    UPDATE agents
      SET parent_id = NEW.parent_id
      WHERE parent_id = OLD.id;

    UPDATE commissions
      SET recruiter_id = NEW.recruiter_id
      WHERE recruiter_id = OLD.id;
  END IF;

  -- 2️⃣ Identity & position updates (no status)
  IF (NEW.firstname IS DISTINCT FROM OLD.firstname)
     OR (NEW.lastname  IS DISTINCT FROM OLD.lastname)
     OR (NEW.position  IS DISTINCT FROM OLD.position) THEN

  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$function$


Function: trigger_auto_promote
CREATE OR REPLACE FUNCTION public.trigger_auto_promote()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Check the new agent
    PERFORM auto_promote_agent(NEW.id);

    -- Also check the recruiter (promotion cascade)
    IF NEW.recruiter_id IS NOT NULL THEN
        PERFORM auto_promote_agent(NEW.recruiter_id);
    END IF;

    RETURN NEW;
END;
$function$


Function: handle_collection_commissions
CREATE OR REPLACE FUNCTION public.handle_collection_commissions()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_member          RECORD;
  v_plan            RECORD;

  v_monthly_due     NUMERIC := 0;
  v_monthly_comm    NUMERIC := 0;
  v_outright_comm   NUMERIC := 0;

  v_total_before    NUMERIC := 0;
  v_install_before  INTEGER := 0;
  v_full_months     INTEGER := 0;
  v_install_now     INTEGER := 0;

  v_date_earned     DATE;
  v_py              INTEGER;
  v_pm              INTEGER;

  v_recruiter_id    BIGINT;
  v_recruit_bonus   NUMERIC := 0;

  upline            BIGINT;
  role_text         TEXT;

  as_id             BIGINT := NULL;
  ms_id             BIGINT := NULL;
  mh_id             BIGINT := NULL;
BEGIN
  --------------------------------------------------------------------
  -- 0. VALIDATE
  --------------------------------------------------------------------
  IF NEW.member_id IS NULL OR NEW.agent_id IS NULL THEN
    RETURN NEW;
  END IF;

  --------------------------------------------------------------------
  -- 1. LOAD MEMBER + PLAN
  --------------------------------------------------------------------
  SELECT * INTO v_member
  FROM members WHERE id = NEW.member_id;

  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT * INTO v_plan
  FROM plan_commission_map
  WHERE UPPER(plan_type) = UPPER(v_member.plan_type)
  LIMIT 1;

  v_monthly_due     := COALESCE(v_plan.monthly_payment, v_member.monthly_due, 0);
  v_monthly_comm    := COALESCE(v_plan.monthly_commission, 0);
  v_outright_comm   := COALESCE(v_plan.outright_commission, 0);

  --------------------------------------------------------------------
  -- 2. LOAD RECRUITER
  --------------------------------------------------------------------
  SELECT recruiter_id INTO v_recruiter_id
  FROM agents WHERE id = NEW.agent_id;

  --------------------------------------------------------------------
  -- 3. PERIOD
  --------------------------------------------------------------------
  v_date_earned := COALESCE(NEW.date_paid, CURRENT_DATE);
  v_py := EXTRACT(YEAR FROM v_date_earned);
  v_pm := EXTRACT(MONTH FROM v_date_earned);

  --------------------------------------------------------------------
  -- 4. MEMBERSHIP OUTRIGHT
  --------------------------------------------------------------------
  IF NEW.is_membership_fee OR LOWER(NEW.payment_for) = 'membership' THEN

    IF v_outright_comm > 0 THEN
      INSERT INTO commissions (
        agent_id, member_id, collection_id,
        commission_type, plan_type,
        basis_amount, amount, months_covered,
        outright_mode, eligible_outright,
        date_earned, status, maf_no,
        year, period_year, period_month,
        monthly_commission_given, travel_allowance_given,
        override_released, override_commission,
        is_receivable
      )
      VALUES (
        NEW.agent_id, NEW.member_id, NEW.id,
        'membership_outright', v_member.plan_type,
        v_outright_comm, v_outright_comm, 1,
        NEW.outright_mode, TRUE,
        v_date_earned,
        CASE WHEN NEW.deduct_now THEN 'paid'::commission_status_enum
             ELSE 'pending'::commission_status_enum END,
        NEW.maf_no,
        v_py, v_py, v_pm,
        FALSE, FALSE,
        FALSE, 0,
        CASE WHEN NEW.deduct_now THEN FALSE ELSE TRUE END
      );

      ----------------------------------------------------------------
      -- Recruiter Bonus (Always Receivable, Always Pending)
      ----------------------------------------------------------------
      IF v_recruiter_id IS NOT NULL THEN
        v_recruit_bonus := ROUND(v_outright_comm * 0.10, 2);

        INSERT INTO commissions (
          agent_id, member_id, collection_id, recruiter_id,
          commission_type, plan_type,
          basis_amount, percentage, amount,
          months_covered,
          date_earned, status, maf_no,
          year, period_year, period_month,
          is_receivable
        )
        VALUES (
          v_recruiter_id, NEW.member_id, NEW.id, NEW.agent_id,
          'recruiter_bonus', v_member.plan_type,
          v_outright_comm, 10, v_recruit_bonus,
          1,
          v_date_earned, 'pending'::commission_status_enum, NEW.maf_no,
          v_py, v_py, v_pm,
          TRUE
        );
      END IF;

    END IF;

    RETURN NEW;
  END IF;

  --------------------------------------------------------------------
  -- 5. REGULAR COLLECTION → Determine # of full months
  --------------------------------------------------------------------
  IF v_monthly_due <= 0 THEN RETURN NEW; END IF;

  SELECT COALESCE(SUM(payment),0)
  INTO v_total_before
  FROM collections
  WHERE member_id = NEW.member_id
    AND is_membership_fee = FALSE
    AND id <> NEW.id;

  v_install_before := FLOOR(v_total_before / v_monthly_due);
  v_full_months    := FLOOR(NEW.payment / v_monthly_due);

  IF v_full_months < 1 THEN RETURN NEW; END IF;

  --------------------------------------------------------------------
  -- 6. travel + monthly loop for each month paid
  --------------------------------------------------------------------
  FOR i IN 1..v_full_months LOOP

    v_install_now := v_install_before + i;

    ----------------------------------------------------------------
    -- TRAVEL ALLOWANCE (PATCHED: Uses Collector ID if available)
    ----------------------------------------------------------------
    INSERT INTO commissions (
      agent_id, member_id, collection_id,
      commission_type, plan_type,
      basis_amount, amount, months_covered,
      date_earned, status, maf_no,
      year, period_year, period_month,
      travel_allowance_given,
      is_receivable
    )
    VALUES (
      COALESCE(NEW.collector_id, NEW.agent_id), -- <--- PATCHED LINE
      NEW.member_id, NEW.id,
      'travel_allowance', v_member.plan_type,
      v_monthly_due,
      CASE WHEN v_install_now >= 13 THEN 60 ELSE 30 END,
      1,
      v_date_earned,
      CASE WHEN NEW.got_travel_allowance 
           THEN 'paid'::commission_status_enum
           ELSE 'pending'::commission_status_enum END,
      NEW.maf_no,
      v_py, v_py, v_pm,
      NEW.got_travel_allowance,
      CASE WHEN NEW.got_travel_allowance THEN FALSE ELSE TRUE END
    );

    ----------------------------------------------------------------
    -- MONTHLY COMMISSION (<13)
    ----------------------------------------------------------------
    IF v_install_now < 13 AND v_monthly_comm > 0 THEN
      INSERT INTO commissions (
        agent_id, member_id, collection_id,
        commission_type, plan_type,
        basis_amount, amount, months_covered,
        date_earned, status, maf_no,
        year, period_year, period_month,
        monthly_commission_given,
        is_receivable
      )
      VALUES (
        NEW.agent_id, NEW.member_id, NEW.id,
        'plan_monthly', v_member.plan_type,
        v_monthly_due, v_monthly_comm, 1,
        v_date_earned,
        CASE WHEN NEW.got_monthly_commission 
             THEN 'paid'::commission_status_enum
             ELSE 'pending'::commission_status_enum END,
        NEW.maf_no,
        v_py, v_py, v_pm,
        NEW.got_monthly_commission,
        CASE WHEN NEW.got_monthly_commission THEN FALSE ELSE TRUE END
      );

      ----------------------------------------------------------------
      -- Recruiter bonus for monthly
      ----------------------------------------------------------------
      IF v_recruiter_id IS NOT NULL THEN
        v_recruit_bonus := ROUND(v_monthly_comm * 0.10, 2);

        INSERT INTO commissions (
          agent_id, member_id, collection_id, recruiter_id,
          commission_type, plan_type,
          basis_amount, percentage, amount,
          months_covered, date_earned, status, maf_no,
          year, period_year, period_month,
          is_receivable
        )
        VALUES (
          v_recruiter_id, NEW.member_id, NEW.id, NEW.agent_id,
          'recruiter_bonus', v_member.plan_type,
          v_monthly_comm, 10, v_recruit_bonus,
          1, v_date_earned, 'pending'::commission_status_enum, NEW.maf_no,
          v_py, v_py, v_pm,
          TRUE
        );
      END IF;

    END IF;

  END LOOP;

  --------------------------------------------------------------------
  -- 7. DETECT OVERRIDE LEVELS (AS, MS, MH)
  --------------------------------------------------------------------
  upline := NEW.agent_id;

  WHILE upline IS NOT NULL LOOP
    SELECT position INTO role_text
    FROM agents WHERE id = upline;

    IF role_text ILIKE 'Assistant Supervisor' AND as_id IS NULL THEN
      as_id := upline;
    ELSIF role_text ILIKE 'Marketing Supervisor' AND ms_id IS NULL THEN
      ms_id := upline;
    ELSIF role_text ILIKE 'Marketing Head' AND mh_id IS NULL THEN
      mh_id := upline;
    END IF;

    EXIT WHEN as_id IS NOT NULL AND ms_id IS NOT NULL AND mh_id IS NOT NULL;

    SELECT assigned_id INTO upline FROM agents WHERE id = upline;
  END LOOP;

  --------------------------------------------------------------------
  -- 8. OVERRIDES (ALWAYS RECEIVABLE, ALWAYS PENDING)
  --------------------------------------------------------------------
  IF as_id IS NOT NULL THEN
    INSERT INTO commissions (
      agent_id, member_id, collection_id,
      commission_type, plan_type,
      basis_amount, amount, months_covered,
      date_earned, status, maf_no,
      year, period_year, period_month,
      override_released, override_commission,
      is_receivable
    )
    VALUES (
      as_id, NEW.member_id, NEW.id,
      'override', v_member.plan_type,
      v_monthly_due, 16 * v_full_months, v_full_months,
      v_date_earned, 'pending'::commission_status_enum,
      NEW.maf_no,
      v_py, v_py, v_pm,
      FALSE, 16 * v_full_months,
      TRUE
    );
  END IF;

  IF ms_id IS NOT NULL THEN
    INSERT INTO commissions (
      agent_id, member_id, collection_id,
      commission_type, plan_type,
      basis_amount, amount, months_covered,
      date_earned, status, maf_no,
      year, period_year, period_month,
      override_released, override_commission,
      is_receivable
    )
    VALUES (
      ms_id, NEW.member_id, NEW.id,
      'override', v_member.plan_type,
      v_monthly_due, 12 * v_full_months, v_full_months,
      v_date_earned, 'pending'::commission_status_enum,
      NEW.maf_no,
      v_py, v_py, v_pm,
      FALSE, 12 * v_full_months,
      TRUE
    );
  END IF;

  IF mh_id IS NOT NULL THEN
    INSERT INTO commissions (
      agent_id, member_id, collection_id,
      commission_type, plan_type,
      basis_amount, amount, months_covered,
      date_earned, status, maf_no,
      year, period_year, period_month,
      override_released, override_commission,
      is_receivable
    )
    VALUES (
      mh_id, NEW.member_id, NEW.id,
      'override', v_member.plan_type,
      v_monthly_due, 8 * v_full_months, v_full_months,
      v_date_earned, 'pending'::commission_status_enum,
      NEW.maf_no,
      v_py, v_py, v_pm,
      FALSE, 8 * v_full_months,
      TRUE
    );
  END IF;

  RETURN NEW;
END;
$function$


Function: withdraw_commission
CREATE OR REPLACE FUNCTION public.withdraw_commission(p_agent_id bigint, p_amount numeric)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_balance numeric;
  v_month int;
  v_year int;
  
  -- Deductions
  v_tax numeric;
  v_fee numeric := 50; -- Fixed processing fee
  v_net numeric;
  v_request_id bigint; -- To store the new request ID
BEGIN
  -- 1. Check current balance
  SELECT balance INTO v_balance
  FROM agent_wallets
  WHERE agent_id = p_agent_id;

  IF v_balance IS NULL OR v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient funds (You requested %, but only have %)', p_amount, COALESCE(v_balance, 0);
  END IF;

  -- 1.5. CHECK FOR EXISTING PENDING REQUESTS (Anti-Spam / Single Request Rule)
  IF EXISTS (SELECT 1 FROM withdrawal_requests WHERE agent_id = p_agent_id AND status = 'pending') THEN
    RAISE EXCEPTION 'You already have a pending withdrawal request. Please wait for it to be processed.';
  END IF;

  -- 2. Calculate Deductions
  -- Tax is 10% of the GROSS withdrawal amount
  v_tax := p_amount * 0.10;
  
  -- Net is Amount - Tax - Fee
  v_net := p_amount - v_tax - v_fee;

  IF v_net < 0 THEN
    RAISE EXCEPTION 'Withdrawal amount too low to cover fees and tax.';
  END IF;

  -- 3. Determine current period
  v_month := EXTRACT(MONTH FROM NOW());
  v_year := EXTRACT(YEAR FROM NOW());

  -- 4. Deduct TOTAL GROSS AMOUNT from wallet
  UPDATE agent_wallets
  SET balance = balance - p_amount
  WHERE agent_id = p_agent_id;

  -- 5. Create Withdrawal Request (Capture ID)
  -- UPDATED: 'amount' column now stores NET (Receivable) amount.
  -- 'gross_amount' stores the original requested amount.
  INSERT INTO withdrawal_requests (
    agent_id, 
    amount,        -- NET Amount (Payable)
    gross_amount,  -- Gross Amount
    tax,           -- 10%
    fee,           -- 50
    net_amount,    -- (Redundant now, but keeping for compatibility)
    period_month, 
    period_year, 
    status, 
    created_at
  )
  VALUES (
    p_agent_id, 
    v_net,         -- Store NET here
    p_amount,      -- Store GROSS here
    v_tax,
    v_fee,
    v_net,
    v_month, 
    v_year, 
    'pending', 
    NOW()
  )
  RETURNING id INTO v_request_id;

  -- 6. Insert into Fees Log
  INSERT INTO withdrawal_fees_log (
    withdrawal_request_id,
    agent_id,
    processing_fee,
    tax,
    total_deduction
  )
  VALUES (
    v_request_id,
    p_agent_id,
    v_fee,
    v_tax,
    v_fee + v_tax
  );

END;
$function$


Function: get_commission_period
CREATE OR REPLACE FUNCTION public.get_commission_period(p_date date)
 RETURNS TABLE(year integer, month integer)
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF EXTRACT(DAY FROM p_date) >= 7 THEN
        RETURN QUERY SELECT CAST(EXTRACT(YEAR FROM p_date) AS INT), CAST(EXTRACT(MONTH FROM p_date) AS INT);
    ELSE
        RETURN QUERY SELECT 
            CAST(EXTRACT(YEAR FROM (p_date - interval '1 month')) AS INT),
            CAST(EXTRACT(MONTH FROM (p_date - interval '1 month')) AS INT);
    END IF;
END;
$function$


Function: get_cutoff_range
CREATE OR REPLACE FUNCTION public.get_cutoff_range(p_year integer, p_month integer)
 RETURNS TABLE(start_date date, end_date date)
 LANGUAGE plpgsql
AS $function$
BEGIN
    start_date := make_date(p_year, p_month, 7);
    end_date := start_date + interval '1 month';
    RETURN NEXT;
END;
$function$


Function: trg_check_eligibility
CREATE OR REPLACE FUNCTION public.trg_check_eligibility()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    py int; pm int;
    target_year int; target_month int;
BEGIN
    -- Determine Period of this collection
    SELECT year, month INTO py, pm FROM get_commission_period(NEW.date_paid);
    
    -- This collection period (Jan) is the PREV period for (Feb) Release.
    IF pm = 12 THEN
        target_month := 1;
        target_year := py + 1;
    ELSE
        target_month := pm + 1;
        target_year := py;
    END IF;

    -- Re-check Release for the Target Period
    PERFORM check_and_release_agr(NEW.agent_id, target_year, target_month);
    
    RETURN NEW;
END;
$function$


Function: normalize_member_plan_type
CREATE OR REPLACE FUNCTION public.normalize_member_plan_type()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  --------------------------------------------------------------------
  -- 1. AUTO-CONVERT "PLAN X" → "PACKAGE X"
  --------------------------------------------------------------------
  IF NEW.plan_type ILIKE 'PLAN %' THEN
    NEW.plan_type := 'PACKAGE ' || SUBSTRING(NEW.plan_type FROM 6);
  END IF;

  --------------------------------------------------------------------
  -- 2. AUTO-CONVERT CARD → MS
  --------------------------------------------------------------------
  IF NEW.plan_type = 'CARD' THEN
    NEW.plan_type := 'MS';
  END IF;

  --------------------------------------------------------------------
  -- 3. VALIDATE ALLOWED VALUES
  --------------------------------------------------------------------
  IF NEW.plan_type NOT IN (
    'PACKAGE A1',
    'PACKAGE A2',
    'PACKAGE B1',
    'PACKAGE B2',
    'MS'
  ) THEN
    RAISE EXCEPTION
      'Invalid plan_type: % — only PACKAGE A1/A2/B1/B2 or MS allowed',
      NEW.plan_type;
  END IF;

  RETURN NEW;
END;
$function$


Function: trg_instant_release_comm
CREATE OR REPLACE FUNCTION public.trg_instant_release_comm()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    py int; pm int;
    target_year int; target_month int;
    is_released boolean;
    val numeric;
BEGIN
    -- 1. Determine Earning Period of the NEW commission
    SELECT year, month INTO py, pm FROM get_commission_period(NEW.date_earned);

    -- 2. Shift to Release Period (Next Month)
    IF pm = 12 THEN
        target_month := 1;
        target_year := py + 1;
    ELSE
        target_month := pm + 1;
        target_year := py;
    END IF;

    -- 3. Check if Release Period is ALREADY released
    SELECT (status = 'released') INTO is_released
    FROM agent_commission_rollups
    WHERE agent_id = NEW.agent_id 
      AND period_year = target_year 
      AND period_month = target_month;

    -- 4. If satisfied, credit immediately
    IF is_released THEN
        -- Calculate Value
        val := CASE 
            WHEN NEW.commission_type IN ('override', 'recruiter_bonus') THEN 
                CASE WHEN NEW.override_commission > 0 THEN NEW.override_commission ELSE NEW.amount END
            WHEN NEW.is_receivable THEN NEW.amount 
            ELSE 0 
        END;

        IF val > 0 THEN
             UPDATE agent_wallets 
             SET balance = balance + val, 
                 lifetime_commission = lifetime_commission + val,
                 updated_at = now()
             WHERE agent_id = NEW.agent_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$


Function: backfill_agr_history
CREATE OR REPLACE FUNCTION public.backfill_agr_history()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    rec RECORD;
    curr_year int;
    curr_month int;
    y int; m int;
BEGIN
    -- Fallback to current year if not specified (request.header is not available in direct SQL execution)
    IF curr_year IS NULL THEN 
        curr_year := CAST(EXTRACT(YEAR FROM CURRENT_DATE) AS INT); 
    END IF;
    
    -- Iterate ALL Agents
    FOR rec IN SELECT id FROM agents LOOP
        -- Check last 24 months
        FOR i IN 0..23 LOOP
            y := CAST(EXTRACT(YEAR FROM (now() - (i || ' month')::interval)) AS INT);
            m := CAST(EXTRACT(MONTH FROM (now() - (i || ' month')::interval)) AS INT);
            
            PERFORM check_and_release_agr(rec.id, y, m);
        END LOOP;
    END LOOP;
END;
$function$


Function: update_agent_lifetime_commission
CREATE OR REPLACE FUNCTION public.update_agent_lifetime_commission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    affected_agent_id INT;
BEGIN
    -- Determine which agent to update
    IF (TG_OP = 'DELETE') THEN
        affected_agent_id := OLD.agent_id;
    ELSE
        affected_agent_id := NEW.agent_id;
    END IF;

    -- Update the wallet with sum of all commissions >= Nov 7, 2025
    UPDATE public.agent_wallets
    SET lifetime_commission = (
        SELECT COALESCE(SUM(amount + COALESCE(override_commission, 0)), 0)
        FROM public.commissions
        WHERE agent_id = affected_agent_id
          AND date_earned >= '2025-11-07'
    )
    WHERE agent_id = affected_agent_id;

    RETURN NULL;
END;
$function$


Function: handle_withdrawal_update
CREATE OR REPLACE FUNCTION public.handle_withdrawal_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  -- Fetch the user_id associated with the agent
  SELECT user_id INTO v_user_id
  FROM agents
  WHERE id = NEW.agent_id;

  -- SYNC STATUS to Fees Log
  UPDATE withdrawal_fees_log
  SET status = NEW.status
  WHERE withdrawal_request_id = NEW.id;

  -- Handle REJECTION
  IF NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
    -- A. Refund the Wallet (Add back the GROSS amount that was deducted)
    -- This effectively refunds the fee and tax as well.
    UPDATE agent_wallets
    SET balance = balance + NEW.gross_amount
    WHERE agent_id = NEW.agent_id;

    -- B. Notify Agent
    IF v_user_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, message, type, created_at, is_read)
      VALUES (
        v_user_id,
        'Withdrawal Rejected',
        'Your withdrawal request for ₱' || NEW.gross_amount || ' has been rejected. The amount has been refunded to your wallet.',
        'withdrawal_status',
        NOW(),
        false
      );
    END IF;
  END IF;

  -- Handle APPROVAL
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    -- A. Notify Agent (Balance was already deducted upon request)
    IF v_user_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, message, type, created_at, is_read)
      VALUES (
        v_user_id,
        'Withdrawal Approved',
        'Your withdrawal request for ₱' || NEW.gross_amount || ' has been approved.',
        'withdrawal_status',
        NOW(),
        false
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$


Function: check_and_notify_agr
CREATE OR REPLACE FUNCTION public.check_and_notify_agr()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    agent_record RECORD;
    membership_count INT;
    rule_b_exists BOOLEAN;
    start_date DATE;
    end_date DATE;
    already_notified BOOLEAN;
BEGIN
    -- Cutoff logic: from 6th of last month to 6th of this month
    start_date := date_trunc('month', current_date) - interval '1 month' + interval '5 days';
    end_date   := date_trunc('month', current_date) + interval '5 days';

    FOR agent_record IN
        SELECT id FROM agents
    LOOP
        -- ==========================
        -- RULE A: 3 MEMBERSHIP FEES
        -- ==========================
        SELECT COUNT(*) INTO membership_count
        FROM collections
        WHERE agent_id = agent_record.id
          AND is_membership_fee = TRUE
          AND date_paid >= start_date
          AND date_paid < end_date;

        -- ============================================
        -- RULE B: Same member paid membership + regular
        -- ============================================
        SELECT EXISTS (
            SELECT 1
            FROM collections
            WHERE agent_id = agent_record.id
              AND date_paid >= start_date
              AND date_paid < end_date
            GROUP BY member_id
            HAVING
                SUM(CASE WHEN is_membership_fee = TRUE THEN 1 ELSE 0 END) >= 1
                AND
                SUM(CASE WHEN is_membership_fee = FALSE AND payment_for = 'regular' THEN 1 ELSE 0 END) >= 1
        )
        INTO rule_b_exists;

        -- Check if already notified in this window
        SELECT EXISTS (
            SELECT 1
            FROM notifications
            WHERE (extra->>'agent_id')::int = agent_record.id
              AND created_at >= date_trunc('month', current_date)
        )
        INTO already_notified;

        -- Skip if already notified this month
        IF already_notified THEN
            CONTINUE;
        END IF;

        -- ✅ AGR QUALIFIED
        IF membership_count >= 3 OR rule_b_exists THEN

            INSERT INTO notifications (
                title,
                message,
                type,
                target_role,
                extra
            )
            VALUES (
                'AGR Requirement Completed ✅',
                'Congratulations! You completed your AGR. You are now eligible to claim or withdraw your commission next month.',
                'agr_success',
                'agent',
                jsonb_build_object(
                    'agent_id', agent_record.id,
                    'membership_count', membership_count
                )
            );

        ELSE
            INSERT INTO notifications (
                title,
                message,
                type,
                target_role,
                extra
            )
            VALUES (
                'AGR Requirement Reminder ⚠️',
                'Cutoff date is approaching. Work out your AGR so that you can qualify next month.',
                'agr_warning',
                'agent',
                jsonb_build_object(
                    'agent_id', agent_record.id,
                    'membership_count', membership_count
                )
            );

        END IF;
    END LOOP;
END;
$function$


Function: calculate_months_behind_v4
CREATE OR REPLACE FUNCTION public.calculate_months_behind_v4(p_member_id bigint)
 RETURNS double precision
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  m_monthly_due numeric;
  m_plan_start_date date;
  m_date_joined date;
  m_created_at timestamptz;
  
  l_date_paid date;
  l_payment numeric;
  
  v_months_covered numeric;
  v_paid_until date;
  v_months_behind double precision;
BEGIN
  -- 1. Get Member Info
  SELECT monthly_due, plan_start_date, date_joined, created_at
  INTO m_monthly_due, m_plan_start_date, m_date_joined, m_created_at
  FROM members
  WHERE id = p_member_id;
  
  -- If no monthly due, not liable, not behind
  IF m_monthly_due IS NULL OR m_monthly_due <= 0 THEN
    RETURN 0;
  END IF;

  -- 2. Get Last Regular Payment (ignore membership fees)
  SELECT date_paid, payment
  INTO l_date_paid, l_payment
  FROM collections
  WHERE member_id = p_member_id 
    AND (is_membership_fee IS NULL OR is_membership_fee = false)
  ORDER BY date_paid DESC
  LIMIT 1;

  -- 3. Determine "Paid Until" Date
  IF l_date_paid IS NULL THEN
    -- No payments ever made: base it on start date
    v_paid_until := COALESCE(m_plan_start_date, m_date_joined, m_created_at::date, CURRENT_DATE);
  ELSE
    -- Calculate coverage from the last payment
    v_months_covered := l_payment / m_monthly_due;
    -- Project forward from last payment date
    v_paid_until := l_date_paid + (interval '1 month' * v_months_covered);
  END IF;

  -- 4. Calculate Months Behind (Months elapsed since Paid Until)
  -- Logic: (YearDiff * 12) + MonthDiff
  
  SELECT 
    (DATE_PART('year', AGE(CURRENT_DATE, v_paid_until)) * 12 + 
     DATE_PART('month', AGE(CURRENT_DATE, v_paid_until)))
  INTO v_months_behind;
  
  -- Ensure non-negative
  RETURN GREATEST(0, v_months_behind);
END;
$function$


Function: auto_promote_agent
CREATE OR REPLACE FUNCTION public.auto_promote_agent(agent_id bigint)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    current_pos TEXT;
    se_count INT;
    as_count INT;
    ms_count INT;
BEGIN
    -- Get current position of the agent
    SELECT LOWER(position) INTO current_pos
    FROM agents
    WHERE id = agent_id;

    -- Count SE downlines
    SELECT COUNT(*)
    INTO se_count
    FROM agents
    WHERE recruiter_id = agent_id
      AND LOWER(position) IN ('agent', 'sales executive');

    -- Count AS downlines
    SELECT COUNT(*)
    INTO as_count
    FROM agents
    WHERE recruiter_id = agent_id
      AND LOWER(position) = 'assistant supervisor';

    -- Count MS downlines
    SELECT COUNT(*)
    INTO ms_count
    FROM agents
    WHERE recruiter_id = agent_id
      AND LOWER(position) = 'marketing supervisor';

    -- PROMOTION LOGIC
    IF current_pos IN ('agent','sales executive') AND se_count >= 20 THEN
        UPDATE agents
        SET position = 'Assistant Supervisor'
        WHERE id = agent_id;

    ELSIF current_pos = 'assistant supervisor' AND as_count >= 10 THEN
        UPDATE agents
        SET position = 'Marketing Supervisor'
        WHERE id = agent_id;

    ELSIF current_pos = 'marketing supervisor' AND ms_count >= 3 THEN
        UPDATE agents
        SET position = 'Marketing Head'
        WHERE id = agent_id;
    END IF;

END;
$function$


Function: update_agent_commission_rollups
CREATE OR REPLACE FUNCTION public.update_agent_commission_rollups()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_cutoff_year INT;
  v_cutoff_month INT;
BEGIN
  IF NEW.date_earned >= date_trunc('month', NEW.date_earned)::date + INTERVAL '6 days' THEN
    v_cutoff_year  := EXTRACT(YEAR FROM NEW.date_earned + INTERVAL '1 month')::INT;
    v_cutoff_month := EXTRACT(MONTH FROM NEW.date_earned + INTERVAL '1 month')::INT;
  ELSE
    v_cutoff_year  := EXTRACT(YEAR FROM NEW.date_earned)::INT;
    v_cutoff_month := EXTRACT(MONTH FROM NEW.date_earned)::INT;
  END IF;

  INSERT INTO public.agent_commission_rollups (
    agent_id,
    period_year,
    period_month,
    monthly_commission,
    membership_commission,
    override_commission,
    recruiter_bonus,
    travel_allowance,
    total_collection,
    grand_total_commission,
    status,
    is_finalized,
    updated_at
  )
  VALUES (
    NEW.agent_id,
    v_cutoff_year,
    v_cutoff_month,
    CASE WHEN NEW.commission_type = 'plan_monthly' THEN NEW.amount ELSE 0 END,
    CASE WHEN NEW.commission_type = 'membership_outright' THEN NEW.amount ELSE 0 END,
    CASE WHEN NEW.override_commission > 0 THEN NEW.override_commission ELSE 0 END,
    CASE WHEN NEW.commission_type = 'recruiter_bonus' THEN NEW.amount ELSE 0 END,
    CASE WHEN NEW.commission_type = 'travel_allowance' THEN NEW.amount ELSE 0 END,
    COALESCE(NEW.basis_amount, 0),
    COALESCE(NEW.amount, 0),
    'unreleased'::commission_status_enum,
    FALSE,
    NOW()
  )
  ON CONFLICT (agent_id, period_year, period_month)
  DO UPDATE SET
    monthly_commission =
      agent_commission_rollups.monthly_commission +
      CASE WHEN NEW.commission_type = 'plan_monthly' THEN NEW.amount ELSE 0 END,

    membership_commission =
      agent_commission_rollups.membership_commission +
      CASE WHEN NEW.commission_type = 'membership_outright' THEN NEW.amount ELSE 0 END,

    override_commission =
      agent_commission_rollups.override_commission +
      CASE WHEN NEW.override_commission > 0 THEN NEW.override_commission ELSE 0 END,

    recruiter_bonus =
      agent_commission_rollups.recruiter_bonus +
      CASE WHEN NEW.commission_type = 'recruiter_bonus' THEN NEW.amount ELSE 0 END,

    travel_allowance =
      agent_commission_rollups.travel_allowance +
      CASE WHEN NEW.commission_type = 'travel_allowance' THEN NEW.amount ELSE 0 END,

    total_collection =
      agent_commission_rollups.total_collection +
      COALESCE(NEW.basis_amount, 0),

    grand_total_commission =
      agent_commission_rollups.grand_total_commission +
      COALESCE(NEW.amount, 0),

    updated_at = NOW()
  ;

  RETURN NEW;
END;
$function$


Function: get_all_members_expanded
CREATE OR REPLACE FUNCTION public.get_all_members_expanded(p_offset integer, p_limit integer)
 RETURNS TABLE(id bigint, maf_no text, last_name text, first_name text, middle_name text, address text, contact_number text, religion text, birth_date date, age integer, monthly_due numeric, plan_type text, contracted_price numeric, date_joined date, balance numeric, gender text, civil_status text, zipcode text, birthplace text, nationality text, height text, weight text, casket_type text, membership text, occupation text, agent_id bigint, plan_start_date date, created_at timestamp with time zone, months_behind double precision)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
      m.id, m.maf_no::text, m.last_name::text, m.first_name::text, m.middle_name::text, 
      m.address::text, m.contact_number::text, m.religion::text, m.birth_date, m.age, 
      m.monthly_due, m.plan_type::text, m.contracted_price, m.date_joined, 
      m.balance, m.gender::text, m.civil_status::text, m.zipcode::text, m.birthplace::text, 
      m.nationality::text, m.height::text, m.weight::text, m.casket_type::text, m.membership::text, 
      m.occupation::text, m.agent_id, 
      m.plan_start_date, 
      m.created_at,
      calculate_months_behind_v4(m.id) as months_behind
  FROM members m
  ORDER BY m.last_name ASC, m.first_name ASC
  LIMIT p_limit OFFSET p_offset;
END;
$function$


Function: notify_new_withdrawal_request
CREATE OR REPLACE FUNCTION public.notify_new_withdrawal_request()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  insert into notifications (
    title,
    message,
    type,
    target_role,
    user_id,
    extra
  )
  select
    'New Withdrawal Request',
    concat(a.firstname, ' ', a.middlename, ' ', a.lastname) || ' requested a payout.',
    'payout_request',
    'admin',
    null, -- notify ALL admins
    jsonb_build_object(
      'agent_id', NEW.agent_id,
      'agent_name', concat(a.firstname, ' ', a.middlename, ' ', a.lastname),
      'gcash_number', a.gcash_number,
      'gcash_qr', a.gcash_qr,
      'amount', NEW.amount
    )
  from agents a
  where a.id = NEW.agent_id;

  return NEW;
end;
$function$



-- === TRIGGERS ===
Trigger: trg_notify_new_withdrawal ON withdrawal_requests
EXECUTE FUNCTION notify_new_withdrawal_request()
Trigger: trg_notify_payout_request ON agent_commission_rollups
EXECUTE FUNCTION notify_payout_request()
Trigger: trg_notify_payout_request ON agent_commission_rollups
EXECUTE FUNCTION notify_payout_request()
Trigger: trg_notify_payout_released ON agent_commission_rollups
EXECUTE FUNCTION notify_payout_released()
Trigger: trg_update_lifetime_commission ON commissions
EXECUTE FUNCTION update_agent_lifetime_commission()
Trigger: trg_update_lifetime_commission ON commissions
EXECUTE FUNCTION update_agent_lifetime_commission()
Trigger: trg_update_lifetime_commission ON commissions
EXECUTE FUNCTION update_agent_lifetime_commission()
Trigger: trigger_auto_mark_membership_paid ON collections
EXECUTE FUNCTION auto_mark_membership_paid()
Trigger: on_withdrawal_update ON withdrawal_requests
EXECUTE FUNCTION handle_withdrawal_update()
Trigger: trg_notify_admin_on_payout_request ON agent_commission_rollups
EXECUTE FUNCTION notify_admin_on_payout_request()
Trigger: trg_notify_admin_on_payout_request ON agent_commission_rollups
EXECUTE FUNCTION notify_admin_on_payout_request()
Trigger: trg_members_updated_at ON members
EXECUTE FUNCTION set_updated_at()
Trigger: trg_beneficiaries_updated_at ON beneficiaries
EXECUTE FUNCTION set_updated_at()
Trigger: trg_collections_updated_at ON collections
EXECUTE FUNCTION set_updated_at()
Trigger: tr_on_collection_agr ON collections
EXECUTE FUNCTION trg_check_eligibility()
Trigger: tr_on_collection_agr ON collections
EXECUTE FUNCTION trg_check_eligibility()
Trigger: tr_on_commission_agr ON commissions
EXECUTE FUNCTION trg_instant_release_comm()
Trigger: trg_create_wallet ON agents
EXECUTE FUNCTION create_wallet_for_new_agent()
Trigger: trigger_member_audit ON members
EXECUTE FUNCTION log_member_changes()
Trigger: trigger_member_audit ON members
EXECUTE FUNCTION log_member_changes()
Trigger: trigger_member_audit ON members
EXECUTE FUNCTION log_member_changes()
Trigger: trg_notify_withdrawal_approved ON withdrawal_requests
EXECUTE FUNCTION notify_withdrawal_approved()
Trigger: trg_sync_agent_members ON members
EXECUTE FUNCTION sync_agent_member_links()
Trigger: trg_sync_agent_members ON members
EXECUTE FUNCTION sync_agent_member_links()
Trigger: trg_notify_admin_on_agent_withdrawal ON agent_commission_rollups
EXECUTE FUNCTION notify_admin_on_agent_withdrawal()
Trigger: trg_notify_admin_on_agent_withdrawal ON agent_commission_rollups
EXECUTE FUNCTION notify_admin_on_agent_withdrawal()
Trigger: trg_users_profile_u ON users_profile
EXECUTE FUNCTION touch_updated_at()
Trigger: trg_agents_u ON agents
EXECUTE FUNCTION touch_updated_at()
Trigger: sync_position_role ON agents
EXECUTE FUNCTION sync_position_and_role()
Trigger: sync_position_role ON agents
EXECUTE FUNCTION sync_position_and_role()
Trigger: trg_propagate_agent_update ON members
EXECUTE FUNCTION propagate_agent_update()
Trigger: trg_promotions_u ON promotions
EXECUTE FUNCTION touch_updated_at()
Trigger: trg_sync_wallet_after_rollup_insert ON agent_commission_rollups
EXECUTE FUNCTION sync_agent_wallet_from_rollup()
Trigger: trg_payouts_u ON payouts
EXECUTE FUNCTION touch_updated_at()
Trigger: trg_default_role_se ON agents
EXECUTE FUNCTION set_default_role_se()
Trigger: set_collection_month ON collections
EXECUTE FUNCTION trg_set_collection_month()
Trigger: trg_update_rollups ON commissions
EXECUTE FUNCTION update_agent_commission_rollups()
Trigger: trg_normalize_member_plan_type ON members
EXECUTE FUNCTION normalize_member_plan_type()
Trigger: trg_normalize_member_plan_type ON members
EXECUTE FUNCTION normalize_member_plan_type()
Trigger: tg_commissions_updated_at ON commissions
EXECUTE FUNCTION tg__set_updated_at()
Trigger: trg_notify_agent_on_payout_release ON agent_commission_rollups
EXECUTE FUNCTION notify_agent_on_payout_release()
Trigger: sync_member_changes ON members
EXECUTE FUNCTION global_member_update()
Trigger: trg_auto_promote ON agents
EXECUTE FUNCTION trigger_auto_promote()
Trigger: trg_auto_promote ON agents
EXECUTE FUNCTION trigger_auto_promote()
Trigger: trg_handle_collection_commissions ON collections
EXECUTE FUNCTION handle_collection_commissions()
Trigger: before_payment_reinstatement ON collections
EXECUTE FUNCTION handle_member_reinstatement()
Trigger: trg_delete_commissions_on_collection_delete ON collections
EXECUTE FUNCTION delete_commissions_on_collection_delete()
Trigger: trg_collections_after_delete ON collections
EXECUTE FUNCTION collections_after_delete()
Trigger: sync_parent_recruiter ON agents
EXECUTE FUNCTION sync_parent_and_recruiter()
Trigger: trg_sync_wallet_after_rollup_update ON agent_commission_rollups
EXECUTE FUNCTION sync_agent_wallet_from_rollup()
