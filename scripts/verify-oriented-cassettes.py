#!/usr/bin/env python3
"""Read-only IFC validation for upper-lock oriented closed metal cassettes."""
from __future__ import annotations
import hashlib
from pathlib import Path
import numpy as np
import ifcopenshell
import ifcopenshell.geom
from ifcmcp.core import IfcSession

ROOT=Path(__file__).resolve().parents[1]/'public/bim'
EXPECTED={
 'SP-CAS-01': ('81cd929620716750a1e5c2f7c80e138272465de72825fbd4316e32177a428ee6','9859f4462f9bedd4fc3deb0266687b1158bdd66b7fd7581f8ee7083d171460ff'),
 'SP-CAS-03': ('cb63cbec0536f66c3ffdb7acc42496cae7db0df6e736175fd473d6b09ea7b3d0','6107287c9211852d13e265a775a17452214ea7f0166c22a8f85c85dbd9065c7e'),
 'SP-CAS-05': ('c76db0b2ff9e3bbe71dfd9ae438d0de3da1d51072d451a13855e3dbcd05b03e2','8e5b949b4213304812c36ec5a3a07cb0f90a44658b6ea29b0fcc7e6d2c7fe801')
}
SETTINGS=ifcopenshell.geom.settings()
SETTINGS.set(SETTINGS.USE_WORLD_COORDS,True)

def world_shape(model):
    elements=model.by_type('IfcCovering')
    assert len(elements)==1
    geometry=ifcopenshell.geom.create_shape(SETTINGS,elements[0]).geometry
    return np.asarray(geometry.verts).reshape((-1,3)),len(geometry.faces)//3

for model_id,(coord_hash,exact_hash) in EXPECTED.items():
    parts=['IFC4_coordination','IFC4_exact_geometry']
    original=[ROOT/'metallokassety'/p/(model_id+'.ifc') for p in parts]
    oriented=[ROOT/'metallokassety-oriented'/p/(model_id+'.ifc') for p in parts]
    for file,expected in zip(oriented,[coord_hash,exact_hash]):
        assert hashlib.sha256(file.read_bytes()).hexdigest()==expected,('SHA-256',str(file))
        session=IfcSession()
        session.ifc_load(str(file))
        result=session.ifc_validate(express_rules=True)
        assert result.get('valid') is True,(file,result)
        session.ifc_reset()
    source=ifcopenshell.open(original[0])
    corrected=ifcopenshell.open(oriented[0])
    a=np.asarray(source.by_type('IfcCartesianPointList3D')[0].CoordList)
    b=np.asarray(corrected.by_type('IfcCartesianPointList3D')[0].CoordList)
    assert a.shape==b.shape
    target=np.column_stack([a[:,0].max()-a[:,0],a[:,1],a[:,2].max()-a[:,2]])
    assert np.allclose(target,b,atol=1.5e-9,rtol=0),('Rigid rotation',model_id)
    assert np.array_equal(np.asarray(source.by_type('IfcTriangulatedFaceSet')[0].CoordIndex),
                          np.asarray(corrected.by_type('IfcTriangulatedFaceSet')[0].CoordIndex))
    margin=min(15,np.ptp(a[:,2])/10)
    complex_low=int(np.count_nonzero(a[:,2]<a[:,2].min()+margin))
    simple_high=int(np.count_nonzero(a[:,2]>a[:,2].max()-margin))
    assert complex_low>simple_high and complex_low==np.count_nonzero(b[:,2]>b[:,2].max()-margin)
    output_bounds=[]
    for a_path,b_path in zip(original,oriented):
        before,n=world_shape(ifcopenshell.open(a_path))
        after,m=world_shape(ifcopenshell.open(b_path))
        assert n==m
        assert np.allclose(np.ptp(before,axis=0),np.ptp(after,axis=0),atol=3e-6,rtol=0)
        output_bounds.append(np.stack([after.min(axis=0),after.max(axis=0)]))
    assert np.allclose(output_bounds[0],output_bounds[1],atol=3e-6,rtol=0)
    assert output_bounds[0][0,2]>=-3e-6 and output_bounds[0][1,2]>0
    print(model_id,'PASS: upward angled lock, coord/exact IFC4, EXPRESS and geometry readback')
print('PASS: six oriented IFCs validated; original IFC archives preserved')
