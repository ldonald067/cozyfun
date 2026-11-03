# Scratch: break one half of the look at a time; the probe's water gate must name it.
import subprocess, shutil
f='app/src/rendering/shapeLanguage.ts'; bak='.tmp/water/shapeLanguage.keep.ts'
shutil.copy(f,bak); src=open(f).read()
S={
 'thread-counts-as-depth':('while (depth > 1 && (kindAt(cells, width, height, x - 1, y - depth + 1) === MATERIAL.Empty || kindAt(cells, width, height, x + 1, y - depth + 1) === MATERIAL.Empty)) depth--;\n  return depth;','return depth;'),
}
try:
  for n,(a,b) in S.items():
    assert src.count(a)==1,n
    open(f,'w').write(src.replace(a,b))
    r=subprocess.run('node scripts/renderer-probe.mjs',shell=True,capture_output=True,text=True)
    o=r.stdout+r.stderr
    print('==',n,'exit',r.returncode)
    for l in o.splitlines():
      if 'Water on a painted' in l or "Water's depth" in l or l.strip().startswith('- ') and any(w in l for w in ('water','pond','foam','bottle','stream')): print('  ',l.strip()[-150:])
finally:
  shutil.copy(bak,f)
