// debug radius sweep

// Poly._sweepEndpoints();

// Get to Poly._initializeEndpoints from debug initialize endpoints, then:
// Do the intro portion of debug sweep, then


_sweepEndpointsRadius(potential_walls, endpoints) {
    // Poly.points = [];
    endpoints_ln = endpoints.length;
    let { radius, isLimited } = Poly.config;
    collisions = Poly.points;   
    origin = Poly.origin;
    needs_padding = false;
    end_needs_padding = false;
    closest_wall = potential_walls.closest();
    
//     potential_walls = new PotentialWallList(origin); // BST ordered by closeness
    
    // Set starting state by getting all walls that intersect the start ray
    // if the endpoint is the start of a wall (CW), exclude from list
    // 
    // origin --> endpoint[0] --> other collision? --> canvas edge
   //  start_endpoint = endpoints[0];
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
    // 4. no closest wall b/c of radius limit
    
 //    potential_walls.addWalls(start_walls);
//     closest_wall = potential_walls.closest();
        // if no endpoints, skip to the end and pad
//     if(endpoints_ln > 0) {
//     
//       // Set starting state by getting all walls that intersect the start ray
//       // if the endpoint is the start of a wall (CW), exclude from list
//       // origin --> endpoint[0] --> other collision? --> canvas edge
//       const start_endpoint = endpoints[0];
//       const start_ray = CCWSightRay.fromReference(origin, start_endpoint, radius);
//       const start_walls = [...this.walls.values()].filter(w => {
//         if(!start_ray.intersects(w)) return false;
//         if(pointsAlmostEqual(w.A, endpoints[0]) || pointsAlmostEqual(w.B, start_endpoint)) {
//           const ccw = PotentialWallList.endpointWallCCW(origin, start_endpoint, w) === 1; 
//           if(!ccw) return false;
//         }
//         return true;    
//       });
// 
//       potential_walls.addWalls(start_walls);
//       closest_wall = potential_walls.closest();
//     }
    
    for(i = 0; i < endpoints_ln; i += 1) {
      endpoint = endpoints[i];   
      potential_walls.addFromEndpoint(endpoint);
      drawEndpoint(endpoint)
      // endpoint.walls.forEach(w => drawRay(w))
      // potential_walls.inorder().forEach(w => drawRay(w))
      // canvas.controls.debug.clear();  
      
      if(needs_padding) {
        needs_padding = false;
        
        // draw an arc from where the collisions ended to the ray for the new endpoint
        l = collisions.length;
        last_collision = { x: collisions[l - 2], y: collisions[l - 1] };
        prior_ray = CCWSightRay.fromReference(origin, last_collision, radius);
        ray = CCWSightRay.fromReference(origin, endpoint, radius);
        // drawRay(prior_ray, COLORS.blue)
//         drawRay(ray, COLORS.orange)
        
        Poly._addPadding(prior_ray, ray, collisions);
      }
      
      // No wall within radius
      // mark end of vision ray as collision
      // try to get new closer wall from this endpoint
      if(!closest_wall) {
        //ray = CCWSightRay.fromReference(origin, endpoint, radius);
        // drawRay(ray, COLORS.blue)
        //collisions.push(ray.B.x, ray.B.y); 
        
        closest_wall = potential_walls.closest();
        
        at_radius_edge = pointsAlmostEqual(endpoint, ray.B);
        if(at_radius_edge || !endpoint.insideRadius) {
          // endpoint is outside the radius so don't add it to collisions. 
          // or it is at the edge of the radius
          // need to pad b/c no wall in front of the endpoint, 
          //   so empty space to next point
          
          needs_padding = true;
        } else if(!at_radius_edge) {
          // add unless we already did above.
          collisions.push(endpoint.x, endpoint.y); 
        }
        
        continue;
      }
      
            
      // is this endpoint at the end of the closest_wall?
      // (if it were the beginning of a wall, that wall would not yet be the closest)
      // (could be the beginning if we are at the first endpoint)
      // TO-DO: Would it be faster/better to compare the point keys?
      if(endpoint.almostEqual(closest_wall.A) || 
         endpoint.almostEqual(closest_wall.B)) {
      
        // get the next-closest wall (the one behind the current endpoint)
        closest_wall = potential_walls.closest();
     
        if(endpoint.insideRadius) { 
          collisions.push(endpoint.x, endpoint.y); 
        
          // find its intersection point and add the collision
          // sightline --> endpoint at closest wall --> next closest wall
          //potential_walls.closest({ remove: true });
          ray = CCWSightRay.fromReference(origin, endpoint, radius); 
          intersection = Poly._getRayIntersection(closest_wall, ray);
          // drawRay(ray, COLORS.blue)
          // drawEndpoint(intersection)
        
          // add the intersection point unless we already did
          // (occurs at join points of two walls, or at endpoint[0])
          if(!endpoint.keyEquals(intersection)) { collisions.push(intersection.x, intersection.y) }
        
           // if the ray does not actually intersect the closest wall, we need to add padding
          if(!closest_wall || !ray.intersects(closest_wall)) { 
            needs_padding = true;
          }
        }
        
        continue;
      }
      
      // is this endpoint within the closest_wall?
      if(closest_wall.contains(endpoint)) {
        if(endpoint.insideRadius) { collisions.push(endpoint.x, endpoint.y); }
       
        continue; 
      }
      
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
        
        // continue;
      }
      
    } // end of for loop
    
    // catch when the last endpoint needs padding to the previous collision
    if(needs_padding) {
      // copied from padding above
      l = collisions.length;
      last_collision = { x: collisions[l - 4], y: collisions[l - 3] };
      last_endpoint = { x: collisions[l - 2], y: collisions[l - 1] };
      prior_ray = CCWSightRay.fromReference(origin, last_collision, radius);
      ray = CCWSightRay.fromReference(origin, last_endpoint, radius);
      needs_padding = false;
    }
    
    // close between last / first endpoint if they are not connected by a wall
    // deal with unique case where there are no endpoints or no collisions
    // (no blocking walls for radius vision)
    
    if(!isLimited) {
      needs_padding = true;
      if(collisions.length > 0 && closest) {
        needs_padding = !(pointsAlmostEqual({x: collisions[0], y: collisions[1]}, closest_wall.A) || 
          pointsAlmostEqual({x: collisions[0], y: collisions[1]}, closest_wall.B))
      }
    
      if(needs_padding) {
        collisions_ln = collisions.length;
        p_last = {x: collisions[collisions_ln - 2], y: collisions[collisions_ln - 1]};
        p_current = {x: collisions[0], y: collisions[1]};
      
        // if 0 or 1 collisions, then just pick an appropriate point
        // padding is best done by hemisphere in that case
        if(collisions_ln === 0) {
          p_last = { x: origin.x - radius, y: origin.y }; 
          p_current = { x: origin.x + radius, y: origin.y }
    
          collisions.push(p_last.x, p_last.y);
    
        } else if(collisions_ln === 1) {
          // get antipodal point
          p_last = { x: origin.x - (p_current.x - origin.x),
                     y: origin.y - (p_current.y - origin.y) }
        }
      
        // draw an arc from where the collisions ended to the ray for the new endpoint
        prior_ray = CCWSightRay.fromReference(origin, p_last, radius);
        ray = CCWSightRay.fromReference(origin, p_current, radius);
        // drawRay(prior_ray, COLORS.blue)
        // drawRay(ray, COLORS.orange)
        
        Poly._addPadding(prior_ray, ray, collisions);

        if(collisions_ln < 2) {
          // get the second half by swapping the two rays
          collisions.push(p_current.x, p_current.y);
          Poly._addPadding(ray, prior_ray, collisions); 
        }
      }
    }
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

    