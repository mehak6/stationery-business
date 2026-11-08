-- Run after the existing June 2026 stock/batch migrations. No inventory is copied.
BEGIN;
REVOKE CREATE ON SCHEMA public FROM PUBLIC,anon,authenticated;
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA app_private TO authenticated;

CREATE TABLE app_private.members (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 role text NOT NULL CHECK (role IN ('admin','salesperson')),
 enabled boolean NOT NULL DEFAULT true,
 updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON app_private.members FROM PUBLIC, anon, authenticated;
ALTER TABLE app_private.members ENABLE ROW LEVEL SECURITY;

-- Only the verified, explicitly designated owner is bootstrapped. User metadata
-- and profiles.role are never trusted for authorization.
CREATE FUNCTION app_private.bootstrap_owner() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF lower(NEW.email) = 'mehakaggarwal70@gmail.com' AND NEW.email_confirmed_at IS NOT NULL THEN
  INSERT INTO app_private.members(user_id,role) VALUES(NEW.id,'admin')
  ON CONFLICT(user_id) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER stationery_bootstrap_owner AFTER INSERT OR UPDATE OF email_confirmed_at,email
 ON auth.users FOR EACH ROW EXECUTE FUNCTION app_private.bootstrap_owner();
INSERT INTO app_private.members(user_id,role)
 SELECT id,'admin' FROM auth.users WHERE lower(email)='mehakaggarwal70@gmail.com' AND email_confirmed_at IS NOT NULL
 ON CONFLICT DO NOTHING;

CREATE FUNCTION app_private.current_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT role FROM app_private.members WHERE user_id=auth.uid() AND enabled
$$;
REVOKE ALL ON FUNCTION app_private.current_role() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.current_role() TO authenticated;

-- Restrictive policies AND with all legacy permissive policies, so a previously
-- installed "all authenticated users" policy cannot reopen sensitive tables.
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='r'
   AND c.relname IN ('products','sales','categories','customers','profiles','party_purchases',
    'inventory_transactions','product_stock_batches','sale_batch_allocations','party_purchase_movements','yearly_closing_stock')
 LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t.relname);
  EXECUTE format('CREATE POLICY staff_admin_boundary ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT app_private.current_role()) = ''admin'') WITH CHECK ((SELECT app_private.current_role()) = ''admin'')',t.relname);
  EXECUTE format('CREATE POLICY staff_admin_access ON public.%I FOR ALL TO authenticated USING ((SELECT app_private.current_role()) = ''admin'') WITH CHECK ((SELECT app_private.current_role()) = ''admin'')',t.relname);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon',t.relname);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',t.relname);
 END LOOP;
 -- Existing analytics views must obey the underlying table policies.
 FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='v'
 LOOP
  EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)',t.relname);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon',t.relname);
 END LOOP;
END $$;

