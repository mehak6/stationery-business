-- Atomic sales and inventory ledger migration.
-- Safe to run more than once in Supabase SQL Editor or Supabase CLI.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

UPDATE public.sales
SET updated_at = COALESCE(updated_at, created_at, NOW())
WHERE updated_at IS NULL;

ALTER TABLE public.sales
  ALTER COLUMN updated_at SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_sales_updated_at ON public.sales(updated_at);

CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  sale_id UUID,
  action TEXT NOT NULL CHECK (
    action IN (
      'sale_created',
      'sale_quantity_increased',
      'sale_quantity_decreased',
      'sale_product_changed_restore',
      'sale_product_changed_deduct',
      'sale_deleted_restore',
      'manual_stock_added',
      'manual_stock_reduced',
      'party_transfer',
      'year_reset',
      'stock_repair'
    )
  ),
  quantity_change INTEGER NOT NULL,
  stock_before INTEGER NOT NULL,
  stock_after INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'database',
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_product_id
  ON public.inventory_transactions(product_id);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_sale_id
  ON public.inventory_transactions(sale_id);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created_at
  ON public.inventory_transactions(created_at DESC);

ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read inventory transactions"
  ON public.inventory_transactions;
CREATE POLICY "Authenticated users can read inventory transactions"
  ON public.inventory_transactions
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert inventory transactions"
  ON public.inventory_transactions;
