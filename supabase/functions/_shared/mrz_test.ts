import { buildTd3MrzForTests, mrzCheckDigit, mrzDateToYmd, parseMrz } from './mrz.ts';

Deno.test('check digit matches the ICAO 9303 worked example', () => {
  // ICAO 9303 part 3 worked example: document number D23145890 -> check digit 7.
  if (mrzCheckDigit('D23145890') !== 7) throw new Error('expected 7');
  if (mrzCheckDigit('740812') !== 2) throw new Error('date check digit');
});

Deno.test('TD3 passport parses when every check digit is valid', () => {
  const [line1, line2] = buildTd3MrzForTests({
    documentNumber: 'P1234567',
    surname: 'DELACRUZ',
    givenNames: 'JUAN CARLOS',
    dateOfBirth: '880102',
    sex: 'M',
    expiry: '310101',
  });
  const parsed = parseMrz(`${line1}\n${line2}`);
  if (!parsed) throw new Error('expected a parsed MRZ');
  if (parsed.format !== 'TD3') throw new Error('format');
  if (parsed.documentNumber !== 'P1234567') throw new Error(`document number: ${parsed.documentNumber}`);
  if (parsed.lastName !== 'DELACRUZ') throw new Error(`last name: ${parsed.lastName}`);
  if (parsed.firstName !== 'JUAN CARLOS') throw new Error(`first name: ${parsed.firstName}`);
  if (parsed.dateOfBirth !== '1988-01-02') throw new Error(`dob: ${parsed.dateOfBirth}`);
  if (parsed.documentExpiry !== '2031-01-01') throw new Error(`expiry: ${parsed.documentExpiry}`);
  if (parsed.sex !== 'male') throw new Error('sex');
  if (parsed.issuingCountry !== 'PHL') throw new Error('country');
});

Deno.test('a corrupted check digit rejects the whole read', () => {
  const [line1, line2] = buildTd3MrzForTests({
    documentNumber: 'P7654321',
    surname: 'REYES',
    givenNames: 'ANA',
    dateOfBirth: '950709',
    sex: 'F',
    expiry: '300505',
  });
  const corrupted = `${line2.slice(0, 43)}9`;
  const parsed = parseMrz(`${line1}\n${corrupted}`);
  if (parsed !== null) throw new Error('a failed composite check must return null');
});

Deno.test('garbage input returns null, never a half-read identity', () => {
  if (parseMrz('hello world') !== null) throw new Error('garbage');
  if (parseMrz('') !== null) throw new Error('empty');
  if (parseMrz(null) !== null) throw new Error('null');
  if (parseMrz('A'.repeat(44)) !== null) throw new Error('right length, no check digits');
});

Deno.test('mrzDateToYmd applies the ICAO century rule', () => {
  if (mrzDateToYmd('880102', 'birth') !== '1988-01-02') throw new Error('birth century');
  if (mrzDateToYmd('310101', 'expiry') !== '2031-01-01') throw new Error('expiry century');
  if (mrzDateToYmd('991399', 'birth') !== null) throw new Error('invalid month');
  if (mrzDateToYmd('abc', 'birth') !== null) throw new Error('invalid input');
});
