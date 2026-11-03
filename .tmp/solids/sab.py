# Scratch: break one half of the solids look at a time and print the probe's solids numbers.
# Edits the real renderer: finally restores it, a hard kill does not. Diff against *.keep.ts.
import subprocess, shutil, re, sys, json
sl='app/src/rendering/shapeLanguage.ts'; sf='app/src/rendering/solidFields.ts'
shutil.copy(sl,'.tmp/solids/shapeLanguage.keep.ts'); shutil.copy(sf,'.tmp/solids/solidFields.keep.ts')
S={
 'clean':[],
 'stone-flat-faces':[(sl,'adjustRgb(STONE_FACE, STONE_TONE[tile] + (blockHash % 3) * 3 - 11)','adjustRgb(STONE_FACE, (blockHash % 3) * 3 - 11)')],
 'stone-no-cracks':[(sf,'hashCell(pair, 3) % 2 === 0)','false)')],
 'stone-sparse-cracks':[(sf,'hashCell(pair, 3) % 2 === 0)','hashCell(pair, 3) % 9 === 0)')],
 'stone-crazy-paving':[(sf,'&& hashCell(pair, 3) % 2 === 0)',')'),(sf,'second) - Math.sqrt(first) < 0.95','second) - Math.sqrt(first) < 1.6')],
 'stone-speckle':[(sl,'if (STONE_SEAM[tile] === SEAM_CRACK) out = mixRgb(out, [18, 20, 26], 0.6);','if ((x + y + blockHash) % 13 === 0) out = mixRgb(out, [24, 26, 31], 0.62);')],
 'stone-weather-hides':[(sl,'if (!(flags & CELL_FLAG.Bedded) && STONE_SEAM[tileIndex(x, y)] === SEAM_CRACK) out = mixRgb(out, [18, 20, 26], 0.34);\n','')],
 'wood-diagonal':[(sl,'if (WOOD_MARK[tile] === GRAIN_LINE) out','if ((x + y + hash) % 5 === 0) out')],
 'wood-no-knots':[(sf,'if (core[here] < 0.5) mark[here] = GRAIN_KNOT;','')],
 'wood-sparse-grain':[(sf,'if (phase < 1.05) mark[here] = GRAIN_LINE;','if (phase < 0.08) mark[here] = GRAIN_LINE;')],
 'ice-flat':[(sl,'const ICE_TONES: Rgb[] = [[206, 240, 247], [176, 228, 242], [154, 216, 236], [138, 204, 230]];','const ICE_TONES: Rgb[] = [[206, 240, 247], [206, 240, 247], [206, 240, 247], [206, 240, 247]];')],
 'ice-water-blue':[(sl,'[154, 216, 236], [138, 204, 230]];','[84, 150, 214], [66, 130, 204]];')],
 'ice-no-planes':[(sf,'mark[tileIndex(x, y)] = FRACTURE_LINE;','')],
 'ice-sparse-planes':[(sf,'for (let n = 0; n < 170; n++) {\n    const angle','for (let n = 0; n < 34; n++) {\n    const angle')],
 'ice-marble':[(sf,'for (let n = 0; n < 170; n++) {\n    const angle','for (let n = 0; n < 900; n++) {\n    const angle')],
 'sand-no-slopes':[(sl,'if (sunlit > shaded) out = mixRgb(out, [252, 228, 164], sunlit * 0.1);\n  else if (shaded > sunlit) out = mixRgb(out, [120, 86, 58], shaded * 0.13);\n','')],
 'sand-no-glint':[(sl,'if (surface && !damp && hash % 29 === 0) out = mixRgb(out, [255, 250, 226], glint(time * 0.0031 + hash * 0.7));\n','')],
 'sand-hard-glint':[(sl,'return Math.max(0, (Math.sin(phase) - 0.8) * 3.6);','return Math.sin(phase) > 0.86 ? 0.72 : 0;')],
 'soil-no-topsoil':[(sl,'out = topsoil ? mixRgb(out, [44, 29, 22], 0.34) : mixRgb(out, [150, 112, 78], 0.14);\n','')],
 'soil-no-pebbles':[(sl,'if (!topsoil && SOIL_PEBBLE[tileIndex(x, y)]) out = mixRgb(out, [150, 142, 126], 0.66);\n','')],
 'wall-per-cell':[(sl,'const block = hashCell((x + brickOffset) >> 3, y >> 2, 9);','const block = hashCell(x, y, variant);')],
 'glass-straight':[(sl,'(x + y + (hashCell(0, y >> 2, 3) & 1) + Math.floor(time * 0.004)) % 11','(x + y + Math.floor(time * 0.004)) % 11')],
 'wood-tile-128':[(sl,'  const tile = tileIndex(x, y);\n  const ring = WOOD_MARK','  const tile = tileIndex(x & 127, y);\n  const ring = WOOD_MARK')],
 'stone-tile-tall-96':[(sl,'    const tile = tileIndex(x, y);\n    // Sits a little','    const tile = tileIndex(x, y % 96);\n    // Sits a little')],
 'tile-64':[(sf,'const TILE = 256;','const TILE = 64;'),(sf,'<< 8) | (x','<< 6) | (x'),(sf,'const across = 24','const across = 6'),(sf,'n < 170;','n < 11;'),(sf,'n < 420;','n < 26;'),(sf,'n < 240;','n < 15;'),(sf,'TILE / 52','TILE / 13'),(sf,'j < 9; j++) for (let i = 0; i < 9;','j < 2; j++) for (let i = 0; i < 2;'),(sf,'(TILE / 9), (j + unit(i, j, 35)) * (TILE / 9)','(TILE / 2), (j + unit(i, j, 35)) * (TILE / 2)')],
}
only=sys.argv[1:] or list(S)
orig={sl:open(sl).read(), sf:open(sf).read()}
res={}
try:
  for n in only:
    cur=dict(orig)
    for f,a,b in S[n]:
      assert a in cur[f],(n,a)
      cur[f]=cur[f].replace(a,b)
    for f in cur: open(f,'w').write(cur[f])
    r=subprocess.run('node scripts/renderer-probe.mjs',shell=True,capture_output=True,text=True)
    o=r.stdout+r.stderr
    m=re.search(r'Solids on painted.*?\. (faceStep.*)',o)
    vals=dict((k,float(v)) for k,v in re.findall(r'(\w+) (-?\d+(?:\.\d+)?)',m.group(1))) if m else {'ERR':o[-300:]}
    res[n]=vals
    if n=='clean': base=vals; print('clean',vals, flush=True); print(re.search(r'Solids on painted.*?wall blocks',o).group(0), flush=True); print(re.findall(r'^  - (.{0,120})',o,re.M), flush=True)
    else: print(n.ljust(22), {k:v for k,v in vals.items() if k=='ERR' or abs(v-res.get('clean',vals).get(k,v))>max(0.02,abs(res.get('clean',vals).get(k,v))*0.08)}, flush=True)
finally:
  for f in orig: open(f,'w').write(orig[f])
json.dump(res,open('.tmp/solids/sab.json','w'))
