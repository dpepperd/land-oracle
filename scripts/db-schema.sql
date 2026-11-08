-- Enable PostGIS if available (optional for this schema as we use geojson column mostly, but good for distance)
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS parcels (
    id SERIAL PRIMARY KEY,
    parcel_id VARCHAR(255) UNIQUE NOT NULL,
    county VARCHAR(100),
    owner_name VARCHAR(255),
    owner_address VARCHAR(255),
    owner_city VARCHAR(100),
    owner_state VARCHAR(50),
    owner_zip VARCHAR(20),
    property_address VARCHAR(255),
    acreage NUMERIC,
    market_value NUMERIC,
    assessed_value NUMERIC,
    land_use VARCHAR(100),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    out_of_state BOOLEAN DEFAULT false,
    geojson JSONB,
    geom GEOGRAPHY(Point, 4326),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    parcel_id VARCHAR(255) REFERENCES parcels(parcel_id),
    status VARCHAR(50) DEFAULT 'new',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_parcels_county ON parcels(county);
CREATE INDEX IF NOT EXISTS idx_parcels_acreage ON parcels(acreage);
CREATE INDEX IF NOT EXISTS idx_parcels_out_of_state ON parcels(out_of_state);
