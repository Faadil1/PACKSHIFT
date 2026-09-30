// Parity: the procedural twin (src/scene/proceduralMaster.js) must reproduce
// the Blender master's node names, local transforms and fold metadata, so the
// fallback and custom-size modes behave exactly like the GLB.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildProceduralMaster } from '../src/scene/proceduralMaster.js';

function readGltf(path) {
  const raw = readFileSync(path);
  let offset = 12;
  while (offset + 8 <= raw.length) {
    const length = raw.readUInt32LE(offset);
    const type = raw.readUInt32LE(offset + 4);
    offset += 8;
    if (type === 0x4e4f534a) return JSON.parse(raw.subarray(offset, offset + length).toString('utf8').replace(/[\s\0]+$/, ''));
    offset += length;
  }
  throw new Error('no JSON chunk');
}

test('procedural twin matches the Blender GLB node-for-node', () => {
  const gltf = readGltf(new URL('../public/models/packshift-master.glb', import.meta.url));
  const twin = buildProceduralMaster();
  const nodes = {};
  twin.traverse((o) => { if (o.name) nodes[o.name] = o; });

  for (const node of gltf.nodes) {
    const t = nodes[node.name];
    assert.ok(t, `twin is missing ${node.name}`);
    const [x, y, z] = node.translation || [0, 0, 0];
    assert.ok(Math.abs(t.position.x - x) < 1e-5 && Math.abs(t.position.y - y) < 1e-5 && Math.abs(t.position.z - z) < 1e-5,
      `${node.name} position ${t.position.toArray()} != ${[x, y, z]}`);
    const extras = node.extras || {};
    if (extras.packshift_role === 'fold_hinge') {
      assert.equal(t.userData.fold_axis, extras.fold_axis, `${node.name} axis`);
      assert.equal(Number(t.userData.flat_deg), Number(extras.flat_deg), `${node.name} flat_deg`);
    }
    const children = (node.children || []).map((i) => gltf.nodes[i].name).sort();
    const twinChildren = t.children.filter((c) => c.name).map((c) => c.name).sort();
    assert.deepEqual(twinChildren, children, `${node.name} children`);
  }
});
