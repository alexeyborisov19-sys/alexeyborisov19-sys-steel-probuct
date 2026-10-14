const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=v=>{const n=Math.hypot(...v);return v.map(x=>x/n);};
function multiply(a,b){const r=new Float32Array(16);for(let c=0;c<4;c++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)r[c*4+row]+=a[k*4+row]*b[c*4+k];return r;}
export class GeometryViewer {
  constructor(canvas,onMode){
    this.canvas=canvas;this.yaw=-1.1;this.pitch=.47;this.zoom=1;this.geometry=null;this.drag=null;this.edges=true;
    try{this.gl=canvas.getContext('webgl',{antialias:true,alpha:false,preserveDrawingBuffer:true});if(this.gl)this.initGL();}
    catch { const replacement=canvas.cloneNode();canvas.replaceWith(replacement);this.canvas=replacement;this.gl=null; }
    if(!this.gl){this.ctx=this.canvas.getContext('2d',{alpha:false});if(!this.ctx)throw new Error('В браузере недоступен 3D-просмотр.');}
    onMode(this.gl?'WebGL':'Canvas2D');
    const c=this.canvas;
    c.addEventListener('pointerdown',e=>{this.drag={x:e.clientX,y:e.clientY,id:e.pointerId};c.setPointerCapture(e.pointerId);});
    c.addEventListener('pointermove',e=>{if(!this.drag||this.drag.id!==e.pointerId)return;this.yaw-=(e.clientX-this.drag.x)*.008;this.pitch=Math.max(-1.5,Math.min(1.5,this.pitch+(e.clientY-this.drag.y)*.008));this.drag.x=e.clientX;this.drag.y=e.clientY;this.render();});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])c.addEventListener(event,()=>{this.drag=null;});
    c.addEventListener('wheel',e=>{e.preventDefault();this.setZoom(Math.exp(-e.deltaY*.001));},{passive:false});
    c.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(e.key))return;e.preventDefault();if(e.key==='Home')this.zoom=1;else if(['+','='].includes(e.key))this.setZoom(1.2);else if(e.key==='-')this.setZoom(1/1.2);else if(e.key==='ArrowLeft')this.yaw-=.1;else if(e.key==='ArrowRight')this.yaw+=.1;else this.pitch=Math.max(-1.5,Math.min(1.5,this.pitch+(e.key==='ArrowUp'?.1:-.1)));this.render();});
    this.observer=new ResizeObserver(()=>this.render());this.observer.observe(c);
  }
  initGL(){
    const gl=this.gl,shader=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error('Ошибка шейдера.');return s;};
    const v=shader(gl.VERTEX_SHADER,'attribute vec3 aPos;attribute vec3 aNormal;uniform mat4 uMVP;varying vec3 vNormal;void main(){gl_Position=uMVP*vec4(aPos,1.0);vNormal=aNormal;}');
    const f=shader(gl.FRAGMENT_SHADER,'precision mediump float;uniform bool uLine;varying vec3 vNormal;void main(){if(uLine){gl_FragColor=vec4(.23,.28,.31,1.0);}else{vec3 n=normalize(vNormal);float l=.55+.32*abs(dot(n,normalize(vec3(.35,-.55,.75))))+.10*abs(dot(n,normalize(vec3(-.6,-.2,.5))));gl_FragColor=vec4(vec3(.69,.75,.79)*l,1.0);}}');
    this.program=gl.createProgram();gl.attachShader(this.program,v);gl.attachShader(this.program,f);gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw new Error('Ошибка программы 3D.');
    gl.useProgram(this.program);this.locations={pos:gl.getAttribLocation(this.program,'aPos'),normal:gl.getAttribLocation(this.program,'aNormal'),mvp:gl.getUniformLocation(this.program,'uMVP'),line:gl.getUniformLocation(this.program,'uLine')};
    this.meshBuffer=gl.createBuffer();this.lineBuffer=gl.createBuffer();gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.clearColor(.953,.961,.969,1);
  }
  setGeometry(geometry){
    this.geometry=geometry;const radius=Math.hypot(...geometry.stats.size)/2;
    this.points=geometry.vertices.map(p=>p.map((x,i)=>(x-geometry.stats.centre[i])/radius));
    if(this.gl){
      const gl=this.gl,data=new Float32Array(geometry.faces.length*18),edgeMap=new Map();
      geometry.faces.forEach((face,fi)=>{
        const n=geometry.stats.normals[fi];face.forEach((index,j)=>{data.set(this.points[index],fi*18+j*6);data.set(n,fi*18+j*6+3);});
        for(let j=0;j<3;j++){const a=face[j],b=face[(j+1)%3],key=a<b?`${a}:${b}`:`${b}:${a}`;if(edgeMap.has(key)){const e=edgeMap.get(key);e.draw=dot(e.normal,n)<.995;}else edgeMap.set(key,{a,b,normal:n,draw:false});}
      });
      const lines=[];for(const edge of edgeMap.values())if(edge.draw)lines.push(...this.points[edge.a],...this.points[edge.b]);
      this.vertexCount=geometry.faces.length*3;this.lineCount=lines.length/3;
      gl.bindBuffer(gl.ARRAY_BUFFER,this.meshBuffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,this.lineBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(lines),gl.STATIC_DRAW);
    }
    this.render();
  }
  setZoom(factor){this.zoom=Math.max(.35,Math.min(15,this.zoom*factor));this.render();}
  view(type){this.yaw=type==='front'?Math.PI/2:type==='rear'?-Math.PI/2:-1.1;this.pitch=type==='iso'?.47:0;this.render();}
  camera(){const back=[Math.cos(this.pitch)*Math.cos(this.yaw),Math.cos(this.pitch)*Math.sin(this.yaw),Math.sin(this.pitch)],right=unit(cross([0,0,1],back)),up=cross(back,right);return {back,right,up};}
  render(){
    if(!this.geometry)return;const canvas=this.canvas,dpr=Math.min(globalThis.devicePixelRatio||1,1.75),w=Math.max(1,Math.round(canvas.clientWidth*dpr)),h=Math.max(1,Math.round(canvas.clientHeight*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    const {back,right,up}=this.camera();
    if(this.gl){
      const gl=this.gl,l=this.locations,scale=1.2/this.zoom,width=scale*w/h;
      const view=new Float32Array([right[0],up[0],back[0],0,right[1],up[1],back[1],0,right[2],up[2],back[2],0,0,0,-3,1]);
      const projection=new Float32Array([1/width,0,0,0,0,1/scale,0,0,0,0,-.1,0,0,0,0,1]);
      gl.viewport(0,0,w,h);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);gl.uniformMatrix4fv(l.mvp,false,multiply(projection,view));gl.uniform1i(l.line,0);gl.bindBuffer(gl.ARRAY_BUFFER,this.meshBuffer);gl.enableVertexAttribArray(l.pos);gl.enableVertexAttribArray(l.normal);gl.vertexAttribPointer(l.pos,3,gl.FLOAT,false,24,0);gl.vertexAttribPointer(l.normal,3,gl.FLOAT,false,24,12);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1,1);gl.drawArrays(gl.TRIANGLES,0,this.vertexCount);gl.disable(gl.POLYGON_OFFSET_FILL);
      if(this.edges){gl.uniform1i(l.line,1);gl.bindBuffer(gl.ARRAY_BUFFER,this.lineBuffer);gl.vertexAttribPointer(l.pos,3,gl.FLOAT,false,12,0);gl.disableVertexAttribArray(l.normal);gl.vertexAttrib3f(l.normal,0,0,1);gl.drawArrays(gl.LINES,0,this.lineCount);}
      if(gl.getError()!==gl.NO_ERROR)throw new Error('Ошибка отрисовки WebGL.');
    }else{
      const ctx=this.ctx,scale=h*this.zoom/2.4,projected=this.points.map(p=>[dot(p,right)*scale+w/2,h/2-dot(p,up)*scale,dot(p,back)]);
      ctx.fillStyle='#f3f5f7';ctx.fillRect(0,0,w,h);const light1=unit([.35,-.55,.75]),light2=unit([-.6,-.2,.5]),triangles=[];
      this.geometry.faces.forEach((f,i)=>{const n=this.geometry.stats.normals[i];if(dot(n,back)<-1e-6)return;const p=f.map(v=>projected[v]);triangles.push({p,n,depth:p.reduce((s,v)=>s+v[2],0)/3});});
      triangles.sort((a,b)=>a.depth-b.depth);for(const t of triangles){const light=.55+.32*Math.abs(dot(t.n,light1))+.10*Math.abs(dot(t.n,light2));const colour='rgb('+[.69,.75,.79].map(v=>Math.round(v*light*255)).join(',')+')';ctx.beginPath();ctx.moveTo(t.p[0][0],t.p[0][1]);ctx.lineTo(t.p[1][0],t.p[1][1]);ctx.lineTo(t.p[2][0],t.p[2][1]);ctx.closePath();ctx.fillStyle=colour;ctx.fill();ctx.lineWidth=.35;ctx.strokeStyle=colour;ctx.stroke();}
    }
    canvas.dataset.rendered='true';canvas.dataset.renderer=this.gl?'WebGL':'Canvas2D';
  }
}
