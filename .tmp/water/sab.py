# Scratch: break one half of the look at a time; the probe's water gate must name it.
import subprocess, shutil
f='app/src/rendering/shapeLanguage.ts'; bak='.tmp/water/shapeLanguage.keep.ts'
shutil.copy(f,bak); src=open(f).read()
S={
 'streaks-off':('return head > 0.6 ? mixRgb(aerated, [240, 250, 255], ((head - 0.6) / 0.4) * (0.3 + 0.5 * drop)) : aerated;','return aerated;'),
 'no-aeration':('const aerated = mixRgb(out, [226, 240, 250], 0.06 + 0.64 * drop);','const aerated = out;'),
 'no-gravity':('const strand = 2.4 * Math.sqrt(fallen + 1) - time / 160','const strand = 0.4 * fallen - time / 160'),
 'no-gaps-bridged':('=== MATERIAL.Empty && ++gaps < 4) continue;','=== MATERIAL.Empty && ++gaps < 1) continue;'),
 'fall-capped-at-20':('for (let up = y - 1; up >= 0; up--, fallen++) {','for (let up = y - 1; up >= 0 && fallen < 20; up--, fallen++) {'),
 'no-stop-at-air':('    if (next % 4 === 0 && airBeside(cells, width, height, x, row)) break;\n',''),
 'depth-upward-only':('  if (depth < 6) return depth;\n','  return depth;\n'),
 'straight-fade':('Math.round(WATER_DEEP[i] + (c - WATER_DEEP[i]) * Math.exp(-WATER_ABSORPTION[i] * depth))','Math.round(c + (WATER_DEEP[i] - c) * depth / (WATER_DEPTH_CELLS + 1))'),
 'no-depth':('const calm = mixRgb(out, WATER_DEPTH_TONE[depth], 0.6 + 0.3 * deep);','const calm = mixRgb(out, WATER_DEPTH_TONE[1], 0.6);'),
}
try:
  for n,(a,b) in S.items():
    assert src.count(a)==1,n
    open(f,'w').write(src.replace(a,b))
    r=subprocess.run('node scripts/renderer-probe.mjs',shell=True,capture_output=True,text=True)
    o=r.stdout+r.stderr
    print('==',n,'exit',r.returncode)
    for l in o.splitlines():
      if l.strip().startswith('- ') and any(w in l for w in ('water','pond','foam','bottle','stream','mass')): print('  ',l.strip()[:150])
finally:
  shutil.copy(bak,f)
