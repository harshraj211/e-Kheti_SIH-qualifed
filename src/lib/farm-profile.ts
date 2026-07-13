export const FARM_PROFILE_STORAGE_KEY = 'ekheti-farm-profile-v1';

export type NutrientLevel = '' | 'low' | 'medium' | 'high';

export type FarmProfile = {
  farmerName: string;
  location: string;
  acreage: string;
  crop: string;
  variety: string;
  sowingDate: string;
  cropStage: string;
  irrigationMethod: string;
  soilType: string;
  soilPh: string;
  nitrogen: NutrientLevel;
  phosphorus: NutrientLevel;
  potassium: NutrientLevel;
};

export const emptyFarmProfile: FarmProfile = {
  farmerName: '',
  location: '',
  acreage: '',
  crop: '',
  variety: '',
  sowingDate: '',
  cropStage: '',
  irrigationMethod: '',
  soilType: '',
  soilPh: '',
  nitrogen: '',
  phosphorus: '',
  potassium: '',
};

export function loadFarmProfile(): FarmProfile {
  if (typeof window === 'undefined') return emptyFarmProfile;
  try {
    const stored = window.localStorage.getItem(FARM_PROFILE_STORAGE_KEY);
    return stored ? { ...emptyFarmProfile, ...JSON.parse(stored) } : emptyFarmProfile;
  } catch {
    return emptyFarmProfile;
  }
}

export function saveFarmProfile(profile: FarmProfile) {
  window.localStorage.setItem(FARM_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  window.dispatchEvent(new CustomEvent('ekheti:farm-profile-updated', { detail: profile }));
}

export async function fetchFarmProfile(): Promise<FarmProfile> {
  const localProfile = loadFarmProfile();
  try {
    const response = await fetch('/api/farm-profile', { cache: 'no-store' });
    if (!response.ok) return localProfile;
    const payload = await response.json() as { profile?: Partial<FarmProfile> | null };
    if (!payload.profile) return localProfile;
    const profile = { ...emptyFarmProfile, ...payload.profile };
    saveFarmProfile(profile);
    return profile;
  } catch {
    return localProfile;
  }
}

export async function persistFarmProfile(profile: FarmProfile) {
  saveFarmProfile(profile);
  try {
    const response = await fetch('/api/farm-profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    if (!response.ok) throw new Error('Farm profile API rejected the request.');
    return await response.json() as { saved: boolean; storage: 'mongodb' | 'browser' };
  } catch {
    return { saved: false, storage: 'browser' as const };
  }
}
