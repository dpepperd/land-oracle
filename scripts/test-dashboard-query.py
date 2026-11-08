# test-dashboard-query.py
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv('.env.local')

conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cur = conn.cursor()

# Search for parcels with similar ID
cur.execute("""
    SELECT parcel_id, latitude, longitude, owner_name, acreage
    FROM parcels 
    WHERE parcel_id LIKE '%052S21%00012%'
    ORDER BY parcel_id
""")

print("\n🔍 All parcels matching '052S21...00012':\n")
print("=" * 80)

for row in cur.fetchall():
    print(f"Parcel ID: {row[0]}")
    print(f"  Coords: {row[1]}, {row[2]}")
    print(f"  Owner: {row[3]}")
    print(f"  Acres: {row[4]}")
    print(f"  Google Maps: https://www.google.com/maps?q={row[1]},{row[2]}")
    print("-" * 80)

cur.close()
conn.close()