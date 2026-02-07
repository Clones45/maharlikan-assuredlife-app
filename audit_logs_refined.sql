-- 1. Add a 'description' column to make it readable
ALTER TABLE public.audit_logs 
ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE public.audit_logs 
ADD COLUMN IF NOT EXISTS changed_fields jsonb;

-- 2. Update the Trigger Function to compute "Diffs"
CREATE OR REPLACE FUNCTION public.log_member_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
        -- Only log if actual data changed
        IF NEW IS DISTINCT FROM OLD THEN
            old_row := row_to_json(OLD)::jsonb;
            new_row := row_to_json(NEW)::jsonb;
            diff := '{}'::jsonb;
            desc_list := ARRAY[]::text[];

            -- Iterate over keys to find changes
            FOR key IN SELECT jsonb_object_keys(old_row)
            LOOP
                val_old := old_row->key;
                val_new := new_row->key;

                -- Ignore system columns or timestamps if you want, but for now compare all
                IF val_old IS DISTINCT FROM val_new THEN
                    -- Clean up display (remove quotes for text)
                    diff := diff || jsonb_build_object(key, jsonb_build_object('from', val_old, 'to', val_new));
                    
                    -- Build Readable Description
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
$$;