-- Revoke direct access to privileged helpers. Trigger calls still execute under
-- the trusted sale RPC owner. Admin-facing stock RPCs get explicit role guards.
DO $$ DECLARE f record; args text; callargs text; result_type text; BEGIN
 FOR f IN SELECT p.oid,p.proname,p.proargnames,p.pronargs,
  pg_get_function_identity_arguments(p.oid) identity_args,
  pg_get_function_arguments(p.oid) full_args,
  pg_get_function_result(p.oid) result_type
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prosecdef AND p.prokind='f'
 LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC,anon,authenticated',f.proname,f.identity_args);
 END LOOP;
 FOR f IN SELECT p.oid,p.proname,p.proargnames,p.pronargs,
  pg_get_function_identity_arguments(p.oid) identity_args,
  pg_get_function_arguments(p.oid) full_args,
  pg_get_function_result(p.oid) result_type
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN ('adjust_product_stock','record_party_transfer_batch','record_party_purchase_deduction')
 LOOP
  SELECT string_agg(format('%I',a),',') INTO callargs FROM unnest(f.proargnames[1:f.pronargs]) a;
  EXECUTE format('ALTER FUNCTION public.%I(%s) SET SCHEMA app_private',f.proname,f.identity_args);
  EXECUTE format('CREATE FUNCTION public.%I(%s) RETURNS %s LANGUAGE plpgsql SECURITY DEFINER SET search_path = '''' AS $body$ BEGIN IF app_private.current_role() IS DISTINCT FROM ''admin'' THEN RAISE EXCEPTION ''Admin access required'' USING ERRCODE=''42501''; END IF; RETURN app_private.%I(%s); END $body$',f.proname,f.full_args,f.result_type,f.proname,callargs);
  EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC,anon',f.proname,f.identity_args);
  EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated',f.proname,f.identity_args);
 END LOOP;
END $$;

ALTER TABLE public.products ADD COLUMN voice_aliases text[] NOT NULL DEFAULT '{}';
-- Admin direct sales and the narrow staff RPC share the same trusted triggers.
ALTER FUNCTION public.apply_stock_for_sale_insert() SECURITY DEFINER;
ALTER FUNCTION public.apply_stock_for_sale_insert() SET search_path = public;
ALTER FUNCTION public.apply_stock_for_sale_update() SECURITY DEFINER;
ALTER FUNCTION public.apply_stock_for_sale_update() SET search_path = public;
ALTER FUNCTION public.apply_stock_for_sale_delete() SECURITY DEFINER;
ALTER FUNCTION public.apply_stock_for_sale_delete() SET search_path = public;
CREATE TABLE app_private.receipts (
 id uuid PRIMARY KEY, created_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(), sale_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date
);
CREATE TABLE app_private.receipt_lines (
 receipt_id uuid NOT NULL REFERENCES app_private.receipts(id),
 sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
 PRIMARY KEY(receipt_id,sale_id)
);
CREATE TABLE app_private.sale_requests (
 user_id uuid NOT NULL, request_id uuid NOT NULL, receipt_id uuid NOT NULL,
 PRIMARY KEY(user_id,request_id)
);
CREATE TABLE app_private.receipt_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),receipt_id uuid NOT NULL,
 actor uuid NOT NULL, at timestamptz NOT NULL DEFAULT now(),before_data jsonb,after_data jsonb
);
REVOKE ALL ON ALL TABLES IN SCHEMA app_private FROM PUBLIC,anon,authenticated;
ALTER TABLE app_private.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.receipt_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.sale_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.receipt_audit ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.get_app_access() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT coalesce(app_private.current_role(),'pending')
$$;

CREATE FUNCTION public.staff_catalogue() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF coalesce(app_private.current_role(),'') NOT IN ('admin','salesperson') THEN RAISE EXCEPTION 'Access not approved' USING ERRCODE='42501'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'selling_price',selling_price,'voice_aliases',voice_aliases) ORDER BY name),'[]') FROM public.products);
END $$;

CREATE FUNCTION app_private.receipt_snapshot(p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'product_id',s.product_id,'name',p.name,'quantity',s.quantity,'unit_price',s.unit_price,'total_amount',s.total_amount,'updated_at',s.updated_at) ORDER BY s.id),'[]')
 FROM app_private.receipt_lines l JOIN public.sales s ON s.id=l.sale_id JOIN public.products p ON p.id=s.product_id WHERE l.receipt_id=p_id
$$;

CREATE FUNCTION public.staff_today() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE d date := (now() AT TIME ZONE 'Asia/Kolkata')::date; BEGIN
 IF coalesce(app_private.current_role(),'') NOT IN ('admin','salesperson') THEN RAISE EXCEPTION 'Access not approved' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('date',d,'total',(SELECT coalesce(sum(total_amount),0) FROM public.sales WHERE sale_date=d),
  'receipts',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'created_at',r.created_at,'lines',app_private.receipt_snapshot(r.id),'version',md5(app_private.receipt_snapshot(r.id)::text)) ORDER BY r.created_at DESC),'[]')
   FROM app_private.receipts r WHERE r.sale_date=d AND (r.created_by=auth.uid() OR app_private.current_role()='admin')));
END $$;

CREATE FUNCTION public.staff_save_sale(p_request_id uuid,p_lines jsonb,p_receipt_id uuid DEFAULT NULL,p_expected_version text DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid:=auth.uid(); r app_private.receipts; old_data jsonb; new_id uuid; line jsonb; new_sale_id uuid; item public.products; qty integer; price numeric; saved_id uuid;
BEGIN
 IF actor IS NULL OR coalesce(app_private.current_role(),'') NOT IN ('admin','salesperson') THEN RAISE EXCEPTION 'Access not approved' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL THEN RAISE EXCEPTION 'Request ID required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(actor::text || p_request_id::text,0));
 SELECT receipt_id INTO saved_id FROM app_private.sale_requests WHERE user_id=actor AND request_id=p_request_id;
 IF FOUND THEN RETURN saved_id; END IF;
 IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines) NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Enter 1 to 50 items'; END IF;
 IF p_receipt_id IS NOT NULL THEN
  SELECT * INTO r FROM app_private.receipts WHERE id=p_receipt_id FOR UPDATE;
  IF NOT FOUND OR (r.created_by<>actor AND app_private.current_role()<>'admin') OR r.sale_date<>(now() AT TIME ZONE 'Asia/Kolkata')::date THEN RAISE EXCEPTION 'Only your own sales from today can be corrected' USING ERRCODE='42501'; END IF;
  old_data:=app_private.receipt_snapshot(r.id);
  IF p_expected_version IS DISTINCT FROM md5(old_data::text) THEN RAISE EXCEPTION 'This sale changed. Refresh before correcting it.' USING ERRCODE='40001'; END IF;
  new_id:=r.id;
 ELSE
  new_id:=gen_random_uuid();
  INSERT INTO app_private.receipts(id,created_by) VALUES(new_id,actor);
 END IF;
 -- Consistent lock order across all old and new products.
 PERFORM 1 FROM public.products WHERE id IN (
  SELECT (v->>'product_id')::uuid FROM jsonb_array_elements(p_lines) v
  UNION SELECT s.product_id FROM public.sales s JOIN app_private.receipt_lines l ON l.sale_id=s.id WHERE l.receipt_id=new_id
 ) ORDER BY id FOR UPDATE;
 BEGIN
  IF p_receipt_id IS NOT NULL THEN
   DELETE FROM public.sales WHERE id IN (SELECT sale_id FROM app_private.receipt_lines WHERE receipt_id=new_id);
  END IF;
  FOR line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
   IF jsonb_typeof(line->'quantity') IS DISTINCT FROM 'number' OR (line->>'quantity')::numeric<>trunc((line->>'quantity')::numeric) THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
   qty:=(line->>'quantity')::integer; price:=(line->>'unit_price')::numeric;
   IF qty IS NULL OR qty NOT BETWEEN 1 AND 100000 OR price IS NULL OR price<0 OR price>10000000 OR price<>round(price,2) THEN RAISE EXCEPTION 'Invalid quantity or price'; END IF;
   SELECT * INTO item FROM public.products WHERE id=(line->>'product_id')::uuid;
   IF NOT FOUND THEN RAISE EXCEPTION 'Unknown product'; END IF;
   INSERT INTO public.sales(product_id,quantity,unit_price,total_amount,profit,sale_date,notes,customer_info)
   VALUES(item.id,qty,price,qty*price,qty*(price-item.purchase_price),(now() AT TIME ZONE 'Asia/Kolkata')::date,'Voice sales register',NULL) RETURNING id INTO new_sale_id;
   INSERT INTO app_private.receipt_lines(receipt_id,sale_id) VALUES(new_id,new_sale_id);
  END LOOP;
 EXCEPTION WHEN OTHERS THEN
  -- Existing stock triggers mention exact available stock; do not reveal it.
  RAISE EXCEPTION 'Could not save: check product, quantity and rate, or ask the admin about availability.';
 END;
 INSERT INTO app_private.sale_requests VALUES(actor,p_request_id,new_id);
 INSERT INTO app_private.receipt_audit(receipt_id,actor,before_data,after_data) VALUES(new_id,actor,old_data,app_private.receipt_snapshot(new_id));
 RETURN new_id;
END $$;

CREATE FUNCTION public.admin_staff_accounts() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF app_private.current_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE='42501'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',u.id,'email',u.email,'phone',u.phone,'verified',u.email_confirmed_at IS NOT NULL OR u.phone_confirmed_at IS NOT NULL,'role',coalesce(m.role,'pending'),'enabled',coalesce(m.enabled,false)) ORDER BY u.created_at DESC),'[]') FROM auth.users u LEFT JOIN app_private.members m ON m.user_id=u.id);
END $$;
CREATE FUNCTION public.admin_set_salesperson(p_user_id uuid,p_enabled boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF app_private.current_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM app_private.members WHERE user_id=p_user_id AND role='admin') THEN RAISE EXCEPTION 'Cannot change administrator here'; END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id AND (email_confirmed_at IS NOT NULL OR phone_confirmed_at IS NOT NULL)) THEN RAISE EXCEPTION 'Account must be verified first'; END IF;
 INSERT INTO app_private.members(user_id,role,enabled) VALUES(p_user_id,'salesperson',p_enabled)
 ON CONFLICT(user_id) DO UPDATE SET enabled=excluded.enabled,updated_at=now();
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION app_private.current_role() TO authenticated;
REVOKE ALL ON FUNCTION public.get_app_access(),public.staff_catalogue(),public.staff_today(),public.staff_save_sale(uuid,jsonb,uuid,text),public.admin_staff_accounts(),public.admin_set_salesperson(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_app_access(),public.staff_catalogue(),public.staff_today(),public.staff_save_sale(uuid,jsonb,uuid,text),public.admin_staff_accounts(),public.admin_set_salesperson(uuid,boolean) TO authenticated;
COMMIT;
