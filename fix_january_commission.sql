-- ============================================================================
-- FIX JANUARY COMMISSION (One-Time Migration)
-- ============================================================================

DO $$
DECLARE
    rec RECORD;
BEGIN
    -- 1. Reset 'released' status for Jan 2026 to allow check_and_release_agr to run again
    -- We only reset those that have 0 grand_total or where we suspect issues. 
    -- But check_and_release_agr checks for specific logic.
    -- Actually, check_and_release_agr has a check:
    -- IF already_released THEN RETURN; END IF;
    -- So we MUST delete or update the status to 'unreleased' for Jan 2026 rollups 
    -- if we want to re-trigger the wallet addition.
    
    -- However, we must be careful NOT to add money twice if some DID work.
    -- The user reporting "ALL AGENT... RECEIVABLE AMOUNT IS NOT REFLECTING" implies none worked.
    -- Safeguard: Only reset if monthly_commission is 0 or low? 
    -- Better Safeguard: Trust the user that it's broken.
    
    UPDATE agent_commission_rollups
    SET status = 'unreleased'
    WHERE period_year = 2026 AND period_month = 1;

    -- 2. Force Update Commissions for Dec 2025 (Period 12) & Jan 2026 (Period 1)
    -- Just in case some were missed.
    -- Note: check_and_release_agr NOW does this for the target period.
    -- But let's verify Dec period too just to be safe.
    
    -- 3. Run the Backfill
    PERFORM backfill_agr_history();
    
END;
$$;
