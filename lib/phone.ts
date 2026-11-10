export function normalizePhone(value: string): string {
 const compact = value.replace(/[\s()-]/g,'');
 const phone = /^[6-9]\d{9}$/.test(compact) ? '+91'+compact : compact;
 if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error('Enter a 10-digit Indian mobile number, or include the country code.');
 return phone;
}
// Reserved non-deliverable identifier; no email/SMS is sent for staff login.
export const staffLoginEmail = (phone: string) => `staff.${normalizePhone(phone).slice(1)}@bolbahi.invalid`;
