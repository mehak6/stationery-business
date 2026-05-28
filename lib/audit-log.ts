'use client';

import { supabase } from '../supabase_client';

export const logAuditEvent = async (event: {
  action: string;
  entity_type: string;
  entity_id: string;
  reason: string;
  metadata?: Record<string, any>;
}) => {
  try {
    await (supabase.from('audit_logs') as any).insert({
      action: event.action,
      entity_type: event.entity_type,
      entity_id: event.entity_id,
      reason: event.reason,
      metadata: event.metadata || null,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.warn('Audit log insert skipped:', error);
  }
};
