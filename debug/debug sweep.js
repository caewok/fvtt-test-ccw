// debug sweep
game.modules.get('testccw').api.use_bezier = false;
game.modules.get('testccw').api.use_bezier = true;
Poly._sweepEndpoints();

// Get to Poly._initializeEndpoints from debug initialize endpoints, then:
PRESET_EPSILON = 1e-8;
function almostEqual(x, y, EPSILON = PRESET_EPSILON) {
  return Math.abs(x - y) < EPSILON;
}
function pointsAlmostEqual(p1, p2, EPSILON = PRESET_EPSILON) {
  return almostEqual(p1.x, p2.x, EPSILON) && almostEqual(p1.y, p2.y, EPSILON);
}


CCWSightRay = game.modules.get('testccw').api.CCWSightRay;
PotentialWallList = game.modules.get('testccw').api.PotentialWallList;

origin = Poly.origin;
let { maxR, isLimited, aMin, aMax, hasRadius } = Poly.config;
radius = Poly.config.radius ?? maxR;

    
// ----- INITIAL RAY INTERSECTION ---- //
// Begin with a ray at the lowest angle to establish initial conditions
// If the FOV has a limited angle, then get the max as well.
// Can avoid using FromAngle if aMin is -π, which means it goes due west
// start_ray = (aMin === -Math.PI) ? 
//              CCWSightRay.fromReference(origin, 
//                                        {x: origin.x - 100, y: origin.y}, 
//                                        radius) :
//              CCWSightRay.fromAngle(origin.x, origin.y, aMin, radius);  
start_ray = undefined;
end_ray = undefined;
endpoints = undefined;

// ----- LIMITED ANGLE FILTER AND SORT ENDPOINTS CW ----- //
// Sort endpoints from CW (0) to CCW (last)
// No limit angle: Sort in relation to a line due west from origin.
// Limit angle: Sort from the starting ray instead of from due west
if(isLimited) {
  // for non-limited, start ray is set to the first endpoint after sorting.
  start_ray = CCWSightRay.fromAngle(origin.x, origin.y, aMin, radius);
  end_ray =   CCWSightRay.fromAngle(origin.x, origin.y, aMax, radius);
  // drawRay(start_ray, COLORS.blue)
  // drawRay(end_ray, COLORS.orange)
  
  Poly._trimEndpointsByLimitedAngle(start_ray, end_ray);
  endpoints = CCWSweepPolygon.sortEndpointsCWFrom(origin, [...Poly.endpoints.values()], start_ray.B);

} else{
  endpoints = CCWSweepPolygon.sortEndpointsCW(origin, [...Poly.endpoints.values()]);
  start_ray = endpoints.length > 0 ? CCWSightRay.fromReference(origin, endpoints[0], radius) : undefined;
}


                 
// ----- ADD LIMITED ANGLE ENDPOINTS ----- //
if(isLimited) {
  start_wall = undefined;
  end_wall = undefined;
  if(!hasRadius) {
     // if not radius-limited, we need the canvas wall that each ray intersects, if any
     canvas_pts = [{ x: 0, y: 0 }, 
                 { x: canvas.dimensions.width, y: 0 },
                 { x: canvas.dimensions.width, y: canvas.dimensions.height },
                 { x: 0, y: canvas.dimensions.height }];
                 
     canvas_walls = [
         new CCWSweepWall(canvas_pts[0], canvas_pts[1]),
         new CCWSweepWall(canvas_pts[1], canvas_pts[2]),
         new CCWSweepWall(canvas_pts[2], canvas_pts[3]),
         new CCWSweepWall(canvas_pts[3], canvas_pts[0]),
       ];
    
    start_wall = canvas_walls.filter(w => w.intersects(start_ray))[0];        
    end_wall = canvas_walls.filter(w => w.intersects(end_ray))[0];   
  }
 
  start_point = Poly._getRayIntersection(start_wall, start_ray);
  end_point = Poly._getRayIntersection(end_wall, end_ray);
  
  opts = {origin: origin, radius: radius};
  endpoints.unshift(new CCWSweepPoint(start_point.x, start_point.y, opts)); // first endpoint
  endpoints.push(new CCWSweepPoint(end_point.x, end_point.y, opts)); // last endpoint
}                 

// ----- STARTING STATE ------ //
potential_walls = new PotentialWallList(origin);
if(endpoints.length > 0) {
  start_endpoint = endpoints[0];
  start_walls = [...Poly.walls.values()].filter(w => {
        if(!start_ray.intersects(w)) return false;
      
        // if the starting endpoint is at the start of the wall, don't include it
        if(pointsAlmostEqual(w.A, start_endpoint) || 
           pointsAlmostEqual(w.B, start_endpoint)) {
           ccw = PotentialWallList.endpointWallCCW(origin, start_endpoint, w) === 1;  
           if(!ccw) return false;
        }
        return true;    
      });
       
  potential_walls.addWalls(start_walls);
}

// ----- SWEEP CLOCKWISE ----- //
// initialize the points
Poly.points = [];
if(isLimited) { Poly.points.push(origin.x, origin.y) }  

hasRadius ? Poly._sweepEndpointsRadius(potential_walls, endpoints) :
                Poly._sweepEndpointsNoRadius(potential_walls, endpoints);
    
