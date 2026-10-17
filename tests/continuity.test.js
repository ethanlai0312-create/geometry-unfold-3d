import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {animationPhase,sphereDetail,spherePatch,cylinderSurfaces,coneSurfaces,cylinderPoint,conePoint,TAU} from '../src/math/surfaces.js';
import {createModel,dispose} from '../src/models.js';
import {flatSVG} from '../src/export.js';
const near=(a,b,e=1e-7)=>assert.ok(Math.abs(a-b)<e,`${a} versus ${b}`);
const point=(a,b)=>a.forEach((v,i)=>near(v,b[i]));

test('cuts fade before motion; backwards seeking restores the same geometry',()=>{
 for(const type of ['cube','prism','cylinder','cone','sphere']){
  const m=createModel(type,0,{a:2,b:3,h:2.5,r:1});m.update(0);
  const snapshots=()=>{m.group.updateMatrixWorld(true);const result=[];m.group.traverse(o=>{if(o.isMesh){const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++)result.push(...new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld).toArray())}});return result};
  const initial=snapshots();for(const t of [.03,.06,.12]){m.update(t);assert.deepEqual(snapshots(),initial)}
  m.update(.63);const middle=snapshots();m.update(1);m.update(.63);assert.deepEqual(snapshots(),middle);m.update(0);assert.deepEqual(snapshots(),initial);
  m.group.traverse(o=>{if(o.isLine)assert.equal(o.visible,false)});dispose(m.group);
 }
 assert.equal(animationPhase(.12).movement,0);assert.equal(animationPhase(.12).ink,1);
});

test('all sphere resolutions have outward winding, smooth initial normals, and bounded draw calls',()=>{
 for(const n of [8,64,256,1024])for(let mode=0;mode<3;mode++){
  const m=createModel('sphere',mode,{r:1},sphereDetail(n));m.update(0);
  assert.equal(m.group.userData.pieceCount,n);assert.equal(m.group.children.length,2);
  const mesh=m.group.children[0],g=mesh.geometry,a=g.attributes.position,idx=g.index;
  for(let i=0;i<idx.count;i+=3){const v=new T.Vector3().fromBufferAttribute(a,idx.getX(i)),b=new T.Vector3().fromBufferAttribute(a,idx.getX(i+1)),c=new T.Vector3().fromBufferAttribute(a,idx.getX(i+2));assert.ok(b.sub(v).cross(c.sub(v)).dot(v)>-1e-10,`inward triangle mode ${mode}`)}
  for(let i=0;i<a.count;i++){const v=new T.Vector3().fromBufferAttribute(a,i),norm=new T.Vector3().fromBufferAttribute(g.attributes.normal,i);near(v.length(),1,1e-6);near(v.normalize().dot(norm),1,1e-6)}
  m.update(1);assert.ok(m.group.children[1].material.opacity<=Math.min(.28,8/n));dispose(m.group);
 }
});

test('sphere petals and hemispheres preserve contact points; bands preserve entire shared edges',()=>{
 for(const n of [8,64,1024])for(const t of [0,.01,.2,.35,.36,.55,.8,1]){
  const d=sphereDetail(n);
  for(let i=1;i<n;i++)point(spherePatch(0,i,1,d).map(.5,0,t),spherePatch(0,0,1,d).map(.5,0,t));
  const half=n/2;
  point(spherePatch(1,0,1,d).map(.5,1,t),spherePatch(1,half,1,d).map(.5,1,t));
  for(let i=1;i<half;i++)for(const base of [0,half])point(spherePatch(1,base+i,1,d).map(.5,0,t),spherePatch(1,base,1,d).map(.5,0,t));
  for(let i=0;i<n-1;i++)for(const u of [0,.25,.5,.75,1])point(spherePatch(2,i,1,d).map(u,1,t),spherePatch(2,i+1,1,d).map(u,0,t));
 }
});

test('curved-solid caps remain attached and stay outside the side surface',()=>{
 for(const [r,h] of [[.5,4],[4,.5],[1,2.5]])for(let scheme=0;scheme<3;scheme++)for(let step=0;step<=100;step++){
  const t=step/100;
  for(const type of ['cylinder','cone']){
   const ss=type==='cylinder'?cylinderSurfaces(scheme,r,h):coneSurfaces(scheme,r,h),side=ss[0];
   for(let j=1;j<ss.length;j++){
    const cap=ss[j],contact=cap.map(.5,1,t),anchorU=type==='cylinder'?[[.5,.5],[.1875,.8125],[.1875,.1875]][scheme][j-1]:[.5,.1875,.8125][scheme];
    point(contact,side.map(anchorU,type==='cylinder'?j-1:1,t));
    for(let u=0;u<=12;u++)for(let v=0;v<=3;v++){
     const p=cap.map(u/12,v/3,t);
     if(type==='cylinder'){const sign=j===1?-1:1;assert.ok(sign*p[1]>=h/2-1e-8)}
     else assert.ok(p[2]>=contact[2]-1e-8);
    }
    // Distances across the disc remain diameters: no stretching of rigid caps.
    const a=cap.map(0,1,t),b=cap.map(.5,1,t);near(Math.hypot(...a.map((x,k)=>x-b[k])),2*r);
   }
  }
 }
});

