import * as T from 'three';
import {cubeNets,netLayout} from './math/nets.js';
import {animationPhase,spherePatch,SPHERE_DETAIL,cylinderSurfaces,coneSurfaces} from './math/surfaces.js';
import {installSphereShader} from './sphere-shader.js';
const material=()=>new T.MeshStandardMaterial({color:0xc2e4f2,side:T.DoubleSide,roughness:.7,metalness:0,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
const lineMaterial=()=>new T.LineBasicMaterial({color:0x172033,transparent:true,opacity:0,depthWrite:false});
export function dispose(group){group.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose()})}

function polyhedron(type,scheme,p){
  const d=type==='cube'?[p.a,p.a,p.a]:[p.a,p.b,p.h],nodes=netLayout(cubeNets[scheme],d),group=new T.Group(),pivots=[],lines=[];
  for(const n of nodes){
    const face=new T.Group();
    if(n.parent<0)group.add(face);
    else{const parent=nodes[n.parent],hinge=new T.Group();hinge.position.set(n.dir[0]*parent.width/2,n.dir[1]*parent.height/2,0);parent.object.add(hinge);face.position.set(n.dir[0]*n.width/2,n.dir[1]*n.height/2,0);hinge.add(face);pivots.push({hinge,dir:n.dir})}
    n.object=face;
    const g=new T.PlaneGeometry(n.width,n.height),line=new T.LineSegments(new T.EdgesGeometry(g),lineMaterial());
    face.add(new T.Mesh(g,material()),line);lines.push(line);
  }
  return {group,nodes,update(t){const {movement,ink}=animationPhase(t);for(const {hinge,dir} of pivots)hinge.rotation.set(dir[1]*(1-movement)*Math.PI/2,-dir[0]*(1-movement)*Math.PI/2,0);for(const l of lines){l.visible=ink>0;l.material.opacity=.4*ink}},description:'先漸顯切線，再沿公共棱轉動；各面全程保持連接、剛性及正確尺寸。'};
}

