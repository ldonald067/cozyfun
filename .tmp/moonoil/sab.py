# Scratch: break one half of the moonwater/oil look at a time and print the probe's liquid numbers.
# Edits the real renderer: finally restores it, a hard kill does not. Diff against shapeLanguage.keep.ts.
import subprocess, shutil, re
f='app/src/rendering/shapeLanguage.ts'; bak='.tmp/moonoil/shapeLanguage.keep.ts'
shutil.copy(f,bak); src=open(f).read()
S={
 'clean':(None,None),
 'moon-reversed':('const band = (Math.floor((x - y * 0.5 + wobble - time / 380) / 3) % 4 + 4) % 4;\n  const light','const band = (Math.floor((x - y * 0.5 + wobble + time / 380) / 3) % 4 + 4) % 4;\n  const light'),
 'moon-still-bands':('const band = (Math.floor((x - y * 0.5 + wobble - time / 380) / 3) % 4 + 4) % 4;\n  const light','const band = (Math.floor((x - y * 0.5) / 3) % 4 + 4) % 4;\n  const light'),
 'oil-frozen-film':('function oilFilm(x: number, y: number, time: number) {\n','function oilFilm(x: number, y: number, time: number) {\n  time = 0;\n'),
 'oil-pool-no-film':('oilThickness(cells, width, height, x, y) <= OIL_THIN_CELLS ? 0.62 : 0.3','oilThickness(cells, width, height, x, y) <= OIL_THIN_CELLS ? 0.62 : 0'),
 'oil-grey-body':('const OIL_BODY: Rgb[] = [[56, 46, 24], [30, 26, 16], [9, 11, 10]];','const OIL_BODY: Rgb[] = [[47, 47, 47], [26, 26, 26], [10, 10, 10]];'),
}
try:
  for n,(a,b) in S.items():
    if a:
      assert src.count(a)==1,n
      open(f,'w').write(src.replace(a,b))
    r=subprocess.run('node scripts/renderer-probe.mjs',shell=True,capture_output=True,text=True)
    o=r.stdout+r.stderr
    m=re.search(r'Liquids on painted.*',o)
    print(n.ljust(22), (m.group(0).split('. ',1)[1] if m else o[-400:]))
    if a is None: print(' cells:', m.group(0).split('. ')[0]); print(' fails:', re.findall(r'^  - (.{0,110})',o,re.M))
finally:
  open(f,'w').write(src)
