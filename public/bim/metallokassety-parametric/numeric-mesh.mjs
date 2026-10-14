// Numerical export grid in millimetres, not a manufacturing tolerance.
// OpenCascade merges vertices closer than its model tolerance. Microscopic
// edges created at cut-plane intersections must be resolved before export.
export const COORDINATE_GRID_MM = 0.001;
export function normalizeCoordinationMesh(vertices, faces) {
  const grid=COORDINATE_GRID_MM, points=[], lookup=new Map(), map=[];
  let maximumCoordinateShift=0;
  for(const point of vertices){
    const units=point.map(value=>Math.round(value/grid)),key=units.join(':');
    let index=lookup.get(key);
    if(index===undefined){index=points.length;lookup.set(key,index);points.push(units.map(value=>value*grid));}
    map.push(index);
    for(let axis=0;axis<3;axis++)maximumCoordinateShift=Math.max(maximumCoordinateShift,Math.abs(point[axis]-points[index][axis]));
  }
  if(maximumCoordinateShift>grid/2+1e-8)throw new Error('Превышено численное округление координат.');
  const triangles=faces.map(face=>face.map(index=>map[index])).filter(face=>new Set(face).size===3);
  // Rounding can make a sliver triangle exactly collinear. Flip its longest
  // shared diagonal; this subdivides the neighbouring face without moving any
  // point or deleting a boundary edge. Never silently delete such a face.
  const squaredDistance=(a,b)=>a.reduce((sum,v,i)=>sum+(v-b[i])**2,0);
  const area2=face=>{
    const [a,b,c]=face.map(i=>points[i]),u=b.map((v,i)=>v-a[i]),v=c.map((x,i)=>x-a[i]);
    return Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]);
  };
  const edgeKey=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;
  const adjacent=new Map();
  const register=(face,index,add)=>{for(let j=0;j<3;j++){const key=edgeKey(face[j],face[(j+1)%3]);const group=adjacent.get(key)||new Set();if(add)group.add(index);else group.delete(index);if(group.size)adjacent.set(key,group);else adjacent.delete(key);}};
  triangles.forEach((face,i)=>register(face,i,true));
  let repairs=0;
  for(let pass=0;pass<8;pass++){
    let changed=false,remaining=0;
    for(let i=0;i<triangles.length;i++){
      const face=triangles[i];if(area2(face)>1e-10)continue;remaining++;
      const lengths=face.map((a,j)=>squaredDistance(points[a],points[face[(j+1)%3]]));
      const e=lengths.indexOf(Math.max(...lengths)),u=face[e],v=face[(e+1)%3],w=face[(e+2)%3];
      const other=[...(adjacent.get(edgeKey(u,v))||[])].find(index=>index!==i);if(other===undefined)continue;
      const neighbour=triangles[other],d=neighbour.find(index=>index!==u&&index!==v);if(d===undefined||d===w||adjacent.has(edgeKey(w,d)))continue;
      const first=[w,u,d],second=[w,d,v];if(area2(first)<=1e-10||area2(second)<=1e-10)continue;
      register(face,i,false);register(neighbour,other,false);triangles[i]=first;triangles[other]=second;
      register(first,i,true);register(second,other,true);changed=true;repairs++;
    }
    if(!remaining)break;
    if(!changed)throw new Error('Не удалось устранить вырожденную грань без изменения формы.');
  }
  if(triangles.some(face=>area2(face)<=1e-10))throw new Error('Осталась вырожденная грань.');
  const used=[...new Set(triangles.flat())],compact=new Map(used.map((index,i)=>[index,i]));
  const result={vertices:used.map(index=>points[index]),faces:triangles.map(face=>face.map(index=>compact.get(index)))};
  const topology=(vertexCount,items)=>{
    const edges=new Map(),seen=new Set();
    for(const face of items){
      const triangleKey=[...face].sort((a,b)=>a-b).join(':');
      if(seen.has(triangleKey))throw new Error('Повторяющаяся грань после численной обработки.');
      seen.add(triangleKey);
      for(let j=0;j<3;j++){
        const a=face[j],b=face[(j+1)%3],key=a<b?`${a}:${b}`:`${b}:${a}`;
        const edge=edges.get(key)||{count:0,direction:0};edge.count++;edge.direction+=a<b?1:-1;edges.set(key,edge);
      }
    }
    if([...edges.values()].some(edge=>edge.count!==2||edge.direction!==0))throw new Error('Нарушена замкнутость или ориентация модели.');
    return vertexCount-edges.size+items.length;
  };
  if(topology(vertices.length,faces)!==topology(result.vertices.length,result.faces))throw new Error('Численная обработка изменила топологию модели.');
  return {...result,normalization:{gridMm:grid,maximumCoordinateShift,removedTriangles:faces.length-result.faces.length,repairedSlivers:repairs}};
}
