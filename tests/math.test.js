import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {cubeNets,foldTree,netLayout} from '../src/math/nets.js';
import {cylinderPoint,conePoint,TAU} from '../src/math/surfaces.js';
import {createModel,dispose} from '../src/models.js';
const near=(a,b,e=1e-5)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
test('exactly 11 distinct cube nets, each has all six orientations',()=>{assert.equal(cubeNets.length,11);for(const net of cubeNets){assert.equal(foldTree(net).length,6);assert.equal(new Set(foldTree(net).map(n=>n.n.join(','))).size,6)}});
test('cuboid faces keep axis-based dimensions and no planar interior overlap',()=>{for(const dims of [[3,2,1.5],[.5,4,.7],[4,.5,4],[.5,.5,4]])for(const net of cubeNets.slice(0,5)){const ns=netLayout(net,dims);near(ns.reduce((a,n)=>a+n.width*n.height,0),2*(dims[0]*dims[1]+dims[1]*dims[2]+dims[0]*dims[2]));for(let i=0;i<6;i++)for(let j=i+1;j<6;j++){let a=ns[i],b=ns[j];assert.ok(Math.abs(a.x-b.x)>=(a.width+b.width)/2-1e-8||Math.abs(a.y-b.y)>=(a.height+b.height)/2-1e-8)}}});
test('closed polyhedra have eight vertices and flat nets have zero depth',()=>{for(const type of ['cube','prism'])for(let i=0;i<(type==='cube'?11:5);i++){const m=createModel(type,i,{a:2,b:3,h:1.5});m.update(0);m.group.updateMatrixWorld(true);const pts=new Set();m.group.traverse(o=>{if(!o.isMesh)return;const a=o.geometry.attributes.position;for(let j=0;j<a.count;j++){const v=new T.Vector3().fromBufferAttribute(a,j).applyMatrix4(o.matrixWorld);pts.add(v.toArray().map(n=>n.toFixed(4).replace('-0.0000','0.0000')).join(','))}});assert.equal(pts.size,8);m.update(1);m.group.updateMatrixWorld(true);const box=new T.Box3().setFromObject(m.group);near(box.max.z-box.min.z,0);dispose(m.group)}});
test('cylinder intrinsic horizontal lengths preserved through unrolling',()=>{for(const t of [0,.25,.5,.75,1]){let length=0,prev=cylinderPoint(-Math.PI,0,1,t);for(let i=1;i<=4000;i++){const curr=cylinderPoint(-Math.PI+TAU*i/4000,0,1,t);length+=Math.hypot(...curr.map((x,j)=>x-prev[j]));prev=curr}near(length,TAU,1e-5)}assert.deepEqual(cylinderPoint(3,2,1,1),[3,2,0])});
test('cone generatrix and base arc remain exact intrinsically',()=>{for(const [r,h] of [[1,2.5],[4,.5],[.5,4]]){const l=Math.hypot(r,h),alpha=TAU*r/l;for(const t of [0,.5,1]){near(Math.hypot(...conePoint(l,.3,r,h,t)),l);let sum=0,prev=conePoint(l,-alpha/2,r,h,t);for(let i=1;i<=4000;i++){let curr=conePoint(l,-alpha/2+alpha*i/4000,r,h,t);sum+=Math.hypot(...curr.map((x,j)=>x-prev[j]));prev=curr}near(sum,TAU*r,1e-5)}}});
test('every model remains finite at arbitrary progress and ends planar',()=>{for(const type of ['cube','prism','cylinder','cone','sphere'])for(let s=0;s<({cube:11,prism:5,cylinder:3,cone:3,sphere:3}[type]);s++){const m=createModel(type,s,{a:2,b:3,h:2.5,r:1});for(const t of [0,.13,.25,.52,.91,1,.2,0]){m.update(t);m.group.traverse(o=>{if(o.geometry)assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite))});if(t===1){m.group.updateMatrixWorld(true);const b=new T.Box3().setFromObject(m.group);near(b.max.z-b.min.z,0)}}dispose(m.group)}});
import {SPHERE_DETAIL} from '../src/math/surfaces.js';
test('all sphere detail levels retain radius, finite animation and planar endpoints',()=>{
 for(const detail of SPHERE_DETAIL)for(let mode=0;mode<3;mode++){
  const m=createModel('sphere',mode,{r:2},detail);
  assert.equal(m.group.userData.pieceCount,detail.counts[mode]);
  for(const t of [0,.37,1,0]){m.update(t);m.group.traverse(o=>{if(!o.isMesh)return;const a=o.geometry.attributes.position;
   for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i),z=a.getZ(i);assert.ok(Number.isFinite(x+y+z));if(t===0)near(Math.hypot(x,y,z),2);if(t===1)near(z,0)}
   assert.ok([...o.geometry.attributes.normal.array].every(Number.isFinite));
  })}dispose(m.group);
 }
});
