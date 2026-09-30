"""HUSHFIRE sprite baker.
blender --background --python render_sprites.py -- <anim.fbx> <out_dir> <sheet_name> <clip_name> <n_frames> [loop 0/1] [frame_ms] [ppm]
Renders a Mixamo FBX (with the rifle attached to the right hand) from straight above,
character facing +X (right), into a horizontal WebP strip + Hushfire JSON.
"""
import bpy, sys, math, json, os, pickle, time
from mathutils import Vector, Matrix
A = sys.argv[sys.argv.index('--')+1:]
fbx, out_dir, sheet, clip = A[0], A[1], A[2], A[3]
n = int(A[4]); loop = A[5] == '1' if len(A) > 5 else True
frame_ms = int(A[6]) if len(A) > 6 else 100
PPM = float(A[7]) if len(A) > 7 else 300.0          # pixels per metre
CELL_W, CELL_H = 556, 304                            # same cell as existing rifle sheets
PIVOT = (137.3, 139.2)                               # torso pivot used by the game
if os.environ.get('HF_CELL'):                        # bigger cell for moves that leave the default box (hit, death)
    CELL_W, CELL_H, px, py = map(float, os.environ['HF_CELL'].split(','))
    CELL_W, CELL_H = int(CELL_W), int(CELL_H); PIVOT = (px, py)
HERE = os.path.dirname(os.path.abspath(__file__))
RIFLE = os.path.join(HERE, 'rifle_grip_origin.glb'); REL = os.path.join(HERE, 'rifle_rel.pkl')
ENGINE = os.environ.get('HF_ENGINE', 'WORKBENCH')

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=fbx)
sc = bpy.context.scene
arm = [o for o in sc.objects if o.type == 'ARMATURE'][0]
f0, f1 = map(int, arm.animation_data.action.frame_range)
# rifle
if os.path.exists(RIFLE):
    bpy.ops.import_scene.gltf(filepath=RIFLE)
    gun = [o for o in sc.objects if o.type == 'MESH' and o.name.startswith('Rifle')][0]
    sc.frame_set(f0)
    gun.parent = arm; gun.parent_type = 'BONE'; gun.parent_bone = 'mixamorig:RightHand'
    bpy.context.view_layer.update()
    B = arm.matrix_world @ arm.pose.bones['mixamorig:RightHand'].matrix
    gun.matrix_world = B @ Matrix(pickle.load(open(REL, 'rb')))
# face +X: Mixamo faces -Y, rotate the whole rig +90deg about Z through the hips
sc.frame_set(f0)
hips = arm.matrix_world @ arm.pose.bones['mixamorig:Hips'].head
root = bpy.data.objects.new('Root', None); sc.collection.objects.link(root)
root.location = (hips.x, hips.y, 0)
for o in [arm]:
    mw = o.matrix_world.copy(); o.parent = root; o.matrix_parent_inverse = root.matrix_world.inverted(); o.matrix_world = mw
bpy.context.view_layer.update()
# turn the rig so the rifle barrel (or the body's forward if no rifle) points exactly +X
if os.path.exists(RIFLE):
    d = gun.matrix_world.to_3x3() @ Vector((1, 0, 0))
else:
    d = Vector((0, -1, 0))
root.rotation_euler = (0, 0, -math.atan2(d.y, d.x))
bpy.context.view_layer.update()
hips = arm.matrix_world @ arm.pose.bones['mixamorig:Hips'].head
# camera: orthographic, straight down, hips land on PIVOT
cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = CELL_W / PPM
cam.location = (hips.x + (CELL_W / 2 - PIVOT[0]) / PPM, hips.y - (CELL_H / 2 - PIVOT[1]) / PPM, 20)
cam.data.clip_end = 100
sc.render.resolution_x, sc.render.resolution_y = CELL_W, CELL_H
sc.render.film_transparent = True
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
if ENGINE == 'WORKBENCH':
    sc.render.engine = 'BLENDER_WORKBENCH'
    s = sc.display.shading
    s.light = 'STUDIO'; s.color_type = 'TEXTURE'
    s.show_cavity = True; s.cavity_type = 'BOTH'; s.curvature_ridge_factor = 1.5
    s.show_object_outline = False
    s.show_specular_highlight = True
    sc.display.shading.studio_light = 'paint.sl' if 'paint.sl' in [l.name for l in bpy.context.preferences.studio_lights] else s.studio_light
