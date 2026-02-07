
DROP TRIGGER IF EXISTS tr_on_commission_agr ON public.commissions;

CREATE TRIGGER tr_on_commission_agr
AFTER INSERT OR UPDATE ON public.commissions
FOR EACH ROW
EXECUTE FUNCTION public.trg_instant_release_comm();
