-- Debug Script for OLACO
do $$
declare
  r record;
  p_count integer;
begin
  for r in select * from members where last_name ilike 'OLACO%' loop
    select count(*) into p_count from collections where member_id = r.id;
    
    raise notice 'Member: % %', r.first_name, r.last_name;
    raise notice 'Date Joined: %', r.date_joined;
    raise notice 'Plan Start Date: %', r.plan_start_date;
    raise notice 'Created At: %', r.created_at;
    raise notice 'Payment Count: %', p_count;
    
    -- Simulate Math
    raise notice 'Months Since Start (SQL): %', (
        DATE_PART('year', AGE(CURRENT_DATE, r.plan_start_date)) * 12 +
        DATE_PART('month', AGE(CURRENT_DATE, r.plan_start_date))
    );
  end loop;
end;
$$;
