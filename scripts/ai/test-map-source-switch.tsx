// Regression test for the county-lines crash (2026-11-12): react-map-gl's <Source> throws "source id changed" when a mounted Source gets a
// different id between renders, which crashed the dashboard when an admin switched Florida <-> North Carolina.
// This mounts the real Source component against a fake map and flips the state the way MapView does. Needs react-test-renderer:
//   npm i --no-save react-test-renderer@19.2.3 && npx tsx scripts/ai/test-map-source-switch.tsx
import React from 'react';
import path from 'path';
import { pathToFileURL } from 'url';
import TestRenderer, { act } from 'react-test-renderer';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const base = path.join(process.cwd(), 'node_modules', 'react-map-gl', 'dist', 'mapbox-legacy', 'components');

function fakeMap() {
  const sources: Record<string, any> = {};
  const m: any = {
    style: { _loaded: true },
    on() {}, off() {},
    getSource: (id: string) => sources[id],
    addSource: (id: string, o: any) => { sources[id] = { id, data: o.data, setData(d: any) { this.data = d; } }; },
    removeSource: (id: string) => { delete sources[id]; },
    getStyle: () => ({ layers: [] }), removeLayer() {},
  };
  return m;
}

async function run(label: string, build: (state: 'FL' | 'NC') => React.ReactElement) {
  const { Source } = await import(pathToFileURL(path.join(base, 'source.js')).href);
  const { MapContext } = await import(pathToFileURL(path.join(base, 'map.js')).href);
  const map = fakeMap();
  const wrap = (state: 'FL' | 'NC') => (
    <MapContext.Provider value={{ map: { getMap: () => map } } as any}>{React.cloneElement(build(state), { __Source: Source } as any)}</MapContext.Provider>
  );
  let err: any = null;
  const r = TestRenderer.create(<div />);
  try {
    await act(async () => { r.update(wrap('FL')); });
    await act(async () => { r.update(wrap('NC')); });
    await act(async () => { r.update(wrap('FL')); });
  } catch (e) { err = e; }
  return { label, err };
}

(async () => {
  const { Source } = await import(pathToFileURL(path.join(base, 'source.js')).href);
  const Old = ({ state }: any) => <Source id={state === 'NC' ? 'nc-counties' : 'fl-counties'} type="geojson" data={state === 'NC' ? '/nc.json' : 'https://x/fl.json'} />;
  const New = ({ state }: any) => <Source key={state} id="county-lines" type="geojson" data={state === 'NC' ? '/nc.json' : 'https://x/fl.json'} />;
  const oldR = await run('old (changing id)', (s) => <Old state={s} />);
  const newR = await run('fixed (constant id + key)', (s) => <New state={s} />);
  const oldFails = !!oldR.err && /source id changed/.test(String(oldR.err.message || oldR.err));
  console.log(`${oldFails ? 'PASS' : 'FAIL'}  the old code reproduces the crash ("${oldR.err ? String(oldR.err.message || oldR.err).slice(0, 60) : 'no error'}")`);
  console.log(`${!newR.err ? 'PASS' : 'FAIL'}  the fixed code survives FL -> NC -> FL${newR.err ? ': ' + String(newR.err.message || newR.err) : ''}`);
  process.exit(oldFails && !newR.err ? 0 : 1);
})();
