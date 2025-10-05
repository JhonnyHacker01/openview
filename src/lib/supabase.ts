import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface User {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
}

export interface CropType {
  id: string;
  name: string;
  optimal_conditions: {
    min_temp?: number;
    max_temp?: number;
    min_moisture?: number;
    ideal_moisture?: number;
  };
  created_at: string;
}

export interface Recommendation {
  id: string;
  user_id: string | null;
  anonymous_id: string | null;
  crop_type_id: string;
  latitude: number;
  longitude: number;
  location_name: string;
  feasibility_score: number;
  feasibility_level: 'green' | 'yellow' | 'red';
  recommendation_text: string;
  soil_moisture: number | null;
  temperature: number | null;
  precipitation: number | null;
  device_info: string;
  created_at: string;
  crop_types?: CropType;
}
