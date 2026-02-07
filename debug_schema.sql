-- ============================================================================
-- SQL Schema Inspection Helper
-- Run this in your Supabase SQL Editor to allow the agent to "see" your database structure.
-- ============================================================================

CREATE OR REPLACE FUNCTION debug_export_schema()
RETURNS text AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
