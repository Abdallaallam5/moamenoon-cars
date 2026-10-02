// Input validation. Every failure is { error: CODE, field } so the UI can show a translated message.

class ValidationError extends Error {
  constructor(code, field) {
    super(code);
    this.code = code;
    this.field = field;
    this.status = 400;
  }
}

const CATEGORIES = ['import', 'disabled', 'trucks'];
const CONDITIONS = ['new', 'used'];
const TRANSMISSIONS = ['auto', 'manual'];
const FUELS = ['petrol', 'diesel', 'hybrid', 'electric'];

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function oneOf(v, list, code, field, optional = false) {
  const s = str(v, 40);
  if (!s && optional) return null;
  if (!list.includes(s)) throw new ValidationError(code, field);
  return s;
}

function optInt(v, field, min, max) {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const n = Number(String(v).replace(/[,\s]/g, ''));
  if (!Number.isInteger(n) || n < min || n > max) throw new ValidationError('INVALID_NUMBER', field);
  return n;
}

/**
 * Normalises a WhatsApp number to the international digits that wa.me links need.
 * 01012345678 -> 201012345678, +20 101 234 5678 -> 201012345678, Arabic digits are accepted.
 * Empty -> null (optional). Anything that is not 8-15 digits -> INVALID_WHATSAPP.
 */
function parseWhatsapp(v) {
  const raw = str(v, 30).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  if (!raw) return null;
  let d = raw.replace(/[\s\-().]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  else if (/^0\d{10}$/.test(d)) d = `20${d.slice(1)}`; // Egyptian local format
  if (!/^\d{8,15}$/.test(d)) throw new ValidationError('INVALID_WHATSAPP', 'whatsapp');
  return d;
}

function parseEmail(v) {
  const s = str(v, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) throw new ValidationError('INVALID_EMAIL', 'email');
  return s;
}

function parsePassword(v) {
  if (typeof v !== 'string' || v.length < 8 || v.length > 100) throw new ValidationError('WEAK_PASSWORD', 'password');
  return v;
}

function parseSignup(b) {
  const name = str(b.name, 80);
  if (name.length < 2) throw new ValidationError('INVALID_NAME', 'name');
  const phone = str(b.phone, 25);
  if (!/^\d{8,15}$/.test(phone.replace(/[\s\-+()]/g, ''))) throw new ValidationError('INVALID_PHONE', 'phone');
  const type = oneOf(b.type, ['user', 'dealer'], 'INVALID_TYPE', 'type');
  return {
    email: parseEmail(b.email),
    password: parsePassword(b.password),
    name,
    phone,
    type,
    business: type === 'dealer' ? str(b.business, 100) || null : null,
    lang: b.lang === 'en' ? 'en' : 'ar',
  };
}

function parseCar(b) {
  const brand = str(b.brand, 60);
  if (!brand) throw new ValidationError('INVALID_BRAND', 'brand');
  const model = str(b.model, 60);
  if (!model) throw new ValidationError('INVALID_MODEL', 'model');
  const year = Number(b.year);
  if (!Number.isInteger(year) || year < 1950 || year > new Date().getFullYear() + 1) throw new ValidationError('INVALID_YEAR', 'year');
  return {
    category: oneOf(b.category, CATEGORIES, 'INVALID_CATEGORY', 'category'),
    brand,
    model,
    year,
    condition: oneOf(b.condition, CONDITIONS, 'INVALID_CONDITION', 'condition'),
    price: optInt(b.price, 'price', 0, 1e11),
    mileage: optInt(b.mileage, 'mileage', 0, 5e6),
    transmission: oneOf(b.transmission, TRANSMISSIONS, 'INVALID_TRANSMISSION', 'transmission', true),
    fuel: oneOf(b.fuel, FUELS, 'INVALID_FUEL', 'fuel', true),
    color: str(b.color, 40) || null,
    engine_cc: optInt(b.engine_cc, 'engine_cc', 0, 100000),
    description: str(b.description, 3000) || null,
    whatsapp: parseWhatsapp(b.whatsapp),
  };
}

module.exports = { ValidationError, parseSignup, parseEmail, parseCar, CATEGORIES };
