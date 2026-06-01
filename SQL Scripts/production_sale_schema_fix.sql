-- Production sale schema fix for Stationery Business
-- Safe to run more than once in the Supabase SQL editor.
-- Run after taking a data backup.

BEGIN;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;

UPDATE public.sales
SET updated_at = COALESCE(updated_at, created_at, NOW())
WHERE updated_at IS NULL;

ALTER TABLE public.sales
  ALTER COLUMN updated_at SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_sales_updated_at ON public.sales(updated_at);

CREATE OR REPLACE FUNCTION public.update_product_stock_after_sale()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.products
  SET stock_quantity = stock_quantity - NEW.quantity,
      updated_at = NOW()
  WHERE id = NEW.product_id;

  IF (SELECT stock_quantity FROM public.products WHERE id = NEW.product_id) < 0 THEN
    RAISE EXCEPTION 'Insufficient stock for product ID: %. Available stock: %',
      NEW.product_id,
      (SELECT stock_quantity + NEW.quantity FROM public.products WHERE id = NEW.product_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.restore_product_stock_after_sale_delete()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.products
  SET stock_quantity = stock_quantity + OLD.quantity,
      updated_at = NOW()
  WHERE id = OLD.product_id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_product_stock_after_sale_update()
RETURNS TRIGGER AS $$
DECLARE
  quantity_diff INTEGER;
  available_stock INTEGER;
BEGIN
  NEW.updated_at = NOW();

  IF NEW.product_id <> OLD.product_id THEN
    UPDATE public.products
    SET stock_quantity = stock_quantity + OLD.quantity,
        updated_at = NOW()
    WHERE id = OLD.product_id;

    SELECT stock_quantity INTO available_stock
    FROM public.products
    WHERE id = NEW.product_id;

    IF available_stock < NEW.quantity THEN
      RAISE EXCEPTION 'Insufficient stock. Available: %, Required: %', available_stock, NEW.quantity;
    END IF;

    UPDATE public.products
    SET stock_quantity = stock_quantity - NEW.quantity,
        updated_at = NOW()
    WHERE id = NEW.product_id;
  ELSE
    quantity_diff := NEW.quantity - OLD.quantity;

    IF quantity_diff <> 0 THEN
      SELECT stock_quantity INTO available_stock
      FROM public.products
      WHERE id = NEW.product_id;

      IF quantity_diff > 0 AND available_stock < quantity_diff THEN
        RAISE EXCEPTION 'Insufficient stock. Available: %, Required: %', available_stock, quantity_diff;
      END IF;

      UPDATE public.products
      SET stock_quantity = stock_quantity - quantity_diff,
          updated_at = NOW()
      WHERE id = NEW.product_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_stock_after_sale ON public.sales;
CREATE TRIGGER trigger_update_stock_after_sale
  AFTER INSERT ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.update_product_stock_after_sale();

DROP TRIGGER IF EXISTS trigger_restore_stock_after_sale_delete ON public.sales;
CREATE TRIGGER trigger_restore_stock_after_sale_delete
  AFTER DELETE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.restore_product_stock_after_sale_delete();

DROP TRIGGER IF EXISTS trigger_update_stock_after_sale_update ON public.sales;
CREATE TRIGGER trigger_update_stock_after_sale_update
  BEFORE UPDATE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.update_product_stock_after_sale_update();

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
  SELECT stock_quantity INTO new_stock_quantity
  FROM public.products
  WHERE id = p_product_id;

  IF new_stock_quantity IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  IF new_stock_quantity < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', new_stock_quantity, p_quantity;
  END IF;

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
  UUID,
  INTEGER,
  DECIMAL,
  DECIMAL,
  DECIMAL,
  DATE,
  TEXT,
  JSONB
) TO anon, authenticated;

COMMIT;
