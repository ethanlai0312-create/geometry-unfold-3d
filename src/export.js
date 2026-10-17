import * as T from 'three';
export function flatSVG(model,title){
  model.update(1);model.group.updateMatrixWorld(true);
  const paths=[],seen=new Set();let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  model.group.traverse(o=>{
    if(!o.isLine)return;
    const a=o.geometry.attributes.position,index=o.geometry.index,count=index?index.count:a.count,points=[];
    for(let i=0;i<count;i++){
      const v=new T.Vector3().fromBufferAttribute(a,index?index.getX(i):i).applyMatrix4(o.matrixWorld);
      minX=Math.min(minX,v.x);maxX=Math.max(maxX,v.x);minY=Math.min(minY,-v.y);maxY=Math.max(maxY,-v.y);
      points.push(`${Number(v.x.toFixed(6))},${Number((-v.y).toFixed(6))}`);
    }
    if(o.isLineSegments)for(let i=0;i<points.length;i+=2){const a=points[i],b=points[i+1],key=[a,b].sort().join('|');if(a!==b&&!seen.has(key)){seen.add(key);paths.push(`M${a}L${b}`)}}
    else paths.push('M'+points.join('L'));
  });
  const margin=.3,w=maxX-minX,h=maxY-minY,stroke=Math.min(.012,w/(Math.max(8,model.group.userData.pieceCount??8)*5));
  const safe=title.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX-margin} ${minY-margin} ${w+2*margin} ${h+2*margin}"><title>${safe}</title><rect x="${minX-margin}" y="${minY-margin}" width="${w+2*margin}" height="${h+2*margin}" fill="white"/><g fill="none" stroke="#172033" stroke-width="${stroke}" stroke-opacity=".65" stroke-linejoin="round">${paths.map(d=>`<path d="${d}"/>`).join('')}</g></svg>`;
}
export function exportSVG(stage,title){
  const old=stage.progress;let svg;
  try{svg=flatSVG(stage.model,title)}finally{stage.model.update(old)}
  const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'})),a=document.createElement('a');a.href=url;a.download=title+'.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
