/** Format a number as BRL currency: R$ 1.234,56 */
export function formatPrice(value: number): string {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Format a number as BRL currency using Intl: R$ 1.234,56 */
export function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Format YYYY-MM-DD → DD/MM/YYYY */
export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

/** Today's date as YYYY-MM-DD */
export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Current datetime as YYYY-MM-DDTHH:mm:ss */
export function nowStr(): string {
  return new Date().toISOString().slice(0, 19);
}

/** Convert a Date to YYYY-MM-DD */
export function dateToStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Add days to a date string, return YYYY-MM-DD */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Format phone number: (XX) XXXXX-XXXX */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}
