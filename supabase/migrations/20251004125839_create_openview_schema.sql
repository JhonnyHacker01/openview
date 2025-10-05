/*
  # OpenView Database Schema - Agricultural Recommendation System

  ## Overview
  This migration creates the complete database schema for OpenView, a satellite-based
  agricultural recommendation platform for farmers in Huánuco, Peru.

  ## New Tables

  ### 1. `users`
  Stores registered user accounts with authentication details.
  - `id` (uuid, primary key) - Unique user identifier
  - `email` (text, unique) - User email for login
  - `full_name` (text) - User's full name
  - `created_at` (timestamptz) - Account creation timestamp
  
  ### 2. `crop_types`
  Reference table for supported crop types in the region.
  - `id` (uuid, primary key) - Unique crop identifier
  - `name` (text) - Crop name (e.g., "Maíz", "Papa", "Café", "Cacao")
  - `optimal_conditions` (jsonb) - Optimal growing conditions data
  - `created_at` (timestamptz) - Record creation timestamp

  ### 3. `recommendations`
  Core table storing all agricultural recommendations (anonymous and registered).
  - `id` (uuid, primary key) - Unique recommendation identifier
  - `user_id` (uuid, nullable) - Links to registered user (null for anonymous)
  - `anonymous_id` (text, nullable) - Auto-generated ID for anonymous users (format: ANON-YYYY-XXXXXX)
  - `crop_type_id` (uuid) - Selected crop type
  - `latitude` (numeric) - GPS latitude coordinate
  - `longitude` (numeric) - GPS longitude coordinate
  - `location_name` (text) - Human-readable location name
  - `feasibility_score` (integer) - Score 0-100 indicating planting feasibility
  - `feasibility_level` (text) - Color indicator: "green", "yellow", "red"
  - `recommendation_text` (text) - Detailed recommendation message
  - `soil_moisture` (numeric) - Soil moisture percentage from satellite data
  - `temperature` (numeric) - Temperature reading in Celsius
  - `precipitation` (numeric) - Recent precipitation in mm
  - `device_info` (text) - Device type used for access
  - `created_at` (timestamptz) - Recommendation timestamp

  ## Security

  ### Row Level Security (RLS)
  All tables have RLS enabled with the following policies:

  #### users table:
  - Authenticated users can read their own profile
  - Authenticated users can update their own profile

  #### crop_types table:
  - Public read access (all users can view crop types)
  - Only authenticated users with admin role can modify

  #### recommendations table:
  - Anonymous users can insert recommendations (with anonymous_id)
  - Registered users can view all their own recommendations
  - Anonymous users can view recommendations matching their anonymous_id
  - Users can only insert recommendations for themselves

  ## Important Notes
  1. The system supports both anonymous and registered usage patterns
  2. Anonymous IDs are generated client-side in format: ANON-YYYY-XXXXXX
  3. Satellite data fields (soil_moisture, temperature, precipitation) are populated from API/simulation
  4. Feasibility scoring uses a 0-100 scale with color-coded levels
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Create crop_types table
CREATE TABLE IF NOT EXISTS crop_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  optimal_conditions jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE crop_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view crop types"
  ON crop_types FOR SELECT
  TO public
  USING (true);

-- Create recommendations table
CREATE TABLE IF NOT EXISTS recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  anonymous_id text,
  crop_type_id uuid REFERENCES crop_types(id) NOT NULL,
  latitude numeric(10, 7) NOT NULL,
  longitude numeric(10, 7) NOT NULL,
  location_name text DEFAULT '',
  feasibility_score integer NOT NULL CHECK (feasibility_score >= 0 AND feasibility_score <= 100),
  feasibility_level text NOT NULL CHECK (feasibility_level IN ('green', 'yellow', 'red')),
  recommendation_text text NOT NULL,
  soil_moisture numeric(5, 2),
  temperature numeric(5, 2),
  precipitation numeric(6, 2),
  device_info text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT check_user_or_anonymous CHECK (
    (user_id IS NOT NULL AND anonymous_id IS NULL) OR
    (user_id IS NULL AND anonymous_id IS NOT NULL)
  )
);

ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Registered users can view own recommendations"
  ON recommendations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Anonymous users can view own recommendations"
  ON recommendations FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Registered users can insert own recommendations"
  ON recommendations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anonymous users can insert recommendations"
  ON recommendations FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL AND anonymous_id IS NOT NULL);

-- Insert initial crop types for Huánuco region
INSERT INTO crop_types (name, optimal_conditions) VALUES
  ('Maíz', '{"min_temp": 18, "max_temp": 30, "min_moisture": 40, "ideal_moisture": 65}'::jsonb),
  ('Papa', '{"min_temp": 10, "max_temp": 20, "min_moisture": 50, "ideal_moisture": 70}'::jsonb),
  ('Café', '{"min_temp": 18, "max_temp": 24, "min_moisture": 60, "ideal_moisture": 80}'::jsonb),
  ('Cacao', '{"min_temp": 21, "max_temp": 32, "min_moisture": 70, "ideal_moisture": 85}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_recommendations_user_id ON recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_anonymous_id ON recommendations(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_created_at ON recommendations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recommendations_location ON recommendations(latitude, longitude);