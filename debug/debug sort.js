// Debug sorting
// Get to Poly._initializeEndpoints from debug initialize endpoints, then:
orient2d = game.modules.get('testccw').api.orient2d;

function orient2dPoints(p1, p2, p3) {
  if(!game.modules.get('testccw').api.use_robust_ccw) {
    return orient2dfast(p1.x, p1.y,
                        p2.x, p2.y,
                        p3.x, p3.y)
  }

  return orient2d(p1.x, p1.y,
                  p2.x, p2.y,
                  p3.x, p3.y);
}


endpoints = CCWSweepPolygon.sortEndpointsCW(Poly.origin, [...Poly.endpoints.values()])
canvas.controls.debug.clear();
drawEndpoint(endpoints[0])
drawEndpoint(endpoints[1])
drawEndpoint(endpoints[2])

ln = endpoints.length;
drawEndpoint(endpoints[ln - 1])
drawEndpoint(endpoints[ln - 2])
drawEndpoint(endpoints[ln - 3])

drawRay(new Ray(Poly.origin, endpoints[0]), COLORS.blue)



canvas.controls.debug.clear();
drawEndpoint(endpoints[3], COLORS.blue)
endpoints =  CCWSweepPolygon.sortEndpointsCWFrom(Poly.origin, [...Poly.endpoints.values()], endpoints[3])


endpoints = sortEndpointsCW(Poly.origin, [...Poly.endpoints.values()])

function sortEndpointsCW(origin, endpoints) {
    

    const TOP = -1;
    const BOTTOM = 1;
    const LEFT = -1;
    const RIGHT = 1;
          
    return endpoints.sort((a, b) => {
      // arbitrarily declare upper hemisphere to be first
      // so x < vision_point (above) is before x > vision_point (below)
      // walk quadrants, so Q1 is upper left, Q3 is lower right
      // return > 0 to sort b before a
    
    
      // most of this is just to speed up the sort, by checking quadrant location first 
      const a_hemisphere = a.y < origin.y ? TOP : BOTTOM;
      const b_hemisphere = b.y < origin.y ? TOP : BOTTOM;
    
      // if not in same hemisphere, sort accordingly
      if(a_hemisphere !== b_hemisphere) return a_hemisphere; 
      // TOP:  b before a (1)
      // BOTTOM: a before b (-1)
    
      const a_quadrant = a.x < origin.x ? LEFT : RIGHT;
      const b_quadrant = b.x < origin.x ? LEFT : RIGHT;
    
      if(a_quadrant !== b_quadrant) {
        // already know that a and b share hemispheres
        if(a_hemisphere === TOP) {
          return a_quadrant;
          // TOP, LEFT: b before a (1)
          // TOP, RIGHT: a before b (-1)
        } else {
          return -a_quadrant;
          // BOTTOM, LEFT: a before b (-1)
          // BOTTOM, RIGHT: b before a (1)
        }
      }
        
      return orient2dPoints(origin, a, b);
   
    });
  }