// All patches share two draw calls. Piece count is never reduced by automatic quality settings.
function surfaceModel(surfaces,center,sphere=false,gpu=null){
  const group=new T.Group(),positions=[],indices=[],edgeIndices=[],ranges=[],uvs=[],signs=[];
  for(const s of surfaces){
    const offset=positions.length/3,baseIndex=indices.length;
    for(let y=0;y<=s.nv;y++)for(let x=0;x<=s.nu;x++)positions.push(...s.map(x/s.nu,y/s.nv,0));
    for(let y=0;y<s.nv;y++)for(let x=0;x<s.nu;x++){const k=offset+y*(s.nu+1)+x;indices.push(k,k+1,k+s.nu+1,k+1,k+s.nu+2,k+s.nu+1)}
    // Correct winding patch by patch, including reversed hemispheres and discs.
    let orientation=0;
    for(let k=baseIndex;k<indices.length;k+=3){const a=new T.Vector3().fromArray(positions,indices[k]*3),b=new T.Vector3().fromArray(positions,indices[k+1]*3),c=new T.Vector3().fromArray(positions,indices[k+2]*3);orientation+=b.clone().sub(a).cross(c.clone().sub(a)).dot(a.clone().sub(center))}
    if(orientation<0)for(let k=baseIndex;k<indices.length;k+=3)[indices[k+1],indices[k+2]]=[indices[k+2],indices[k+1]];
    const edge=(a,b)=>edgeIndices.push(offset+a,offset+b);
    for(let x=0;x<s.nu;x++){edge(s.nv*(s.nu+1)+x,s.nv*(s.nu+1)+x+1);if(!s.disc)edge(x,x+1)}
    if(!s.disc)for(let y=0;y<s.nv;y++){edge(y*(s.nu+1),(y+1)*(s.nu+1));edge(y*(s.nu+1)+s.nu,(y+1)*(s.nu+1)+s.nu)}
    if(gpu)for(let y=0;y<=s.nv;y++)for(let x=0;x<=s.nu;x++){uvs.push(x/s.nu,y/s.nv,ranges.length);signs.push(orientation<0?-1:1)}
    ranges.push({...s,offset});
  }
  const g=new T.BufferGeometry(),a=new Float32Array(positions),lineg=new T.BufferGeometry();
  g.setAttribute('position',new T.BufferAttribute(a,3).setUsage(T.DynamicDrawUsage));g.setIndex(indices);
  lineg.setAttribute('position',g.attributes.position);lineg.setIndex(edgeIndices);
  const mesh=new T.Mesh(g,material()),line=new T.LineSegments(lineg,lineMaterial());group.add(mesh,line);
  let uniforms;
  if(gpu){uniforms={unfold:{value:0},sphereRadius:{value:gpu.r},sphereMode:{value:gpu.scheme},pieceCount:{value:surfaces.length}};installSphereShader(mesh,line,new T.Float32BufferAttribute(uvs,3),new T.Float32BufferAttribute(signs,1),uniforms)}
  group.userData.pieceCount=surfaces.length;
  let previous=-1;
  const model={group,ranges,update(t){
    const {movement,ink}=animationPhase(t);
    line.visible=ink>0;
    // Fine cuts remain legible without covering the surface at high piece counts.
    line.material.opacity=ink*(sphere?Math.min(.28,8/surfaces.length):.4);
    if(previous===movement)return;previous=movement;
    for(const s of ranges)for(let y=0;y<=s.nv;y++)for(let x=0;x<=s.nu;x++)a.set(s.map(x/s.nu,y/s.nv,movement),(s.offset+y*(s.nu+1)+x)*3);
    g.attributes.position.needsUpdate=true;g.computeVertexNormals();
    if(sphere&&movement===0){const normals=g.attributes.normal;for(let i=0;i<a.length;i+=3){const len=Math.hypot(a[i],a[i+1],a[i+2]);normals.array[i]=a[i]/len;normals.array[i+1]=a[i+1]/len;normals.array[i+2]=a[i+2]/len}normals.needsUpdate=true}
    g.computeBoundingSphere();g.computeBoundingBox();lineg.boundingSphere=g.boundingSphere;lineg.boundingBox=g.boundingBox;
  }};
  if(gpu){
    model.update(0);
    const samples=[];
    for(let i=0;i<ranges.length;i+=Math.max(1,Math.floor(ranges.length/32)))samples.push(ranges[i]);
    // Include the last band and both shared hemisphere contacts in camera bounds.
    samples.push(ranges.at(-1),ranges[Math.floor(ranges.length/2)]);
    let last=-1;
    model.animate=t=>{
      const {movement,ink}=animationPhase(t);uniforms.unfold.value=movement;
      line.visible=ink>0;line.material.opacity=ink*Math.min(.28,8/surfaces.length);
      if(last===movement)return;last=movement;
      const box=new T.Box3();
      for(const s of samples)for(let y=0;y<=16;y++)for(const u of [0,.5,1])box.expandByPoint(new T.Vector3(...s.map(u,y/16,movement)));
      box.expandByScalar(gpu.r*.003);g.boundingBox=box;g.boundingSphere=box.getBoundingSphere(new T.Sphere());lineg.boundingBox=box;lineg.boundingSphere=g.boundingSphere;
    };
  }
  return model;
}
export function createModel(type,scheme,p,detail=SPHERE_DETAIL[2],options={}){
  if(type==='cube'||type==='prism')return polyhedron(type,scheme,p);
  let surfaces,center,description;
  if(type==='cylinder'){
    surfaces=cylinderSurfaces(scheme,p.r,p.h);center=new T.Vector3(0,0,p.r);
    description=['兩底面在矩形上下中央保持接點。','兩底面在相對角側保持接點。','兩底面在同側上下保持接點。'][scheme]+' 底面先繞保留接點向外翻開，側面再等距展平為 2πr × h；沒有平移拆散。';
  }else if(type==='cone'){
    surfaces=coneSurfaces(scheme,p.r,p.h);center=new T.Vector3(0,0,p.h/2);
    description=['底面接在扇形圓弧中央。','底面接在扇形圓弧左側。','底面接在扇形圓弧右側。'][scheme]+' 底面沿保留接點向外翻轉，再隨側面展平；母線長 ℓ 與弧長 2πr 保持不變。';
  }else{
    surfaces=Array.from({length:detail.counts[scheme]},(_,i)=>spherePatch(scheme,i,p.r,detail));center=new T.Vector3();
    description=[`沿經線分為 ${surfaces.length} 瓣，每瓣保留北極接點，向外舒展成放射狀。`,`沿赤道與經線分為 ${surfaces.length} 個半瓣；兩半球先繞赤道接點翻開，各瓣再繞各自極點舒展。`,`分為 ${surfaces.length} 條緯帶，沿同一經線切開；相鄰帶全程保留共邊，逐漸攤成等距緯度的平面圖。`][scheme]+' 此為柔性薄膜的近似展平，涉及伸縮／剪切，不能用不可伸縮的紙張無失真完成。';
  }
  return {...surfaceModel(surfaces,center,type==='sphere',type==='sphere'&&options.gpu?{r:p.r,scheme}:null),description};
}
