/**
 * Builds src/data/tanzania-locations.json from the mtaa CSV files.
 *
 * CSV formats vary by region file:
 *   Arusha/DSM:  REGION, REGIONCODE, DISTRICT, DISTRICTCODE, WARD, WARDCODE, STREET, PLACES
 *   All others:  REGION, POSTCODE,   DISTRICT, POSTCODE,     WARD, POSTCODE, STREET, PLACES
 *
 * In both formats: col[0]=region, col[2]=district, col[4]=ward, col[5]=postcode (ward-level).
 * Uses positional parsing so header naming differences don't matter.
 *
 * Run: node scripts/build-tanzania-locations.mjs
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'https://raw.githubusercontent.com/kalebu/mtaa/master/locations';

const REGION_FILES = [
  'arusha', 'dar-es-salaam', 'dodoma', 'geita', 'iringa',
  'kagera', 'katavi', 'kigoma', 'kilimanjaro', 'lindi',
  'manyara', 'mara', 'mbeya', 'morogoro', 'mtwara',
  'mwanza', 'njombe', 'pwani', 'rukwa', 'ruvuma',
  'shinyanga', 'simiyu', 'singida', 'songwe', 'tabora', 'tanga',
];

function toTitleCase(str) {
  return str
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Tokenise a full CSV text into records (handles multiline quoted fields).
 * Returns string[][] — one inner array per data row (header row excluded).
 */
function tokeniseCSV(text) {
  const records = [];
  let record = [];
  let field = '';
  let inQuote = false;
  let i = 0;

  // Normalise line endings
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  while (i < src.length) {
    const ch = src[i];

    if (inQuote) {
      if (ch === '"') {
        // Peek ahead — double-quote escape?
        if (src[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuote = false;
      } else {
        field += ch; // includes embedded newlines
      }
    } else {
      if (ch === '"') {
        inQuote = true;
      } else if (ch === ',') {
        record.push(field.trim());
        field = '';
      } else if (ch === '\n') {
        record.push(field.trim());
        field = '';
        if (record.some((f) => f !== '')) records.push(record);
        record = [];
      } else {
        field += ch;
      }
    }
    i++;
  }
  // Last field / record
  record.push(field.trim());
  if (record.some((f) => f !== '')) records.push(record);

  // Drop header row (first record)
  return records.slice(1);
}

async function fetchCSV(slug) {
  const url = `${BASE_URL}/${slug}.csv`;
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`  ⚠️  ${slug}.csv → HTTP ${res.status} — skipping`);
    return [];
  }
  const text = await res.text();
  const records = tokeniseCSV(text);

  const rows = [];
  for (const cols of records) {
    // Positional: col[0]=region, col[2]=district, col[4]=ward, col[5]=ward postcode
    if (cols.length < 6) continue;
    const region = cols[0];
    const district = cols[2];
    const ward = cols[4];
    const postcode = cols[5];
    if (!region || !district || !ward || !postcode) continue;
    // Skip rows where postcode isn't numeric (could be a header or junk line)
    if (!/^\d+$/.test(postcode)) continue;
    rows.push({ region, district, ward, postcode });
  }
  return rows;
}

async function main() {
  console.log('Fetching Tanzania location CSVs from mtaa repo...\n');

  // regionName → districtName → Map<wardName, postcode>
  const data = new Map();

  for (const slug of REGION_FILES) {
    process.stdout.write(`  ${slug.padEnd(20)}`);
    const rows = await fetchCSV(slug);

    for (const row of rows) {
      const region = toTitleCase(row.region);
      const district = toTitleCase(row.district);
      const ward = toTitleCase(row.ward);
      const postcode = row.postcode.padStart(5, '0');

      if (!data.has(region)) data.set(region, new Map());
      const regionMap = data.get(region);
      if (!regionMap.has(district)) regionMap.set(district, new Map());
      const districtMap = regionMap.get(district);
      // First postcode wins — duplicate rows differ only by street/place name
      if (!districtMap.has(ward)) districtMap.set(ward, postcode);
    }

    // Find which region name this slug produced
    const regionName = rows[0]?.region ? toTitleCase(rows[0].region) : null;
    const dCount = regionName ? (data.get(regionName)?.size ?? 0) : 0;
    const wCount = regionName
      ? [...(data.get(regionName)?.values() ?? [])].reduce((s, m) => s + m.size, 0)
      : 0;
    console.log(`✓  ${dCount} districts, ${wCount} wards`);
  }

  // Build output array sorted alphabetically
  const output = [];
  for (const [region, districtMap] of [...data.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const districts = [];
    for (const [name, wardMap] of [...districtMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const wards = [...wardMap.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([wardName, postcode]) => ({ name: wardName, postcode }));
      districts.push({ name, wards });
    }
    output.push({ region, districts });
  }

  const totalDistricts = output.reduce((s, r) => s + r.districts.length, 0);
  const totalWards = output.reduce((s, r) => r.districts.reduce((ds, d) => ds + d.wards.length, s), 0);
  console.log(`\nTotals: ${output.length} regions, ${totalDistricts} districts, ${totalWards} wards`);

  const outDir = join(__dirname, '..', 'src', 'data');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'tanzania-locations.json');
  writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');
  console.log(`\n✅  Written to src/data/tanzania-locations.json`);

  // Print a sample
  const sample = output.find((r) => r.region === 'Dodoma') ?? output[0];
  const sampleDistrict = sample.districts[0];
  console.log(`\n--- Sample (${sample.region} → ${sampleDistrict.name}) ---`);
  sampleDistrict.wards.slice(0, 6).forEach((w) =>
    console.log(`    ${w.name.padEnd(32)} ${w.postcode}`),
  );
}

main().catch((err) => { console.error(err); process.exit(1); });