CREATE POLICY "Authenticated users can insert inventory transactions"
  ON public.inventory_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.write_inventory_ledger(
  p_product_id UUID,
  p_sale_id UUID,
  p_action TEXT,
  p_quantity_change INTEGER,
  p_stock_before INTEGER,
  p_stock_after INTEGER,
  p_source TEXT DEFAULT 'database',
  p_reason TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.inventory_transactions (
    product_id,
    sale_id,
    action,
    quantity_change,
    stock_before,
    stock_after,
    source,
    reason,
    metadata
  ) VALUES (
    p_product_id,
    p_sale_id,
    p_action,
    p_quantity_change,
    p_stock_before,
    p_stock_after,
    p_source,
    p_reason,
    COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.apply_stock_for_sale_insert()
RETURNS TRIGGER AS $$
DECLARE
  stock_before INTEGER;
  stock_after INTEGER;
BEGIN
  IF NEW.id IS NULL THEN
    NEW.id := gen_random_uuid();
  END IF;

  IF NEW.quantity <= 0 THEN
    RAISE EXCEPTION 'Sale quantity must be greater than zero';
  END IF;

  NEW.updated_at := COALESCE(NEW.updated_at, NOW());

  SELECT stock_quantity INTO stock_before
  FROM public.products
  WHERE id = NEW.product_id
  FOR UPDATE;

  IF stock_before IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  IF stock_before < NEW.quantity THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', stock_before, NEW.quantity;
  END IF;

  stock_after := stock_before - NEW.quantity;

  UPDATE public.products
  SET stock_quantity = stock_after,
      updated_at = NOW()
  WHERE id = NEW.product_id;

  PERFORM public.write_inventory_ledger(
    NEW.product_id,
    NEW.id,
    'sale_created',
    -NEW.quantity,
    stock_before,
    stock_after,
    'sales_trigger',
    NEW.notes,
    jsonb_build_object('sale_date', NEW.sale_date, 'unit_price', NEW.unit_price)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.apply_stock_for_sale_update()
RETURNS TRIGGER AS $$
DECLARE
  quantity_diff INTEGER;
  stock_before INTEGER;
  stock_after INTEGER;
BEGIN
  IF NEW.quantity <= 0 THEN
    RAISE EXCEPTION 'Sale quantity must be greater than zero';
  END IF;

  NEW.updated_at := NOW();

  IF NEW.product_id = OLD.product_id THEN
    quantity_diff := NEW.quantity - OLD.quantity;

    IF quantity_diff <> 0 THEN
      SELECT stock_quantity INTO stock_before
      FROM public.products
      WHERE id = NEW.product_id
      FOR UPDATE;

      IF stock_before IS NULL THEN
        RAISE EXCEPTION 'Product not found';
      END IF;

      IF quantity_diff > 0 AND stock_before < quantity_diff THEN
        RAISE EXCEPTION 'Insufficient stock. Available: %, Required: %', stock_before, quantity_diff;
      END IF;

      stock_after := stock_before - quantity_diff;

      UPDATE public.products
      SET stock_quantity = stock_after,
          updated_at = NOW()
      WHERE id = NEW.product_id;

      PERFORM public.write_inventory_ledger(
        NEW.product_id,
        NEW.id,
        CASE WHEN quantity_diff > 0 THEN 'sale_quantity_increased' ELSE 'sale_quantity_decreased' END,
        -quantity_diff,
        stock_before,
        stock_after,
        'sales_trigger',
        NEW.notes,
        jsonb_build_object('old_quantity', OLD.quantity, 'new_quantity', NEW.quantity)
      );
    END IF;

    RETURN NEW;
  END IF;

  SELECT stock_quantity INTO stock_before
  FROM public.products
  WHERE id = OLD.product_id
  FOR UPDATE;

  IF stock_before IS NOT NULL THEN
    stock_after := stock_before + OLD.quantity;
    UPDATE public.products
    SET stock_quantity = stock_after,
        updated_at = NOW()
    WHERE id = OLD.product_id;

    PERFORM public.write_inventory_ledger(
      OLD.product_id,
      NEW.id,
      'sale_product_changed_restore',
      OLD.quantity,
      stock_before,
      stock_after,
      'sales_trigger',
      NEW.notes,
      jsonb_build_object('new_product_id', NEW.product_id)
    );
  END IF;

  SELECT stock_quantity INTO stock_before
  FROM public.products
  WHERE id = NEW.product_id
  FOR UPDATE;

  IF stock_before IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  IF stock_before < NEW.quantity THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', stock_before, NEW.quantity;
  END IF;

  stock_after := stock_before - NEW.quantity;

  UPDATE public.products
  SET stock_quantity = stock_after,
      updated_at = NOW()
  WHERE id = NEW.product_id;

  PERFORM public.write_inventory_ledger(
    NEW.product_id,
    NEW.id,
    'sale_product_changed_deduct',
    -NEW.quantity,
    stock_before,
    stock_after,
    'sales_trigger',
    NEW.notes,
    jsonb_build_object('old_product_id', OLD.product_id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.apply_stock_for_sale_delete()
RETURNS TRIGGER AS $$
DECLARE
  stock_before INTEGER;
  stock_after INTEGER;
BEGIN
  SELECT stock_quantity INTO stock_before
  FROM public.products
  WHERE id = OLD.product_id
  FOR UPDATE;

  IF stock_before IS NULL THEN
    RETURN OLD;
  END IF;

  stock_after := stock_before + OLD.quantity;

  UPDATE public.products
  SET stock_quantity = stock_after,
      updated_at = NOW()
  WHERE id = OLD.product_id;

  PERFORM public.write_inventory_ledger(
    OLD.product_id,
    OLD.id,
    'sale_deleted_restore',
    OLD.quantity,
    stock_before,
    stock_after,
    'sales_trigger',
    OLD.notes,
    jsonb_build_object('sale_date', OLD.sale_date)
  );

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_stock_after_sale ON public.sales;
DROP TRIGGER IF EXISTS trigger_restore_stock_after_sale_delete ON public.sales;
DROP TRIGGER IF EXISTS trigger_update_stock_after_sale_update ON public.sales;
DROP TRIGGER IF EXISTS trigger_apply_stock_for_sale_insert ON public.sales;
DROP TRIGGER IF EXISTS trigger_apply_stock_for_sale_update ON public.sales;
DROP TRIGGER IF EXISTS trigger_apply_stock_for_sale_delete ON public.sales;

CREATE TRIGGER trigger_apply_stock_for_sale_insert
  BEFORE INSERT ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_stock_for_sale_insert();

CREATE TRIGGER trigger_apply_stock_for_sale_update
  BEFORE UPDATE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_stock_for_sale_update();

CREATE TRIGGER trigger_apply_stock_for_sale_delete
  BEFORE DELETE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_stock_for_sale_delete();

CREATE OR REPLACE FUNCTION public.create_sale_with_stock_check(
  p_product_id UUID,
  p_quantity INTEGER,
  p_unit_price DECIMAL,
  p_total_amount DECIMAL,
  p_profit DECIMAL,
  p_sale_date DATE DEFAULT CURRENT_DATE,
  p_notes TEXT DEFAULT NULL,
  p_customer_info JSONB DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  sale_id UUID;
  new_stock_quantity INTEGER;
BEGIN
  INSERT INTO public.sales (
    product_id,
    quantity,
    unit_price,
    total_amount,
    profit,
    sale_date,
    notes,
    customer_info,
    updated_at
  ) VALUES (
    p_product_id,
    p_quantity,
    p_unit_price,
    p_total_amount,
    p_profit,
    p_sale_date,
    p_notes,
    p_customer_info,
    NOW()
  )
  RETURNING id INTO sale_id;

  SELECT stock_quantity INTO new_stock_quantity
  FROM public.products
  WHERE id = p_product_id;

  RETURN json_build_object(
    'success', true,
    'sale_id', sale_id,
    'product_id', p_product_id,
    'new_stock_quantity', new_stock_quantity
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_sale_with_stock_check(
  p_sale_id UUID,
  p_product_id UUID DEFAULT NULL,
  p_quantity INTEGER DEFAULT NULL,
  p_unit_price DECIMAL DEFAULT NULL,
  p_total_amount DECIMAL DEFAULT NULL,
  p_profit DECIMAL DEFAULT NULL,
  p_customer_info JSONB DEFAULT NULL,
  p_sale_date DATE DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  updated_sale public.sales%ROWTYPE;
  new_stock_quantity INTEGER;
BEGIN
  UPDATE public.sales
  SET product_id = COALESCE(p_product_id, product_id),
      quantity = COALESCE(p_quantity, quantity),
      unit_price = COALESCE(p_unit_price, unit_price),
      total_amount = COALESCE(p_total_amount, total_amount),
      profit = COALESCE(p_profit, profit),
      customer_info = COALESCE(p_customer_info, customer_info),
      sale_date = COALESCE(p_sale_date, sale_date),
      notes = COALESCE(p_notes, notes),
      updated_at = NOW()
  WHERE id = p_sale_id
  RETURNING * INTO updated_sale;

  IF updated_sale.id IS NULL THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;

  SELECT stock_quantity INTO new_stock_quantity
  FROM public.products
  WHERE id = updated_sale.product_id;

  RETURN json_build_object(
    'success', true,
    'sale_id', updated_sale.id,
    'product_id', updated_sale.product_id,
    'new_stock_quantity', new_stock_quantity
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.delete_sale_with_stock_check(
  p_sale_id UUID
)
RETURNS JSON AS $$
DECLARE
  deleted_product_id UUID;
  new_stock_quantity INTEGER;
BEGIN
  SELECT product_id INTO deleted_product_id
  FROM public.sales
  WHERE id = p_sale_id;

  IF deleted_product_id IS NULL THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;

  DELETE FROM public.sales
  WHERE id = p_sale_id;

  SELECT stock_quantity INTO new_stock_quantity
  FROM public.products
  WHERE id = deleted_product_id;

  RETURN json_build_object(
    'success', true,
    'sale_id', p_sale_id,
    'product_id', deleted_product_id,
    'new_stock_quantity', new_stock_quantity
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.create_sale_with_stock_check(
  UUID, INTEGER, DECIMAL, DECIMAL, DECIMAL, DATE, TEXT, JSONB
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.update_sale_with_stock_check(
  UUID, UUID, INTEGER, DECIMAL, DECIMAL, DECIMAL, JSONB, DATE, TEXT
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.delete_sale_with_stock_check(UUID) TO authenticated;

COMMIT;