// close the limited shape            
if(isLimited) { Poly.points.push(origin.x, origin.y) }    


_sweepEndpointsNoRadius(potential_walls, endpoints) {
    // Poly.points = [];
    endpoints_ln = endpoints.length;
    radius = Poly.config.maxR;
    collisions = Poly.points;   
    origin = Poly.origin;
    closest_wall = potential_walls.closest();
    
//     potential_walls = new PotentialWallList(origin); // BST ordered by closeness
    
    // Set starting state by getting all walls that intersect the start ray
    // if the endpoint is the start of a wall (CW), exclude from list
    // 
    // origin --> endpoint[0] --> other collision? --> canvas edge
//     start_endpoint = endpoints[0];
//     start_ray = CCWSightRay.fromReference(Poly.origin, 
//                                           start_endpoint, 
//                                           radius)
//                                                                    
//     start_walls = [...Poly.walls.values()].filter(w => {
//       if(!start_ray.intersects(w)) return false;
//       if(pointsAlmostEqual(w.A, endpoints[0]) || pointsAlmostEqual(w.B, start_endpoint)) {
//         ccw = PotentialWallList.endpointWallCCW(origin, start_endpoint, w) === 1; 
//         if(!ccw) return false;
//       }
//       return true;    
//     });

    // Possibilities:
    // 1. Endpoint[0] is at beginning of the start wall. Exclude that wall. 
    // 2. Endpoint[0] is at end of the start wall. Keep that wall
    // 3. closest wall is in line with the sweep line. TO-DO: this one may need more testing.
    
//     potential_walls.addWalls(start_walls);
//     closest_wall = potential_walls.closest();
    
    var i;
    for(i = 0; i < endpoints_ln; i += 1) {
      endpoint = endpoints[i];   
      potential_walls.addFromEndpoint(endpoint); // this removes old endpoint, including closest
      drawEndpoint(endpoint)
      
      if(!closest_wall) {
        console.warn(`No closest wall at iteration ${i}, endpoint ${endpoint.key}`);
      }
            
      // is this endpoint at the end of the closest_wall?
      // (if it were the beginning of a wall, that wall would not yet be the closest)
      // (could be the beginning if we are at the first endpoint)
      // TO-DO: Would it be faster/better to compare the point keys?
      if(endpoint.almostEqual(closest_wall.A) || 
         endpoint.almostEqual(closest_wall.B)) {

        collisions.push(endpoint.x, endpoint.y);
        
        // get the next-closest wall (the one behind the current endpoint)
        // find its intersection point and add the collision
        // sightline --> endpoint at closest wall --> next closest wall
        //potential_walls.closest({ remove: true });
        closest_wall = potential_walls.closest();
        ray = CCWSightRay.fromReference(origin, endpoint, radius); 
        intersection = Poly._getRayIntersection(closest_wall, ray);
        // drawRay(ray, COLORS.blue)
        // drawEndpoint(intersection)
        
        // add the intersection point unless we already did
        // (occurs at join points of two walls, or at endpoint[0])
        if(!endpoint.keyEquals(intersection)) { collisions.push(intersection.x, intersection.y) }
        
        continue;
      }
      
      // is this endpoint within the closest_wall?
//       if(isLimited && 
//          (Boolean(endpoint?.minLimit) || Boolean(endpoint?.maxLimit)) && 
//          closest_wall.contains(endpoint)) {
//         
//         collisions.push(endpoint.x, endpoint.y);   
//         continue; 
//       }
      
      // is the endpoint in front of the closest wall? 
      if(!closest_wall.inFrontOfPoint(endpoint, origin)) {
        // special case: endpoint is on a wall in line with the origin
        // deal with by dropping those walls in the first instance?
      
        // Find and mark intersection of sightline --> endpoint --> current closest wall
        ray = CCWSightRay.fromReference(origin, endpoint, radius);
        intersection = Poly._getRayIntersection(closest_wall, ray);
        // drawRay(ray)
        // drawEndpoint(intersection)
        collisions.push(intersection.x, intersection.y);
        
        // mark this closer endpoint and retrieve the closest wall.
        collisions.push(endpoint.x, endpoint.y);
        closest_wall = potential_walls.closest();
        
        continue;
      }
      
      if(isLimited && (i === 0 || i === (endpoints_ln - 1))) {
        // limited endpoint behind or on closest wall. 
        // mark that spot on the closest wall: origin --> closest --> limited start/end point
        ray = CCWSightRay.fromReference(origin, endpoint, radius);
        intersection = Poly._getRayIntersection(closest_wall, ray);
        if(intersection) { collisions.push(intersection.x, intersection.y); }
        //continue
      }
      
    } // end of for loop
    
  }
    
canvas.controls.debug.clear();    
for(i = 0; i < collisions.length; i += 2) {
  drawEndpoint({x: collisions[i], y: collisions[i+1]});
}


canvas.controls.debug.clear();    
for(i = 0; i < Poly.points.length; i += 2) {
  drawEndpoint({x: Poly.points[i], y: Poly.points[i+1]});
}

canvas.controls.debug.lineStyle(1, COLORS.red).drawShape(Poly);

CONFIG.Canvas.losBackend = CCWSweepPolygon;

CONFIG.Canvas.losBackend = game.modules.get('testccw').api.CCWSweepPolygon;

    