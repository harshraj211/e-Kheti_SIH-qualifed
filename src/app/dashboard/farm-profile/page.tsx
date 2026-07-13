'use client';

import { useEffect, useState } from 'react';
import { Save, Sprout } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { emptyFarmProfile, FarmProfile, fetchFarmProfile, NutrientLevel, persistFarmProfile } from '@/lib/farm-profile';

const nutrientOptions: NutrientLevel[] = ['low', 'medium', 'high'];

export default function FarmProfilePage() {
  const [profile, setProfile] = useState<FarmProfile>(emptyFarmProfile);
  const [loaded, setLoaded] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchFarmProfile().then(savedProfile => {
      setProfile(savedProfile);
      setLoaded(true);
    });
  }, []);

  const update = (field: keyof FarmProfile, value: string) => {
    setProfile(current => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await persistFarmProfile(profile);
    toast({
      title: 'Farm profile saved',
      description: result.storage === 'mongodb'
        ? 'Saved to MongoDB and included in chatbot advice.'
        : 'Saved on this device. Add MONGODB_URI to enable cloud sync.',
    });
  };

  if (!loaded) return null;

  return (
    <main className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Farm Profile</h1>
        <p className="text-muted-foreground">Save your farm context once for more precise weather, crop, and soil advice.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sprout className="h-5 w-5" /> Farm and crop</CardTitle>
            <CardDescription>These details are automatically supplied to the eKheti assistant.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Farmer name" value={profile.farmerName} onChange={value => update('farmerName', value)} />
            <Field label="Location" value={profile.location} onChange={value => update('location', value)} placeholder="Ludhiana, Punjab" required />
            <Field label="Farm area (acres)" value={profile.acreage} onChange={value => update('acreage', value)} type="number" />
            <Field label="Crop" value={profile.crop} onChange={value => update('crop', value)} placeholder="Paddy" required />
            <Field label="Variety" value={profile.variety} onChange={value => update('variety', value)} placeholder="PR 126" />
            <Field label="Sowing / transplanting date" value={profile.sowingDate} onChange={value => update('sowingDate', value)} type="date" />
            <Field label="Current crop stage" value={profile.cropStage} onChange={value => update('cropStage', value)} placeholder="Tillering" />
            <Field label="Irrigation method" value={profile.irrigationMethod} onChange={value => update('irrigationMethod', value)} placeholder="Flood, drip, sprinkler" />
            <Field label="Soil type" value={profile.soilType} onChange={value => update('soilType', value)} placeholder="Loam" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest soil test</CardTitle>
            <CardDescription>Leave unknown values blank. The assistant will ask instead of guessing.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Soil pH" value={profile.soilPh} onChange={value => update('soilPh', value)} type="number" />
            {(['nitrogen', 'phosphorus', 'potassium'] as const).map(nutrient => (
              <div className="space-y-2" key={nutrient}>
                <Label className="capitalize">{nutrient}</Label>
                <Select value={profile[nutrient]} onValueChange={value => update(nutrient, value)}>
                  <SelectTrigger><SelectValue placeholder="Unknown" /></SelectTrigger>
                  <SelectContent>
                    {nutrientOptions.map(option => <SelectItem key={option} value={option} className="capitalize">{option}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit"><Save className="mr-2 h-4 w-4" /> Save profile</Button>
        </div>
      </form>
    </main>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder, required }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} onChange={event => onChange(event.target.value)} type={type} placeholder={placeholder} required={required} min={type === 'number' ? '0' : undefined} step={type === 'number' ? '0.1' : undefined} />
    </div>
  );
}
