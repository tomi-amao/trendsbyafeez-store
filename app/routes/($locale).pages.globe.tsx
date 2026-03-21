export async function loader() {
  return new Response(null, {
    status: 302,
    headers: {Location: '/globe.html'},
  });
}

// Globe is served as a static file at /globe.html
// This stub is kept for the React Router default export requirement.
const GLOBE_HTML = `<!-- removed --
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>TrendsByAfeez — Globe</title>
<style>
  /* ── Reset & Base ─────────────────────────────────── */
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; overflow: hidden; background: #000; font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #fff; }
  canvas { display: block; }

  /* ── Tooltip ──────────────────────────────────────── */
  #tooltip {
    position: fixed;
    pointer-events: none;
    padding: 10px 18px;
    background: rgba(0,0,0,0.75);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px;
    font-size: 14px;
    letter-spacing: 0.04em;
    color: #f5f0e8;
    opacity: 0;
    transform: translateY(6px);
    transition: opacity 0.25s ease, transform 0.25s ease;
    z-index: 100;
    white-space: nowrap;
  }
  #tooltip.visible { opacity: 1; transform: translateY(0); }
  #tooltip .country-name { font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.5); margin-bottom: 3px; }
  #tooltip .phrase { font-size: 16px; font-style: italic; color: #f5deb3; }

  /* ── Loading ──────────────────────────────────────── */
  #loader {
    position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
    background: #000; z-index: 200; transition: opacity 0.8s ease;
  }
  #loader.hidden { opacity: 0; pointer-events: none; }
  #loader span { font-size: 14px; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.5); }
</style>
</head>
<body>
<div id="loader"><span>Loading globe…</span></div>
<div id="tooltip"><div class="country-name"></div><div class="phrase"></div></div>
<div id="globe-container"></div>

<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"
  }
}
</script>

<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ════════════════════════════════════════════════════════════════
   CONFIG
   ════════════════════════════════════════════════════════════════ */
const GLOBE_RADIUS = 5;
const ATMOSPHERE_RADIUS = 5.25;
const COUNTRY_DATA = {
  FRA: { name: 'France',          phrase: 'Je n\\'étais jamais ici',   lat: 46.6034, lon: 2.3488  },
  ARE: { name: 'UAE (Dubai)',      phrase: 'لم أكن هنا أبداً',          lat: 25.276987, lon: 55.296249 },
  GBR: { name: 'United Kingdom',  phrase: 'I was never here',         lat: 51.5074, lon: -0.1278 },
};
const HIGHLIGHT_COLOR = new THREE.Color(0xf5c56c);
const COUNTRY_BASE_COLOR = new THREE.Color(0x2a2a3a);
const OCEAN_COLOR = new THREE.Color(0x0a0a18);
const BORDER_COLOR = new THREE.Color(0x3a3a4f);

/* ════════════════════════════════════════════════════════════════
   SCENE SETUP
   ════════════════════════════════════════════════════════════════ */
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(0, 2, 14);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.getElementById('globe-container').appendChild(renderer.domElement);

/* Controls */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.rotateSpeed = 0.4;
controls.enableZoom = true;
controls.minDistance = 8;
controls.maxDistance = 22;
controls.enablePan = false;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.4;

/* Lights */
const ambientLight = new THREE.AmbientLight(0x334466, 1.2);
scene.add(ambientLight);
const sunLight = new THREE.DirectionalLight(0xfff5e0, 2.0);
sunLight.position.set(10, 6, 10);
scene.add(sunLight);
const fillLight = new THREE.DirectionalLight(0x8899bb, 0.5);
fillLight.position.set(-8, -4, -6);
scene.add(fillLight);

/* ════════════════════════════════════════════════════════════════
   STARFIELD
   ════════════════════════════════════════════════════════════════ */
function createStarfield() {
  const count = 6000;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const r = 80 + Math.random() * 120;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
    sizes[i] = 0.5 + Math.random() * 1.5;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: \`
      attribute float size;
      uniform float time;
      varying float vBright;
      void main() {
        vBright = 0.5 + 0.5 * sin(time * 0.5 + position.x * 0.01 + position.y * 0.02);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (200.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    \`,
    fragmentShader: \`
      varying float vBright;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float alpha = smoothstep(0.5, 0.0, d) * (0.4 + 0.6 * vBright);
        gl_FragColor = vec4(vec3(0.85, 0.88, 1.0), alpha);
      }
    \`,
    transparent: true,
    depthWrite: false,
  });
  return { mesh: new THREE.Points(geo, mat), material: mat };
}
const stars = createStarfield();
scene.add(stars.mesh);

/* ════════════════════════════════════════════════════════════════
   ATMOSPHERE GLOW (Fresnel Shader)
   ════════════════════════════════════════════════════════════════ */
function createAtmosphere() {
  const geo = new THREE.SphereGeometry(ATMOSPHERE_RADIUS, 64, 64);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(0x4488ff) },
      viewVector: { value: camera.position },
    },
    vertexShader: \`
      uniform vec3 viewVector;
      varying float vIntensity;
      void main() {
        vec3 vNormal = normalize(normalMatrix * normal);
        vec3 vNormel = normalize(normalMatrix * viewVector);
        vIntensity = pow(0.72 - dot(vNormal, vNormel), 3.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    \`,
    fragmentShader: \`
      uniform vec3 glowColor;
      varying float vIntensity;
      void main() {
        gl_FragColor = vec4(glowColor, 1.0) * vIntensity * 1.1;
      }
    \`,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  return new THREE.Mesh(geo, mat);
}
const atmosphere = createAtmosphere();
scene.add(atmosphere);

/* ════════════════════════════════════════════════════════════════
   GLOBE – Ocean Base Sphere
   ════════════════════════════════════════════════════════════════ */
const oceanGeo = new THREE.SphereGeometry(GLOBE_RADIUS - 0.005, 128, 128);
const oceanMat = new THREE.MeshStandardMaterial({
  color: OCEAN_COLOR,
  roughness: 0.7,
  metalness: 0.1,
});
const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
scene.add(oceanMesh);

/* ════════════════════════════════════════════════════════════════
   GEOJSON → 3D COUNTRY MESHES
   ════════════════════════════════════════════════════════════════ */
const globeGroup = new THREE.Group();
scene.add(globeGroup);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const countryMeshes = [];   // { mesh, iso, data }
let hoveredCountry = null;

// Convert lat/lon → 3D position on sphere
function latLonToVec3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
     radius * Math.cos(phi),
     radius * Math.sin(phi) * Math.sin(theta),
  );
}

// Triangulate a simple 2D polygon ring (ear-clipping via Three.js ShapeUtils)
function triangulateRing(ring) {
  // ring is [[lon, lat], ...]
  const shape = ring.map(([lon, lat]) => new THREE.Vector2(lon, lat));
  // Remove closing duplicate
  const last = shape[shape.length - 1];
  const first = shape[0];
  if (Math.abs(last.x - first.x) < 1e-6 && Math.abs(last.y - first.y) < 1e-6) shape.pop();
  if (shape.length < 3) return [];
  return THREE.ShapeUtils.triangulateShape(shape, []);
}

function buildCountryMesh(coords, iso) {
  const positions = [];
  const processRing = (ring) => {
    const verts = ring.map(([lon, lat]) => {
      const v = latLonToVec3(lat, lon, GLOBE_RADIUS + 0.003);
      return [v.x, v.y, v.z, lon, lat];
    });
    const shape2D = ring.map(([lon, lat]) => new THREE.Vector2(lon, lat));
    const lastS = shape2D[shape2D.length - 1];
    const firstS = shape2D[0];
    if (Math.abs(lastS.x - firstS.x) < 1e-6 && Math.abs(lastS.y - firstS.y) < 1e-6) {
      shape2D.pop();
      verts.pop();
    }
    if (shape2D.length < 3) return;
    try {
      const faces = THREE.ShapeUtils.triangulateShape(shape2D, []);
      for (const [a, b, c] of faces) {
        positions.push(verts[a][0], verts[a][1], verts[a][2]);
        positions.push(verts[b][0], verts[b][1], verts[b][2]);
        positions.push(verts[c][0], verts[c][1], verts[c][2]);
      }
    } catch(e) { /* skip degenerate polygons */ }
  };

  if (coords.type === 'Polygon') {
    processRing(coords.coordinates[0]);
  } else if (coords.type === 'MultiPolygon') {
    for (const polygon of coords.coordinates) {
      processRing(polygon[0]);
    }
  }

  if (positions.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();

  const isTarget = !!COUNTRY_DATA[iso];
  const mat = new THREE.MeshStandardMaterial({
    color: COUNTRY_BASE_COLOR.clone(),
    roughness: 0.75,
    metalness: 0.05,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.95,
  });
  const mesh = new THREE.Mesh(geo, mat);
  return { mesh, iso, isTarget, material: mat, originalColor: COUNTRY_BASE_COLOR.clone() };
}

// Build border lines
function buildBorderLines(coords) {
  const lines = [];
  const processRing = (ring) => {
    const points = ring.map(([lon, lat]) => latLonToVec3(lat, lon, GLOBE_RADIUS + 0.006));
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: BORDER_COLOR, transparent: true, opacity: 0.35 });
    lines.push(new THREE.Line(geo, mat));
  };
  if (coords.type === 'Polygon') {
    coords.coordinates.forEach(processRing);
  } else if (coords.type === 'MultiPolygon') {
    for (const polygon of coords.coordinates) polygon.forEach(processRing);
  }
  return lines;
}

/* ════════════════════════════════════════════════════════════════
   PLANE MODEL
   ════════════════════════════════════════════════════════════════ */
function createPlane() {
  const group = new THREE.Group();
  // Fuselage
  const fuselage = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.35, 8),
    new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.3, metalness: 0.5 })
  );
  fuselage.rotation.z = Math.PI / 2;
  group.add(fuselage);
  // Wings
  const wing = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.008, 0.35),
    new THREE.MeshStandardMaterial({ color: 0xe0e0e0, roughness: 0.3, metalness: 0.5 })
  );
  group.add(wing);
  // Tail
  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.12, 0.008),
    new THREE.MeshStandardMaterial({ color: 0xe0e0e0, roughness: 0.3, metalness: 0.5 })
  );
  tail.position.set(-0.15, 0.04, 0);
  group.add(tail);
  // Trail glow
  const trail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.03, 0.25, 8),
    new THREE.MeshBasicMaterial({ color: 0xf5c56c, transparent: true, opacity: 0.4 })
  );
  trail.rotation.z = Math.PI / 2;
  trail.position.set(-0.28, 0, 0);
  group.add(trail);

  group.visible = false;
  group.scale.setScalar(1.5);
  return group;
}
const planeModel = createPlane();
scene.add(planeModel);

/* ════════════════════════════════════════════════════════════════
   PLANE ANIMATION STATE
   ════════════════════════════════════════════════════════════════ */
let planeAnimating = false;
let planeRoute = [];        // Array of Vector3 waypoints
let planeRouteIndex = 0;
let planeCurrentISO = null; // where the plane currently is
let planeSpeed = 0.012;
let arcLine = null;         // visual arc line

function generateGreatCircleArc(start, end, altitude, segments) {
  const points = [];
  const startN = start.clone().normalize();
  const endN = end.clone().normalize();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    // Slerp on unit sphere
    const omega = Math.acos(THREE.MathUtils.clamp(startN.dot(endN), -1, 1));
    let pt;
    if (omega < 0.001) {
      pt = startN.clone();
    } else {
      pt = startN.clone().multiplyScalar(Math.sin((1 - t) * omega) / Math.sin(omega))
        .add(endN.clone().multiplyScalar(Math.sin(t * omega) / Math.sin(omega)));
    }
    // Raise altitude with a sine bulge
    const bulge = 1 + altitude * Math.sin(t * Math.PI);
    pt.multiplyScalar(GLOBE_RADIUS * bulge);
    points.push(pt);
  }
  return points;
}

function startPlaneTravel(toISO) {
  const destData = COUNTRY_DATA[toISO];
  if (!destData) return;
  const destPos = latLonToVec3(destData.lat, destData.lon, GLOBE_RADIUS);

  let startPos;
  if (planeCurrentISO && COUNTRY_DATA[planeCurrentISO]) {
    const sd = COUNTRY_DATA[planeCurrentISO];
    startPos = latLonToVec3(sd.lat, sd.lon, GLOBE_RADIUS);
  } else if (planeModel.visible) {
    startPos = planeModel.position.clone().normalize().multiplyScalar(GLOBE_RADIUS);
  } else {
    // Default start from camera-facing equator point
    const camDir = camera.position.clone().normalize();
    startPos = camDir.multiplyScalar(GLOBE_RADIUS);
  }

  planeRoute = generateGreatCircleArc(startPos, destPos, 0.12, 120);
  planeRouteIndex = 0;
  planeAnimating = true;
  planeModel.visible = true;
  planeModel.position.copy(planeRoute[0]);
  planeCurrentISO = toISO;

  // Visual arc line
  if (arcLine) scene.remove(arcLine);
  const arcGeo = new THREE.BufferGeometry().setFromPoints(planeRoute);
  const arcMat = new THREE.LineBasicMaterial({ color: 0xf5c56c, transparent: true, opacity: 0.35 });
  arcLine = new THREE.Line(arcGeo, arcMat);
  scene.add(arcLine);
}

function updatePlane() {
  if (!planeAnimating || planeRoute.length === 0) return;

  planeRouteIndex += 1;
  if (planeRouteIndex >= planeRoute.length) {
    planeAnimating = false;
    // Fade out arc line
    if (arcLine) {
      const fade = () => {
        arcLine.material.opacity -= 0.01;
        if (arcLine.material.opacity > 0) requestAnimationFrame(fade);
        else { scene.remove(arcLine); arcLine = null; }
      };
      fade();
    }
    return;
  }

  const pos = planeRoute[planeRouteIndex];
  planeModel.position.copy(pos);

  // Orient plane to face direction of travel
  const nextIdx = Math.min(planeRouteIndex + 1, planeRoute.length - 1);
  const nextPos = planeRoute[nextIdx];
  const direction = nextPos.clone().sub(pos).normalize();
  const up = pos.clone().normalize();
  // Create orientation matrix
  const lookTarget = pos.clone().add(direction);
  planeModel.lookAt(lookTarget);
  // Align "up" to be radially outward
  const m = new THREE.Matrix4();
  const forward = direction.clone();
  const right = new THREE.Vector3().crossVectors(forward, up).normalize();
  const correctedUp = new THREE.Vector3().crossVectors(right, forward).normalize();
  m.makeBasis(forward, correctedUp, right.negate());
  planeModel.quaternion.setFromRotationMatrix(m);
}

/* ════════════════════════════════════════════════════════════════
   FETCH GEOJSON & BUILD MESHES
   ════════════════════════════════════════════════════════════════ */
const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

async function loadGeoData() {
  const res = await fetch(GEO_URL);
  const topo = await res.json();
  // Convert TopoJSON → GeoJSON features
  const features = topoToGeo(topo, topo.objects.countries);

  for (const feature of features) {
    const iso = isoFromId(feature.id);
    const result = buildCountryMesh(feature.geometry, iso);
    if (!result) continue;
    globeGroup.add(result.mesh);
    countryMeshes.push(result);
    const borders = buildBorderLines(feature.geometry);
    borders.forEach(l => globeGroup.add(l));
  }

  document.getElementById('loader').classList.add('hidden');
}

/* Minimal TopoJSON → GeoJSON converter (no external dep) */
function topoToGeo(topology, object) {
  const arcs = topology.arcs;
  const transform = topology.transform;
  const features = [];

  function decodeArc(arcIdx) {
    const reversed = arcIdx < 0;
    const arc = arcs[reversed ? ~arcIdx : arcIdx];
    const coords = [];
    let x = 0, y = 0;
    for (const [dx, dy] of arc) {
      x += dx; y += dy;
      if (transform) {
        coords.push([
          x * transform.scale[0] + transform.translate[0],
          y * transform.scale[1] + transform.translate[1],
        ]);
      } else {
        coords.push([x, y]);
      }
    }
    if (reversed) coords.reverse();
    return coords;
  }

  function decodeRing(indices) {
    let coords = [];
    for (const idx of indices) {
      const arc = decodeArc(idx);
      // Remove first point of subsequent arcs to avoid duplicates
      coords = coords.concat(coords.length > 0 ? arc.slice(1) : arc);
    }
    return coords;
  }

  for (const geo of object.geometries) {
    let geometry;
    if (geo.type === 'Polygon') {
      geometry = { type: 'Polygon', coordinates: geo.arcs.map(decodeRing) };
    } else if (geo.type === 'MultiPolygon') {
      geometry = { type: 'MultiPolygon', coordinates: geo.arcs.map(p => p.map(decodeRing)) };
    } else continue;
    features.push({ id: geo.id, geometry });
  }
  return features;
}

/* world-atlas uses numeric IDs; map to ISO 3166-1 alpha-3 */
const ID_TO_ISO = {
  '250': 'FRA', '784': 'ARE', '826': 'GBR',
  '840': 'USA', '156': 'CHN', '356': 'IND', '276': 'DEU',
  '380': 'ITA', '724': 'ESP', '076': 'BRA', '392': 'JPN',
  '036': 'AUS', '124': 'CAN', '643': 'RUS', '410': 'KOR',
  '484': 'MEX', '566': 'NGA', '710': 'ZAF', '682': 'SAU',
};
function isoFromId(id) {
  return ID_TO_ISO[String(id)] || 'UNK_' + id;
}

/* ════════════════════════════════════════════════════════════════
   INTERACTION – Hover & Click
   ════════════════════════════════════════════════════════════════ */
const tooltip = document.getElementById('tooltip');
const tooltipName = tooltip.querySelector('.country-name');
const tooltipPhrase = tooltip.querySelector('.phrase');

function onPointerMove(e) {
  mouse.x = (e.clientX / innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const meshes = countryMeshes.filter(c => c.isTarget).map(c => c.mesh);
  const intersects = raycaster.intersectObjects(meshes, false);

  // Reset previous hover
  if (hoveredCountry) {
    hoveredCountry.material.color.copy(hoveredCountry.originalColor);
    hoveredCountry.material.emissive.setHex(0x000000);
    hoveredCountry = null;
  }

  if (intersects.length > 0) {
    const hit = intersects[0].object;
    const entry = countryMeshes.find(c => c.mesh === hit);
    if (entry && entry.isTarget) {
      hoveredCountry = entry;
      entry.material.color.copy(HIGHLIGHT_COLOR);
      entry.material.emissive.copy(HIGHLIGHT_COLOR);
      entry.material.emissiveIntensity = 0.3;

      const data = COUNTRY_DATA[entry.iso];
      tooltipName.textContent = data.name;
      tooltipPhrase.textContent = data.phrase;
      tooltip.classList.add('visible');
      tooltip.style.left = e.clientX + 16 + 'px';
      tooltip.style.top = e.clientY - 10 + 'px';

      document.body.style.cursor = 'pointer';
    }
  } else {
    tooltip.classList.remove('visible');
    document.body.style.cursor = 'default';
  }
}

function onClick(e) {
  // We already have mouse set from move
  raycaster.setFromCamera(mouse, camera);
  const meshes = countryMeshes.filter(c => c.isTarget).map(c => c.mesh);
  const intersects = raycaster.intersectObjects(meshes, false);
  if (intersects.length > 0) {
    const entry = countryMeshes.find(c => c.mesh === intersects[0].object);
    if (entry && entry.isTarget) {
      startPlaneTravel(entry.iso);
    }
  }
}

window.addEventListener('pointermove', onPointerMove, { passive: true });
window.addEventListener('click', onClick);

/* ════════════════════════════════════════════════════════════════
   COUNTRY GLOW – pulse on target countries
   ════════════════════════════════════════════════════════════════ */
function pulseTargetCountries(time) {
  for (const entry of countryMeshes) {
    if (!entry.isTarget || entry === hoveredCountry) continue;
    const pulse = 0.03 + 0.03 * Math.sin(time * 2 + entry.iso.charCodeAt(0));
    entry.material.emissive.set(0xf5c56c);
    entry.material.emissiveIntensity = pulse;
  }
}

/* ════════════════════════════════════════════════════════════════
   RESIZE
   ════════════════════════════════════════════════════════════════ */
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* ════════════════════════════════════════════════════════════════
   RENDER LOOP
   ════════════════════════════════════════════════════════════════ */
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  controls.update();

  // Starfield twinkle
  stars.material.uniforms.time.value = t;

  // Atmosphere follows camera
  atmosphere.material.uniforms.viewVector.value.copy(camera.position);

  // Plane animation
  updatePlane();

  // Country pulse
  pulseTargetCountries(t);

  renderer.render(scene, camera);
}

/* ════════════════════════════════════════════════════════════════
   INIT
   ════════════════════════════════════════════════════════════════ */
loadGeoData().then(() => animate());

</script>
</body>
</html>`;

export default function GlobePage() {
  // This component won't render because the loader returns raw HTML,
  // but React Router requires a default export for routes.
  return null;
}
