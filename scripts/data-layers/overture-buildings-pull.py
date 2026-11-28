"""Pulls Overture Maps building outlines for one bounding box into a local CSV (id, WKT outline).
Overture buildings are ODbL (credit: Overture Maps Foundation, OpenStreetMap contributors, Microsoft and others).
Usage: python overture-buildings-pull.py <release> <xmin> <ymin> <xmax> <ymax> <out.csv>
Needs: pip install duckdb. Read-only against Overture's public S3 bucket; touches no database.
"""
import os
import sys
import duckdb

release, xmin, ymin, xmax, ymax, out = sys.argv[1], *map(float, sys.argv[2:6]), sys.argv[6]
con = duckdb.connect()
con.execute("INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial; SET s3_region='us-west-2';")
src = f"s3://overturemaps-us-west-2/release/{release}/theme=buildings/type=building/*"
con.execute(f"""
COPY (
  SELECT id, ST_AsText({'ST_PointOnSurface(geometry)' if os.environ.get('POINTS') else 'geometry'}) AS wkt
  FROM read_parquet('{src}', hive_partitioning=1)
  WHERE bbox.xmin <= {xmax} AND bbox.xmax >= {xmin} AND bbox.ymin <= {ymax} AND bbox.ymax >= {ymin}
) TO '{out}' (FORMAT csv, HEADER true)
""")
n = con.execute(f"SELECT count(*) FROM read_csv('{out}')").fetchone()[0]
print("buildings written:", n)