test('sphere petals remain inside disjoint radial wedges; hemisphere fans lie on opposite sides',()=>{
 for(const n of [8,64,1024])for(let step=1;step<=50;step++){
  const t=step/50,d=sphereDetail(n),f=spherePatch(0,0,1,d);
  for(let v=0;v<=32;v++)for(let u=0;u<=4;u++){
   const p=f.map(u/4,v/32,t);if(Math.hypot(p[0],p[1])>1e-8)assert.ok(Math.abs(Math.atan2(p[1],p[0]))<=Math.PI/n+1e-7);
  }
  if(t>.35){const contact=spherePatch(1,0,1,d).map(.5,1,t)[0];for(const i of [0,1,n/4,n/2-1])for(let v=0;v<=16;v++)for(let u=0;u<=4;u++){
   assert.ok(spherePatch(1,i,1,d).map(u/4,v/16,t)[0]<=contact+1e-7);
   assert.ok(spherePatch(1,i+n/2,1,d).map(u/4,v/16,t)[0]>=contact-1e-7);
  }}
 }
});

test('polyhedron faces do not pass through each other at sampled intermediate progress',()=>{
 for(const type of ['cube','prism'])for(let scheme=0;scheme<(type==='cube'?11:5);scheme++)for(const dims of [[2,3,1.5],[.5,4,.5],[4,.5,4]]){
  const m=createModel(type,scheme,{a:dims[0],b:dims[1],h:dims[2]});
  for(let step=1;step<100;step++){
   m.update(.12+.88*step/100);m.group.updateMatrixWorld(true);
   const faces=m.nodes.map(n=>{const o=n.object.children[0],a=o.geometry.attributes.position;return [0,1,3,2].map(i=>new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld))});
   for(let i=0;i<6;i++)for(let j=0;j<6;j++){if(i===j)continue;const q=faces[j],normal=q[1].clone().sub(q[0]).cross(q[3].clone().sub(q[0])).normalize();
    for(let k=0;k<4;k++){const a=faces[i][k],b=faces[i][(k+1)%4],da=a.clone().sub(q[0]).dot(normal),db=b.clone().sub(q[0]).dot(normal);if(da*db>=-1e-10)continue;
     const hit=a.clone().lerp(b,da/(da-db)),u=q[1].clone().sub(q[0]),v=q[3].clone().sub(q[0]),w=hit.sub(q[0]),x=w.dot(u)/u.lengthSq(),y=w.dot(v)/v.lengthSq();
     assert.ok(!(x>1e-6&&x<1-1e-6&&y>1e-6&&y<1-1e-6),`${type} ${scheme} collision at ${step}%`);
    }
   }
  }dispose(m.group);
 }
});

test('hemisphere hinge stays outside the northern shell',()=>{
 const d=sphereDetail(8);
 for(let step=1;step<=70;step++)for(let i=4;i<8;i++)for(let u=0;u<=8;u++)for(let v=0;v<=12;v++){
  const p=spherePatch(1,i,1,d).map(u/8,v/12,.35*step/70);
  if(p[2]>1e-6)assert.ok(Math.hypot(...p)>=1-1e-7);
 }
});

test('indexed outline exports have valid independent segments and adaptive stroke width',()=>{
 for(const type of ['cube','cylinder','cone','sphere']){
  const m=createModel(type,0,{a:1,r:1,h:2},sphereDetail(1024));const svg=flatSVG(m,'測試');
  assert.ok(!/NaN|Infinity|undefined/.test(svg));assert.ok(svg.includes('<svg'));assert.ok(svg.includes('<path'));
  assert.ok([...svg.matchAll(/<path d="([^"]+)"/g)].every(m=>/^M[-\d.,]+L[-\d.,]+$/.test(m[1])));
  if(type==='sphere')assert.ok(Number(svg.match(/stroke-width="([^"]+)/)[1])<.002);
  dispose(m.group);
 }
});
