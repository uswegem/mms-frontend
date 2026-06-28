import tanzaniaData from '@/data/tanzania-locations.json';

interface Ward { name: string; postcode: string }
interface District { name: string; wards: Ward[] }
interface Region { region: string; districts: District[] }

const LOCATIONS = tanzaniaData as Region[];

export function useTanzaniaLocations(region?: string, district?: string) {
  const regions = LOCATIONS.map((r) => r.region);

  const districts = region
    ? (LOCATIONS.find((r) => r.region === region)?.districts.map((d) => d.name) ?? [])
    : [];

  const wards =
    region && district
      ? (LOCATIONS.find((r) => r.region === region)
          ?.districts.find((d) => d.name === district)
          ?.wards.map((w) => w.name) ?? [])
      : [];

  function getPostcode(wardName: string): string {
    if (!region || !district) return '';
    return (
      LOCATIONS.find((r) => r.region === region)
        ?.districts.find((d) => d.name === district)
        ?.wards.find((w) => w.name === wardName)
        ?.postcode ?? ''
    );
  }

  return { regions, districts, wards, getPostcode };
}