else:
    if ENGINE == 'CYCLES':
        sc.render.engine = 'CYCLES'; sc.cycles.samples = int(os.environ.get('HF_SAMPLES', '24'))
        sc.cycles.use_denoising = True; sc.cycles.device = 'CPU'; sc.cycles.max_bounces = 3
        sc.render.threads_mode = 'AUTO'
    else:
      sc.render.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE_NEXT'
    w = bpy.data.worlds.new('W'); sc.world = w; w.color = (0.09, 0.09, 0.1)
    def light(name, typ, energy, rot, color=(1, 1, 1)):
        L = bpy.data.objects.new(name, bpy.data.lights.new(name, typ)); L.data.energy = energy; L.data.color = color
        L.rotation_euler = rot; sc.collection.objects.link(L)
    light('Key', 'SUN', 5.5, (math.radians(35), 0, math.radians(-40)))
    light('Rim', 'SUN', 6.0, (math.radians(70), 0, math.radians(160)), (0.75, 0.85, 1.0))
    sc.render.film_transparent = True
frames = [round(f0 + (f1 - f0) * i / (n - 1 if not loop else n)) for i in range(n)]
tmp = os.path.join(out_dir, '_frames'); os.makedirs(tmp, exist_ok=True)
t = time.time()
foot_z = {'L': [], 'R': []}
LOCK = os.environ.get('HF_LOCK_HIPS') == '1'   # keep the body on the spot (e.g. death / downed)
root0 = root.location.copy()
for i, f in enumerate(frames):
    sc.frame_set(f)
    if LOCK:
        root.location = root0; bpy.context.view_layer.update()
        h = arm.matrix_world @ arm.pose.bones['mixamorig:Hips'].head
        root.location = root0 - Vector((h.x - hips.x, h.y - hips.y, 0)); bpy.context.view_layer.update()
    for k, b in (('L', 'LeftFoot'), ('R', 'RightFoot')):
        foot_z[k].append((arm.matrix_world @ arm.pose.bones['mixamorig:' + b].head).z)
    sc.render.filepath = os.path.join(tmp, f'{sheet}_{i:02d}.png'); bpy.ops.render.render(write_still=True)
print('RENDERED', n, 'frames in', round(time.time() - t, 1), 's')
from PIL import Image, ImageFilter, ImageChops
def rim(im):
    # thin light outline like the hand-painted sprites, so the dark soldier reads on dark floors
    a = im.split()[3]
    grown = a.filter(ImageFilter.MaxFilter(3))
    edge = ImageChops.subtract(grown, a)
    ring = Image.new('RGBA', im.size, (150, 158, 170, 0)); ring.putalpha(edge.point(lambda v: int(v * 0.55)))
    return Image.alpha_composite(ring, im)
strip = Image.new('RGBA', (CELL_W * n, CELL_H))
for i in range(n): strip.paste(rim(Image.open(os.path.join(tmp, f'{sheet}_{i:02d}.png')).convert('RGBA')), (i * CELL_W, 0))
strip.save(os.path.join(out_dir, f'{sheet}.webp'), 'WEBP', quality=92, method=6)
meta = {"frame_width": CELL_W, "frame_height": CELL_H, "layout": "row",
        "clips": [{"name": clip, "frames": n, "frame_ms": frame_ms, "loop": loop, "events": {}}],
        "pivots_cell_px": {"torso": list(PIVOT)}, "note": "baked from 3D (Blender) by render_sprites.py",
        "image": f"{sheet}.webp"}
if os.environ.get('HF_WALK'):   # walk-cycle format used by walk_sheet.json
    feet = sorted({min(range(n), key=lambda i: foot_z[k][i]) for k in 'LR'})
    meta = {"frame_width": CELL_W, "frame_height": CELL_H, "frames": n, "layout": "row", "stride_steps": 2,
            "footfall_frames": feet, "pivots_cell_px": {"torso": list(PIVOT)},
            "steps_per_s": float(os.environ['HF_WALK']), "note": "baked from 3D (Blender) by render_sprites.py",
            "image": f"{sheet}.webp"}
json.dump(meta, open(os.path.join(out_dir, f'{sheet}.json'), 'w'), indent=2)
print('WROTE', os.path.join(out_dir, sheet + '.webp'))
