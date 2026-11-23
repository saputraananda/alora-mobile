/** PIN karyawan: tepat 4 digit angka, berupa string supaya nol di depan tidak hilang. */
export const isValidPin = (value) => typeof value === 'string' && /^\d{4}$/.test(value);
