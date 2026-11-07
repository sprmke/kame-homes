import {
  base45Decode,
  canonicalJson,
  decodeCbor,
  decodePhilSysPayload,
  normalizeDate,
} from './philsysQr.ts';

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin);
}

function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const BASE45_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

function base45Encode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 2) {
    if (i + 1 < bytes.length) {
      const value = (bytes[i] ?? 0) * 256 + (bytes[i + 1] ?? 0);
      out += BASE45_CHARS[value % 45];
      out += BASE45_CHARS[Math.floor(value / 45) % 45];
      out += BASE45_CHARS[Math.floor(value / (45 * 45)) % 45];
    } else {
      const value = bytes[i] ?? 0;
      out += BASE45_CHARS[value % 45];
      out += BASE45_CHARS[Math.floor(value / 45) % 45];
    }
  }
  return out;
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([Uint8Array.from(bytes)])
    .stream()
    .pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Hand-rolled CBOR writer for the tiny fixture shape we need. */
function encodeCborText(text: string): number[] {
  const bytes = Array.from(new TextEncoder().encode(text));
  if (bytes.length >= 24) throw new Error('fixture too long');
  return [0x60 | bytes.length, ...bytes];
}

function encodeCborMap(entries: Array<[string, string | number | Uint8Array]>): Uint8Array {
  const out: number[] = [0xa0 | entries.length];
  for (const [key, value] of entries) {
    out.push(...encodeCborText(key));
    if (typeof value === 'string') {
      const bytes = Array.from(new TextEncoder().encode(value));
      if (bytes.length >= 24) {
        out.push(0x78, bytes.length, ...bytes);
      } else {
        out.push(0x60 | bytes.length, ...bytes);
      }
    } else if (typeof value === 'number') {
      out.push(value);
    } else {
      out.push(0x58, value.length, ...Array.from(value));
    }
  }
  return Uint8Array.from(out);
}

Deno.test('base45 matches the RFC 9285 vectors', () => {
  const ab = base45Decode('BB8');
  if (new TextDecoder().decode(ab) !== 'AB') throw new Error('decode AB');

  const hello = base45Decode('%69 VD92EX0');
  if (new TextDecoder().decode(hello) !== 'Hello!!') throw new Error('decode Hello!!');

  const bytes = new TextEncoder().encode('PHILSYS-TEST');
  const roundTrip = base45Decode(base45Encode(bytes));
  if (new TextDecoder().decode(roundTrip) !== 'PHILSYS-TEST') throw new Error('round-trip');
});

Deno.test('base45 rejects malformed input', () => {
  let threw = false;
  try {
    base45Decode('A');
  } catch {
    threw = true;
  }
  if (!threw) throw new Error('single-character base45 must throw');
});

Deno.test('CBOR decodes a small map, array and byte string', () => {
  const decoded = decodeCbor(Uint8Array.from([0xa1, 0x61, 0x61, 0x01]));
  if (JSON.stringify(decoded) !== '{"a":1}') throw new Error('map');
  const array = decodeCbor(Uint8Array.from([0x82, 0x01, 0x02]));
  if (JSON.stringify(array) !== '[1,2]') throw new Error('array');
  const bytes = decodeCbor(Uint8Array.from([0x43, 0x01, 0x02, 0x03]));
  if (!(bytes instanceof Uint8Array) || bytes.length !== 3) throw new Error('byte string');
});

Deno.test('canonicalJson sorts keys so the signature input is stable', () => {
  const a = canonicalJson({ b: 2, a: 1, c: { z: 1, y: 2 } });
  const b = canonicalJson({ c: { y: 2, z: 1 }, a: 1, b: 2 });
  if (a !== b) throw new Error('canonical json must be order-independent');
});

