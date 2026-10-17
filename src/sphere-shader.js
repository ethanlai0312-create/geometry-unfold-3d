// GPU equivalent of math/surfaces.js. Only vertex motion runs here; topology stays on the CPU.
export const sphereShader = `
uniform float unfold;
uniform float sphereRadius;
uniform float sphereMode;
uniform float pieceCount;
attribute vec3 patchUV;
attribute float normalSign;
varying float cutWeight;
const float PI=3.141592653589793;
float ease(float x){x=clamp(x,0.0,1.0);return x*x*(3.0-2.0*x);}
float sinc(float x){float xx=x*x;return abs(x)<.05?1.0-xx/6.0+xx*xx/120.0:sin(x)/x;}
vec3 petal(float u,float v,float t,float n,float i,float span){
 float r=sphereRadius,s=v*span*r,k=(1.0-t)/r,theta=i*2.0*PI/n,delta=(u-.5)*2.0*PI/n;
 float rho=s*sinc(k*s),drop=.5*k*s*s*pow(sinc(k*s*.5),2.0);
 float original=r*sin(s/r),radial=rho+(1.0-t)*original*(cos(delta)-1.0);
 float transverse=original*((1.0-t)*sin(delta)+t*delta);
 return vec3(radial*cos(theta)-transverse*sin(theta),radial*sin(theta)+transverse*cos(theta),r*(1.0-t)-drop);
}
vec3 surface(vec3 uv){
 float u=uv.x,v=uv.y,i=uv.z,t=unfold,r=sphereRadius;
 vec3 result=vec3(0.0);
 if(sphereMode<.5){result=petal(u,v,t,pieceCount,i,PI);}
 else if(sphereMode<1.5){
  float n=pieceCount*.5,bend=ease((t-.35)/.65),idx=mod(i,n);
  vec3 p=petal(u,v,bend,n,idx,PI*.5);
  result=p;
  if(i>=n){
   if(t<=.35){float a=-PI*ease(t/.35),x=p.x-r,z=-p.z;result=vec3(r+x*cos(a)+z*sin(a),p.y,-x*sin(a)+z*cos(a));}
   else {float k=(1.0-bend)/r,edge=PI*r*.5*sinc(k*PI*r*.5);result=vec3(2.0*edge-p.x,p.y,p.z);}
  }
 }else{
  float lat=-PI*.5+(i+v)*PI/pieceCount,lon=(u-.5)*2.0*PI,a=1.0-t,R=r*cos(lat);
  result=vec3(R*lon*sinc(a*lon),(1.0-t)*r*sin(lat)+t*r*lat,R*a*(1.0-.5*lon*lon*pow(sinc(a*lon*.5),2.0)));
 }
 return result;
}
`;

export function installSphereShader(mesh,line,uv,sign,uniforms){
  mesh.geometry.setAttribute('patchUV',uv);mesh.geometry.setAttribute('normalSign',sign);
  line.geometry.setAttribute('patchUV',uv);line.geometry.setAttribute('normalSign',sign);
  for(const object of [mesh,line]){
    object.material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms);
      shader.vertexShader=sphereShader+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`vec3 transformed=surface(patchUV);
        cutWeight=sphereMode<1.5?smoothstep(0.06,0.2,sin(patchUV.y*(sphereMode<.5?PI:PI*.5))):1.0;
        if(mod(patchUV.z,ceil(pieceCount/128.0))>.5)cutWeight=0.0;`);
      if(object===mesh)shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`
        vec3 safeUV=vec3(patchUV.x,clamp(patchUV.y,.0001,.9999),patchUV.z);
        vec3 du=surface(safeUV+vec3(.001,0.0,0.0))-surface(safeUV-vec3(.001,0.0,0.0));
        vec3 dv=surface(safeUV+vec3(0.0,.001,0.0))-surface(safeUV-vec3(0.0,.001,0.0));
        vec3 objectNormal=unfold<.000001?normalize(surface(patchUV)):normalize(cross(du,dv))*normalSign;
      `);
      else shader.fragmentShader='varying float cutWeight;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a *= cutWeight;');
    };
    object.material.customProgramCacheKey=()=>object===mesh?'sphere-surface-v1':'sphere-cut-v1';
  }
}
