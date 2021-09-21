// Testing initialize endpoints
let COLORS = {
  orange: 0xFFA500,
  yellow: 0xFFFF00,
  greenyellow: 0xADFF2F,
  blue: 0x0000FF,
  lightblue: 0xADD8E6,
  red: 0xFF0000,
  gray: 0x808080,
  black: 0x000000,
  white: 0xFFFFFF
}

function drawEndpoint(pt, color = 0xFF0000, radius = 5) {
  canvas.controls.debug.beginFill(color).drawCircle(pt.x, pt.y, radius).endFill();
}

function drawRay(ray, color = 0xFF0000, width = 1) {
   canvas.controls.debug.lineStyle(width, color, 1).moveTo(ray.A.x, ray.A.y).lineTo(ray.B.x, ray.B.y);
}

CCWSweepPolygon = game.modules.get('testccw').api.CCWSweepPolygon;
CCWSweepWall = game.modules.get('testccw').api.CCWSweepWall;
CCWSweepPoint = game.modules.get('testccw').api.CCWSweepPoint;
Bezier = game.modules.get('testccw').api.Bezier;
orient2d = game.modules.get('testccw').api.orient2d;

// Token version
/*
t = canvas.tokens.controlled[0]
Poly = new CCWSweepPolygon();
Poly.initialize(t.center, {angle: t.data.sightAngle, rotation: t.data.rotation})


CCWSweepPolygon = game.modules.get('testccw').api.CCWSweepPolygon;
await RadialSweepPolygon.benchmark(1000, t.center, {angle: t.data.sightAngle, rotation: t.data.rotation});
await CCWSweepPolygon.benchmark(1000, t.center, {angle: t.data.sightAngle, rotation: t.data.rotation})
*/

// Test wall in line with origin
// set a horizontal and vertical wall in line with the upper left token corner
// t = canvas.tokens.controlled[0];
// Poly = new CCWSweepPolygon();
// Poly.initialize({x: t.x, y: t.y});

// Light version

l = [...canvas.lighting.sources][0];
Poly = new CCWSweepPolygon();
Poly.initialize({x: l.x, y: l.y}, {angle: l.data.angle, debug: false, density: 60, radius: l.radius, rotation: l.data.rotation, type: "light"})



// from compute

let {angle, debug, rotation, type} = Poly.config;
// if ( Poly.config.radius === 0 ) return this;
Poly.config.hasRadius = Poly.config.radius > 0;

// Record configuration parameters
Poly.config.maxR = canvas.dimensions.maxR;
isLimited = Poly.config.isLimited = angle < 360;
Poly.config.aMin = isLimited ? Math.normalizeRadians(Math.toRadians(rotation + 90 - (angle / 2))) : -Math.PI;
Poly.config.aMax = isLimited ? Poly.config.aMin + Math.toRadians(angle) : Math.PI;

Poly._initializeEndpoints(type)

// ------------------------------
// Poly._initializeEndpoints(type)
// ------------------------------
Poly.walls.clear();
Poly.endpoints.clear();

opts = {origin: Poly.origin, radius: Poly.config.radius};

// Consider all walls in the Scene
// candidate walls sometimes a Set (lights), sometimes an Array (token)
candidate_walls = Poly._getCandidateWalls();
wall = [...candidate_walls.values()][0];

// wall = canvas.walls.controlled[0];

wall = CCWSweepWall.createCCWSweepWall(wall, opts);
// drawRay(wall)

// CCWSweepPolygon.includeWall(wall, type, Poly.origin)


ak = WallEndpoint.getKey(wall.A.x, wall.A.y);
bk = WallEndpoint.getKey(wall.B.x, wall.B.y);
a = Poly.endpoints.get(ak);
b = Poly.endpoints.get(bk);

if(!a) { a = new CCWSweepPoint(wall.A.x, wall.A.y, opts); }
if(!b) { b = new CCWSweepPoint(wall.B.x, wall.B.y, opts); }

    
    max_x = Math.max(wall.A.x, wall.B.x);
    min_x = Math.min(wall.A.x, wall.B.x);
    max_y = Math.max(wall.A.y, wall.B.y);
    min_y = Math.min(wall.A.y, wall.B.y);
    
    within_x = ((p.x < max_x || almostEqual(p.x, max_x)) &&
                (p.x > min_x || almostEqual(p.x, min_x)));

    within_y = ((p.y < max_y || almostEqual(p.y, max_y)) &&
                (p.y > min_y || almostEqual(p.y, min_y)));
                      
     within_x && within_y                 

if(Poly.config.hasRadius && (!a.insideRadius || !b.insideRadius)) {
  if(!(wall.radiusIntersections.length > 0)) return;
             
  // add the intersection points to the set of endpoints to sweep
  wall.radiusIntersections.forEach(i => {
       pt = new CCWSweepPoint(i.x, i.y, opts);
       pt.walls.add(wall);
       Poly.endpoints.set(pt.key, pt);
   });
}

a.walls.add(wall);
b.walls.add(wall);
Poly.walls.set(wall.id, wall) // probably don't need {wall, a, b} 
if(!Poly.endpoints.has(ak)) { Poly.endpoints.set(ak, a); } 
if(!Poly.endpoints.has(bk)) { Poly.endpoints.set(bk, b); }

Poly._addCanvasEdges();

// CCWSweepPolygon.includeWall(wall, type)
if(type === "sight" && wall.isInterior) return true;

// Ignore non-blocking walls and open doors
if(!wall.data[type] || wall.isOpen) return false;

// Ignore walls on line with origin unless this is movement
origin_side = wall.whichSide(origin);
if(type !== "move" && origin_side === CONST.WALL_DIRECTIONS.BOTH) return false;

if(!wall.data.dir) return true; // wall not one-directional

// Ignore one-directional walls which are facing away from the origin    
return origin_side === wall.data.dir;

   
   
// Poly._addCanvasEdges() 
// ---------------------
opts = {origin: Poly.origin, radius: Poly.config.radius};

canvas_pts = [{ x: 0, y: 0 }, 
                 { x: canvas.dimensions.width, y: 0 },
                 { x: canvas.dimensions.width, y: canvas.dimensions.height },
                 { x: 0, y: canvas.dimensions.height }];
canvas_pts = canvas_pts.map(pt => new CCWSweepPoint(pt.x, pt.y, opts));

canvas_walls = [
   new CCWSweepWall(canvas_pts[0], canvas_pts[1], opts),
   new CCWSweepWall(canvas_pts[1], canvas_pts[2], opts),
   new CCWSweepWall(canvas_pts[2], canvas_pts[3], opts),
   new CCWSweepWall(canvas_pts[3], canvas_pts[0], opts),
 ];
 
for(let i = 0; i < 4; i += 1) {
  j = (i + 1) % 4;

  canvas_pts[j].walls.add(canvas_walls[i]);
  canvas_pts[j].walls.add(canvas_walls[j]);
  
  Poly.walls.set(canvas_walls[j].id, canvas_walls[j]);
  Poly.endpoints.set(canvas_pts[j].key, canvas_pts[j]);
}
       
       
WallEndpoint.getKey(canvas_pts[i].x, canvas_pts[i].y)

// test endpoints and walls
canvas.controls.debug.clear(); 
Poly.endpoints.forEach(e => drawEndpoint(e));
Poly.walls.forEach(w => drawRay(w));
       