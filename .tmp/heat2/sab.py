# Scratch: break one half of the heat look at a time and print the probe's heat numbers. Edits the
# real renderer: finally restores it, a hard kill does not. Diff against shapeLanguage.keep.ts.
import subprocess, shutil, re
f='app/src/rendering/shapeLanguage.ts'; bak='.tmp/heat2/shapeLanguage.keep.ts'
shutil.copy(f,bak); src=open(f).read()
S={
 'coal-no-heat-scale':('const heat = Math.min(1, energy / 220);\n  let out: Rgb = CHAR_BODY;','const heat = 0.3;\n  let out: Rgb = CHAR_BODY;'),
}
try:
  for n,(a,b) in S.items():
    assert src.count(a)==1,n
    open(f,'w').write(src.replace(a,b))
    r=subprocess.run('node scripts/renderer-probe.mjs',shell=True,capture_output=True,text=True)
    o=r.stdout+r.stderr
    m=re.search(r'crustUnderBody.*',o)
    print('==',n, re.sub(r'lavaStep [0-9.]+, lavaChurn [0-9.]+, smokeRise [-0-9.]+, seeThrough [0-9.]+, ','',m.group(0))[:160] if m else o[-300:])
finally:
  shutil.copy(bak,f)
