-- Function to update product stock when a sale is updated
CREATE OR REPLACE FUNCTION update_product_stock_after_sale_update()
RETURNS TRIGGER AS $$
DECLARE
    v_diff INTEGER;
    v_stock INTEGER;
BEGIN
    NEW.updated_at = NOW();

    -- Calculate quantity difference (new - old)
    v_diff := NEW.quantity - OLD.quantity;

    -- If product changed (rare but possible), we need to handle both
    IF NEW.product_id != OLD.product_id THEN
        -- Restore stock to old product
        UPDATE products SET stock_quantity = stock_quantity + OLD.quantity WHERE id = OLD.product_id;
        
        -- Deduct from new product
        SELECT stock_quantity INTO v_stock FROM products WHERE id = NEW.product_id;
        IF v_stock < NEW.quantity THEN
            RAISE EXCEPTION 'Insufficient stock for new product';
        END IF;
        UPDATE products SET stock_quantity = stock_quantity - NEW.quantity WHERE id = NEW.product_id;
    ELSE
        -- Same product, adjust by difference
        IF v_diff != 0 THEN
            SELECT stock_quantity INTO v_stock FROM products WHERE id = NEW.product_id;
            
            IF v_diff > 0 AND v_stock < v_diff THEN
                RAISE EXCEPTION 'Insufficient stock. Available: %, Required: %', v_stock, v_diff;
            END IF;

            UPDATE products
            SET stock_quantity = stock_quantity - v_diff,
                updated_at = NOW()
            WHERE id = NEW.product_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for sale update
DROP TRIGGER IF EXISTS trigger_update_stock_after_sale_update ON sales;
CREATE TRIGGER trigger_update_stock_after_sale_update
    BEFORE UPDATE ON sales
    FOR EACH ROW
    EXECUTE FUNCTION update_product_stock_after_sale_update();
