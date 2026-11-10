# CineView 3D

Interactive 3D cinema seat-view simulator. Configure an auditorium, choose a screen
(Standard, IMAX, ScreenX or Custom), click any seat and the camera flies to that
seat's eye position so you see the screen exactly as it would look from there.

## Run it

Requires Node.js 20+.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests (Vitest)
npm run typecheck
npm run build && npm start
```

Shareable views: `/viewer?rows=10&seats=10&screen=imax&seat=H8`
(optional: `blocks`, `sw`, `sh`, `sb`, `sd`, `curve`, `side`, `seatw`, `rowsp`, `rise`, `aisle`, `fov`).

## Controls

| Where | Action |
| --- | --- |
| Seat map / 3D view | Click a seat to sit in it (camera flies there in 1–2 s) |
| Seat map | Arrow keys move focus, Enter sits, hover shows “Row H — Seat 8” |
| Seated | Drag or arrow keys to look around (up to ±135°), scroll for FOV, Esc to stand up |
| Overview | Drag to orbit the cut-away model, scroll to zoom |
| Explore (opt-in) | WASD walk, Q/E down/up, Space faster, drag to look |

## Coordinate system

Metres, Y up. `x = 0` is the centre line (+x is the seated viewer's right), `y = 0`
is the flat front floor, `z = 0` is the plane through the screen centre and +z
points to the back of the room. Viewers look along −z. Row A is nearest the
screen; seat 1 is the left-most seat from the viewer's perspective.

- Seat centre: `x` from seat width + spacing + centre aisles (row centred on 0),
  `z = screen.distance + row × rowSpacing`, `y = row × rowRise` (stadium rake).
- Eye (camera): seat platform + `seatHeight + eyeHeight`, offset `eyeBackOffset` towards the backrest.
- Screen: cylindrical arc with chord `width`, bending towards the audience; flat when curvature = 0.
- ScreenX: continuous surfaces from each screen edge through a curved corner onto the
  side walls, stopping where the raked floor would put them below head height.

## Architecture

```
src/
  lib/geometry/        pure, unit-tested maths (no React / Three.js)
    labels.ts            A..Z, AA.. row labels; seat label parsing ("row h seat 8")
    seatPosition.ts      getSeatPosition, getEyePosition / getCameraPositionForSeat, floor profile
    screenGeometry.ts    curved screen + ScreenX surface generation
    auditoriumGeometry.ts computeLayout(config) → the single physical model
    viewingAngles.ts     distance, horizontal/vertical angle, off-axis, coverage, alignment
    seatScoring.ts       transparent, per-screen-type scoring profiles; findBestSeats; compareSeats
    cameraMath.ts        yaw/pitch model, eased Bézier transitions, overview pose
  lib/config/          defaults + validation for every parameter
  lib/url/             share-URL encode/decode with error reporting
  lib/presets/         PresetRepository interface + localStorage implementation (swap for an API later)
  store/               zustand: auditoriumStore (config → layout), viewerStore (selection, camera, UI)
  components/
    auditorium/          Floor, Walls, Aisles, SeatGrid (instanced), Seat (geometry), materials
    screen/              CinemaScreen, StandardScreen, IMAXScreen, ScreenX, content shader & loader
    camera/              CameraController (overview / seated / explore)
    seat-map/            SeatMap, SeatMapSeat (drawn from the same layout as the 3D scene)
    ui/                  panels, view controls, mini-map, presets, upload, shell
tests/                 Vitest suites for geometry, viewing, scoring, URL, presets, camera, stores
```

The 2D seat map and the 3D scene both render from `computeLayout(config)`, so they
always describe the same physical room.

### Seat scoring

Each component is 0–1 and comes from the seat's 3D sight-lines; the profile per
screen type lives in `src/lib/geometry/seatScoring.ts`:

- **Immersion** `exp(-((H − ideal)/tol)²)` – H is the horizontal angle the screen subtends
  (ideal 40° standard, 62° IMAX, 42° ScreenX centre screen).
- **Alignment** `max(0, 1 − |off-axis| / 45°)`.
- **Neck comfort** – penalises a top-of-screen elevation above 30° (38° IMAX) or looking down.
- **Distance** – distance/screen-width inside a recommended band.
- **Panorama** (ScreenX) – left/right side-wall balance and total coverage.

`score = 100 × Σ wᵢ·cᵢ / Σ wᵢ`; stars = score/20 rounded to halves.

### Approximations (isolated for later improvement)

- ScreenX side content: generated content is naturally continuous; uploaded media is
  extended by stretching the frame's outer band (`sampleSide()` in `screen/screenMaterial.ts`).
  Real projection mapping only needs to replace that function.
- Rows are straight (no arc seating); seats have no occupants.
- Screen light on the room is approximated with area lights coloured by the
  average on-screen colour.

## Performance

Seats render as four `InstancedMesh`es (cushion, back, arm, base) regardless of seat
count; rounded-corner detail drops automatically above 900 seats. Materials and
textures are shared, the camera pose for the mini-map bypasses React, and
`PerformanceMonitor` lowers the pixel ratio if frame rate drops. Up to 2,500 seats are supported.
