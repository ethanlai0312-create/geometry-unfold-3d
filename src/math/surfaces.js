export const TAU = Math.PI * 2;
export const clamp = x => Math.max(0, Math.min(1, x));
export const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
// The first 12% reveals the cuts without moving any surface.
export function animationPhase(t) {
  return { movement: smooth((t - .12) / .88), ink: smooth(t / .12) };
}
export function cylinderPoint(s, v, r, t) {
  const k = (1 - t) / r;
  return k < 1e-7 ? [s, v, 0] : [Math.sin(k*s)/k, v, 2*Math.sin(k*s/2)**2/k];
}
export function conePoint(s, phi, r, h, t) {
  const l = Math.hypot(r,h), q = r/l + (1-r/l)*t;
  return [s*q*Math.sin(phi/q), s*q*Math.cos(phi/q), s*Math.sqrt(Math.max(0,1-q*q))];
}
export function spherePoint(lat, lon, r) {
  return [r*Math.cos(lat)*Math.sin(lon), r*Math.sin(lat), r*Math.cos(lat)*Math.cos(lon)];
}
export function sphereDetail(count = 64) {
  const n = Math.max(8, Math.min(1024, Math.round(count / 2) * 2));
  return { counts: [n,n,n], nu: Math.max(2,2*Math.ceil(96/n)), nv: 48, ring: n > 256 ? 64 : 128 };
}
export const SPHERE_DETAIL = [sphereDetail(24),sphereDetail(48),sphereDetail(64)];
// A petal's centre meridian unbends outwards, anchored at the pole.
// Meridional length is retained; the transverse direction deforms (not a paper net).
function petal(u,v,t,r,n,i,span) {
  const s = v*span*r, k=(1-t)/r, theta=i*TAU/n, delta=(u-.5)*TAU/n;
  const rho=k<1e-7?s:Math.sin(k*s)/k;
  const drop=k<1e-7?0:2*Math.sin(k*s/2)**2/k;
  const original=r*Math.sin(s/r);
  const radial=rho+(1-t)*original*(Math.cos(delta)-1);
  const transverse=original*((1-t)*Math.sin(delta)+t*delta);
  return [radial*Math.cos(theta)-transverse*Math.sin(theta),radial*Math.sin(theta)+transverse*Math.cos(theta),r*(1-t)-drop];
}
export function spherePatch(mode,i,r,detail=SPHERE_DETAIL[2]) {
  const count=detail.counts[mode];
  if(mode===0) return {nu:detail.nu,nv:detail.nv,map:(u,v,t)=>petal(u,v,t,r,count,i,Math.PI)};
  if(mode===1) {
    const n=count/2, south=i>=n, idx=i%n;
    return {nu:Math.max(2,2*Math.ceil(96/n)),nv:24,map(u,v,t) {
      const hinge=smooth(t/.35), bend=smooth((t-.35)/.65);
      const q=petal(u,v,bend,r,n,idx,Math.PI/2);
      if(!south)return q;
      if(t<=.35) {
        // Swing the southern hemisphere OUTSIDE the globe about its equatorial contact.
        const a=-Math.PI*hinge,x=q[0]-r,z=-q[2];
        return [r+x*Math.cos(a)+z*Math.sin(a),q[1],-x*Math.sin(a)+z*Math.cos(a)];
      }
      const k=(1-bend)/r, edge=k<1e-7?Math.PI*r/2:Math.sin(k*Math.PI*r/2)/k;
      return [2*edge-q[0],q[1],q[2]];
    }};
  }
  return {nu:detail.ring,nv:Math.max(1,Math.ceil(96/count)),map(u,v,t) {
    const lat=-Math.PI/2+(i+v)*Math.PI/count,lon=(u-.5)*TAU,a=1-t,R=r*Math.cos(lat);
    return [a<1e-7?R*lon:R*Math.sin(a*lon)/a,(1-t)*r*Math.sin(lat)+t*r*lat,a<1e-7?0:R*(-2*Math.sin(a*lon/2)**2/a+a)];
  }};
}

export function cylinderSurfaces(scheme,r,h) {
  const anchors=[ [0,0],[-Math.PI*r*.625,Math.PI*r*.625],[-Math.PI*r*.625,-Math.PI*r*.625] ][scheme];
  const side={nu:128,nv:2,map:(u,v,t)=>cylinderPoint((u-.5)*TAU*r,(v-.5)*h,r,smooth((t-.3)/.7))};
  const caps=[-1,1].map((sign,j)=>({nu:96,nv:4,disc:true,map(u,v,t) {
    const bend=smooth((t-.3)/.7),angle=smooth(t/.3)*Math.PI/2,s=anchors[j];
    const anchor=cylinderPoint(s,sign*h/2,r,bend),theta=(1-bend)*s/r;
    const x=r*v*Math.sin(TAU*u),d=r*(1+v*Math.cos(TAU*u));
    return [anchor[0]+x*Math.cos(theta)-d*Math.sin(theta)*Math.cos(angle),anchor[1]+sign*d*Math.sin(angle),anchor[2]+x*Math.sin(theta)+d*Math.cos(theta)*Math.cos(angle)];
  }}));
  return [side,...caps];
}
export function coneSurfaces(scheme,r,h) {
  const l=Math.hypot(r,h),alpha=TAU*r/l,phi=[0,-alpha*.3125,alpha*.3125][scheme];
  return [{nu:128,nv:24,map:(u,v,t)=>conePoint(v*l,(u-.5)*alpha,r,h,smooth((t-.35)/.65))},
    {nu:96,nv:4,disc:true,map(u,v,t) {
      const bend=smooth((t-.35)/.65),q=r/l+(1-r/l)*bend,theta=phi/q;
      const anchor=conePoint(l,phi,r,h,bend),angle=Math.PI*smooth(t/.35);
      const x=r*v*Math.sin(TAU*u),d=r*(1+v*Math.cos(TAU*u));
      return [anchor[0]+x*Math.cos(theta)-d*Math.sin(theta)*Math.cos(angle),anchor[1]-x*Math.sin(theta)-d*Math.cos(theta)*Math.cos(angle),anchor[2]+d*Math.sin(angle)];
    }}];
}
