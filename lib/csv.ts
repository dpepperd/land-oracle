// One CSV writer for every export (parcel export and AI assistant export).
// Spreadsheet formula protection: a text value that starts with = + - @ (or a tab / carriage return) would be run as a formula when the file is opened
// in Excel or Google Sheets (for example an owner name of =HYPERLINK(...)). Such text gets a leading apostrophe, which spreadsheets show as plain text.
// Numbers and dates are left alone (a negative number is not text).
const DANGEROUS_START = /^[=+\-@\t\r]/;

export function csvCell(val: unknown): string {
  if (val === null || val === undefined) return '';
  let str = String(val); // same text as before for numbers and dates (export format unchanged)
  if (typeof val === 'string' && DANGEROUS_START.test(str)) str = `'${str}`;
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function toCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map((row) => headers.map((h) => csvCell(row[h])).join(','));
  return [headers.join(','), ...rows].join('\n');
}