Deno.test('v1 JSON with a valid Ed25519 signature verifies', async () => {
  const keyPair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', keyPair.publicKey));
  const publicKeyBase64 = toBase64(spki);

  const body = {
    firstName: 'Maria',
    middleName: 'Santos',
    lastName: 'Cruz',
    dateOfBirth: '1990-05-04',
    sex: 'F',
    pcn: '1234-5678-9012-3456',
  };
  const payload = canonicalJson(body);
  const signature = new Uint8Array(
    await crypto.subtle.sign('Ed25519', keyPair.privateKey, new TextEncoder().encode(payload))
  );

  const result = await decodePhilSysPayload(JSON.stringify({ ...body, signature: toBase64Url(signature) }), {
    publicKeyBase64,
  });
  if (result.kind !== 'v1') throw new Error('expected v1');
  if (!result.signature.checked || !result.signature.valid) throw new Error('signature must verify');
  if (result.fields?.fullName !== 'Maria Santos Cruz') throw new Error('name extraction');
  if (result.fields.documentNumber !== '1234-5678-9012-3456') throw new Error('pcn extraction');
  if (result.fields.nationality !== 'Filipino') throw new Error('nationality');
});

Deno.test('v1 JSON with a bad signature reports checked + invalid', async () => {
  const keyPair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', keyPair.publicKey));
  const body = { firstName: 'Juan', lastName: 'Dela Cruz', dateOfBirth: '1988-01-02' };
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      'Ed25519',
      keyPair.privateKey,
      new TextEncoder().encode(canonicalJson({ ...body, firstName: 'Someone' }))
    )
  );
  const result = await decodePhilSysPayload(JSON.stringify({ ...body, signature: toBase64Url(signature) }), {
    publicKeyBase64: toBase64(spki),
  });
  if (!result.signature.checked || result.signature.valid) throw new Error('expected invalid signature');
});

Deno.test('v1 JSON without a configured key is not checked (and not a failure)', async () => {
  const result = await decodePhilSysPayload(
    JSON.stringify({ firstName: 'Ana', lastName: 'Reyes', signature: 'AAAA' })
  );
  if (result.signature.checked) throw new Error('must not claim to have checked');
  if (result.signature.reason !== 'no_key_configured') throw new Error('reason');
  if (!result.fields) throw new Error('fields should still be readable');
});

Deno.test('v3 base45 + deflate + CBOR extracts fields and a portrait', async () => {
  const portrait = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  const cbor = encodeCborMap([
    ['firstName', 'Liza'],
    ['lastName', 'Mendoza'],
    ['dateOfBirth', '1995/07/09'],
    ['sex', 'F'],
    ['pcn', '9876543210'],
    ['portrait', portrait],
  ]);
  const compressed = await deflate(cbor);
  const v3 = `PHILSYS:${base45Encode(compressed)}`;

  const result = await decodePhilSysPayload(v3);
  if (result.kind !== 'v3') throw new Error('expected v3');
  if (result.fields?.fullName !== 'Liza Mendoza') throw new Error(`name: ${result.fields?.fullName}`);
  if (result.fields.dateOfBirth !== '1995-07-09') throw new Error(`dob: ${result.fields.dateOfBirth}`);
  if (!result.fields.portraitBytes) throw new Error('portrait expected');
  if (result.fields.portraitMime !== 'image/jpeg') throw new Error('portrait mime');
  if (result.signature.checked) throw new Error('v3 is not signature-checked without a published scheme');
});

Deno.test('an unknown payload shape yields no fields rather than guessing', async () => {
  const result = await decodePhilSysPayload('TOTALLY-NOT-A-PHILSYS-PAYLOAD-<>&');
  if (result.fields !== null) throw new Error('must not invent fields');
  if (result.kind !== null) throw new Error('must not claim a kind');
});

Deno.test('malformed JSON yields no fields', async () => {
  const result = await decodePhilSysPayload('{"firstName": ');
  if (result.fields !== null) throw new Error('must not invent fields');
});

Deno.test('normalizeDate handles ISO, MMDDYYYY and invalid values', () => {
  if (normalizeDate('1990-05-04') !== '1990-05-04') throw new Error('iso');
  if (normalizeDate('05/04/1990') !== '1990-05-04') throw new Error('slash');
  if (normalizeDate('') !== null) throw new Error('empty');
  if (normalizeDate('nonsense') !== null) throw new Error('invalid');
});
