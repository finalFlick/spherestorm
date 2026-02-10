// Underwater decorative and ambient assets (20 types).
// Purely visual, no collision. Placement outside 40x40 safe zone, bound-scaled.
// detailLevel preset (in UNDERWATER_ASSETS_CONFIG): low = 6 types, medium = 12, high = all.

import { scene } from '../core/scene.js';
import { UNDERWATER_ASSETS_CONFIG as C } from '../config/constants.js';
import { wobble, deformGeometry, applyMossVertexColors, getMossMask, applyVertexColorLerp } from '../utils/proceduralMesh.js';
import { Textures, applyPbr } from '../systems/textures.js';

const SAFE_ZONE_RATIO = 0.15;

// Preset: which asset categories are enabled per detail level (reduces draw calls).
const DETAIL_LEVEL_CATEGORIES = {
    low: ['coral', 'rocks', 'seaweedBeds', 'plankton', 'fog', 'scatter'],
    medium: ['coral', 'rocks', 'seaweedBeds', 'plankton', 'fog', 'scatter', 'anemones', 'ruins', 'jellyfish', 'caustics', 'treasure', 'currentRibbons', 'underwaterCity', 'bioFlowers', 'shipwreck'],
    high: null  // null = all categories allowed
};

function isCategoryEnabled(category) {
    if (!C.enabled) return false;
    const level = C.detailLevel || 'high';
    if (level === 'high' || !DETAIL_LEVEL_CATEGORIES[level]) return true;
    return DETAIL_LEVEL_CATEGORIES[level].includes(category);
}

let bound = 42;
let arenaNum = 1;
const disposed = [];

// --- Storage ---
let coralClusters = [];
let anemonePatches = [];
let rockFormations = [];
let seaweedBeds = [];
let scatterShells = null;
let scatterUrchins = null;
let scatterStarfish = null;
let ruinGroups = [];
let ventGroups = [];
let shipwreckGroup = null;
let caveGroup = null;
let grottoGroup = null;
let jellyfishPool = [];
let mantaRays = [];
let minnowMesh = null;
let minnowSchoolState = null;
let crabGroups = [];
let planktonPoints = null;
let planktonState = null;
let lightShaftMeshes = [];
let causticsPlane = null;
let currentRibbonMeshes = [];
let treasureCoinMesh = null;
let treasureChests = [];
let treasureBonePiles = [];
let citySkylineGroups = [];
let bioFlowerBeds = [];
let bubbleStreamMeshes = [];
let sharedBubbleStreamGeom = null;

let timeAccum = 0;

function safeZoneRadius() {
    return Math.max(25, bound * SAFE_ZONE_RATIO);
}

function randIn(min, max) {
    if (typeof min === 'object' && min.min != null) return min.min + Math.random() * (min.max - min.min);
    return min + Math.random() * (max - min);
}

function placeInRing(rMin, rMax) {
    const angle = Math.random() * Math.PI * 2;
    const r = rMin + Math.random() * (rMax - rMin);
    return { x: Math.cos(angle) * r, z: Math.sin(angle) * r };
}

// ---- 1. Coral ----
function initCoral() {
    if (!isCategoryEnabled('coral') || !C.coral?.enabled) return;
    const cfg = C.coral;
    const rMin = Math.max(safeZoneRadius(), cfg.placementRadiusMin * bound);
    const rMax = cfg.placementRadiusMax * bound;
    const count = Math.floor(cfg.countScale + bound / 30);
    const positions = [];
    for (let i = 0; i < count; i++) {
        const p = placeInRing(rMin, rMax);
        let ok = true;
        for (const q of positions) {
            if (Math.hypot(p.x - q.x, p.z - q.z) < (cfg.minClusterDistance || 3.5)) { ok = false; break; }
        }
        if (!ok) continue;
        positions.push(p);
        const cluster = createCoralCluster(cfg, i);
        cluster.position.set(p.x, 0, p.z);
        cluster.rotation.y = Math.random() * Math.PI * 2;
        cluster.userData.seed = i;
        scene.add(cluster);
        coralClusters.push(cluster);
        disposed.push(() => { scene.remove(cluster); cluster.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }); });
    }
}

function createCoralCluster(cfg, seed) {
    const group = new THREE.Group();
    const base = new THREE.Color(cfg.colors.base);
    const highlight = new THREE.Color(cfg.colors.highlight);

    const brainGeom = new THREE.SphereGeometry(0.4, 12, 10);
    deformGeometry(brainGeom, randIn(0.08, 0.15), seed);
    applyVertexColorLerp(brainGeom, cfg.colors.base, cfg.colors.highlight, (n, p) => Math.max(0, n.y) * 0.6 + wobble(p, 1.5, seed) * 0.25 + 0.25);
    const brainMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    group.add(new THREE.Mesh(brainGeom, brainMat));

    if (Math.random() > 0.4) {
        const fanGroup = new THREE.Group();
        for (let i = 0; i < 6; i++) {
            const blade = new THREE.BoxGeometry(0.15, 0.5, 0.02);
            const m = new THREE.MeshBasicMaterial({ vertexColors: true, color: cfg.colors.base });
            const mesh = new THREE.Mesh(blade, m);
            mesh.rotation.y = (i / 6) * Math.PI * 0.6;
            mesh.position.y = 0.25;
            fanGroup.add(mesh);
        }
        fanGroup.position.y = 0.1;
        group.add(fanGroup);
    }

    const tubeCount = 2 + Math.floor(Math.random() * 3);
    for (let t = 0; t < tubeCount; t++) {
        const h = randIn(0.3, 0.6);
        const geom = new THREE.CylinderGeometry(0.06, 0.1, h, 6);
        deformGeometry(geom, randIn(0.03, 0.06), seed + t * 7);
        applyVertexColorLerp(geom, cfg.colors.base, cfg.colors.tip, (n, p) => (p.y + h / 2) / h * 0.5 + 0.25);
        const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ vertexColors: true }));
        mesh.position.set((Math.random() - 0.5) * 0.4, h / 2, (Math.random() - 0.5) * 0.4);
        group.add(mesh);
    }
    return group;
}

function updateCoral(dt) {
    if (!isCategoryEnabled('coral') || !C.coral?.enabled) return;
    timeAccum += dt;
    coralClusters.forEach((c, i) => {
        c.rotation.y = Math.sin(timeAccum * C.coral.swaySpeed + c.userData.seed) * C.coral.swayIntensity;
    });
}

// ---- 2. Anemones ----
function initAnemones() {
    if (!isCategoryEnabled('anemones') || !C.anemones?.enabled) return;
    const cfg = C.anemones;
    const rMin = Math.max(safeZoneRadius(), cfg.placementRadiusMin * bound);
    const rMax = cfg.placementRadiusMax * bound;
    const patchCount = Math.floor(randIn(cfg.patchesMin, cfg.patchesMax));
    const positions = [];
    for (let p = 0; p < patchCount; p++) {
        const pos = placeInRing(rMin, rMax);
        let ok = true;
        for (const q of positions) {
            if (Math.hypot(pos.x - q.x, pos.z - q.z) < (cfg.minPatchDistance || 6)) { ok = false; break; }
        }
        if (!ok) continue;
        positions.push(pos);
        const patch = createAnemonePatch(cfg, p);
        patch.position.set(pos.x, 0, pos.z);
        scene.add(patch);
        anemonePatches.push(patch);
        disposed.push(() => { scene.remove(patch); patch.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }); });
    }
}

function createAnemonePatch(cfg, patchSeed) {
    const group = new THREE.Group();
    const n = randIn(cfg.anemonesPerPatch.min, cfg.anemonesPerPatch.max);
    for (let a = 0; a < n; a++) {
        const ax = (Math.random() - 0.5) * 0.8;
        const az = (Math.random() - 0.5) * 0.8;
        const baseGeom = new THREE.CylinderGeometry(cfg.baseRadius * 0.7, cfg.baseRadius * 1.2, 0.08, 8);
        deformGeometry(baseGeom, 0.02, patchSeed + a);
        const baseMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, vertexColors: true });
        const baseMesh = new THREE.Mesh(baseGeom, baseMat);
        baseMesh.position.set(ax, 0.04, az);
        group.add(baseMesh);

        const tentacleCount = cfg.tentacleCount || 11;
        for (let t = 0; t < tentacleCount; t++) {
            const angle = (t / tentacleCount) * Math.PI * 2;
            const len = randIn(cfg.tentacleLength.min, cfg.tentacleLength.max);
            const tubeGeom = new THREE.CylinderGeometry(0.02, 0.025, len, 5);
            const tubeMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.8, color: cfg.colorTip });
            const tube = new THREE.Mesh(tubeGeom, tubeMat);
            tube.position.set(ax + Math.cos(angle) * 0.08, len / 2 + 0.04, az + Math.sin(angle) * 0.08);
            tube.rotation.z = -Math.PI / 2;
            tube.userData.angle = angle;
            tube.userData.index = t;
            tube.userData.seed = patchSeed + a;
            group.add(tube);
        }
    }
    return group;
}

function updateAnemones(dt) {
    if (!isCategoryEnabled('anemones') || !C.anemones?.enabled) return;
    timeAccum += dt;
    anemonePatches.forEach(patch => {
        patch.children.forEach(c => {
            if (c.userData.index != null) {
                const sway = Math.sin(timeAccum * C.anemones.swaySpeed + c.userData.index + c.userData.seed) * C.anemones.swayIntensity;
                c.rotation.x = sway * 0.5;
                c.rotation.z = -Math.PI / 2 + sway * 0.3;
            }
        });
    });
}

// ---- 3. Rocks ----
function initRocks() {
    if (!isCategoryEnabled('rocks') || !C.rocks?.enabled) return;
    const cfg = C.rocks;
    const rMin = Math.max(safeZoneRadius(), cfg.placementRadiusMin * bound);
    const rMax = cfg.placementRadiusMax * bound;
    const count = Math.floor(randIn(cfg.countMin, cfg.countMax));
    for (let i = 0; i < count; i++) {
        const pos = placeInRing(rMin, rMax);
        const formation = createRockFormation(cfg, i);
        formation.position.set(pos.x, Math.random() * 0.05, pos.z);
        formation.rotation.y = Math.random() * Math.PI * 2;
        scene.add(formation);
        rockFormations.push(formation);
        disposed.push(() => { scene.remove(formation); formation.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }); });
    }
}

function createRockFormation(cfg, seed) {
    const group = new THREE.Group();
    const n = Math.floor(randIn(cfg.rockCountPerFormation.min, cfg.rockCountPerFormation.max));
    const stoneMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
    for (let r = 0; r < n; r++) {
        const geom = new THREE.SphereGeometry(0.6, 8, 6);
        deformGeometry(geom, randIn(cfg.deformScale.min, cfg.deformScale.max), seed + r * 13);
        applyMossVertexColors(geom, cfg.stoneColor, cfg.mossColor, seed + r);
        const mesh = new THREE.Mesh(geom, stoneMat);
        const s = randIn(0.4, 1.2);
        mesh.scale.setScalar(s);
        mesh.position.set((Math.random() - 0.5) * 0.8, 0.3 * s, (Math.random() - 0.5) * 0.8);
        mesh.rotation.set(Math.random() * 0.2, Math.random() * Math.PI * 2, Math.random() * 0.2);
        group.add(mesh);
    }
    return group;
}

// Arena 1 reef city decorative anchors: boulevard edges + district pockets + kelp streetlights.
function initReefCityDecor() {
    if (arenaNum !== 1) return;

    const boulevardSpots = [
        { x: -12, z: -30 }, { x: 12, z: -30 },
        { x: -12, z: -18 }, { x: 12, z: -18 },
        { x: -30, z: -12 }, { x: -18, z: -12 },
        { x: 18, z: -12 }, { x: 30, z: -12 },
        { x: -30, z: 12 }, { x: -18, z: 12 },
        { x: 18, z: 12 }, { x: 30, z: 12 },
        { x: -12, z: 18 }, { x: 12, z: 18 },
        { x: -12, z: 30 }, { x: 12, z: 30 }
    ];
    const districtSpots = [
        { x: -34, z: -34 }, { x: 34, z: -34 }, { x: -34, z: 34 }, { x: 34, z: 34 }
    ];

    if (isCategoryEnabled('coral') && C.coral?.enabled) {
        boulevardSpots.forEach((pos, i) => {
            const cluster = createCoralCluster(C.coral, 8200 + i);
            cluster.position.set(pos.x, 0, pos.z);
            cluster.rotation.y = Math.random() * Math.PI * 2;
            cluster.scale.setScalar(0.7 + Math.random() * 0.25);
            scene.add(cluster);
            coralClusters.push(cluster);
            disposed.push(() => {
                scene.remove(cluster);
                cluster.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
            });
        });
    }

    if (isCategoryEnabled('rocks') && C.rocks?.enabled) {
        districtSpots.forEach((pos, i) => {
            const formation = createRockFormation(C.rocks, 8300 + i);
            formation.position.set(pos.x, Math.random() * 0.05, pos.z);
            formation.rotation.y = Math.random() * Math.PI * 2;
            formation.scale.setScalar(0.7);
            scene.add(formation);
            rockFormations.push(formation);
            disposed.push(() => {
                scene.remove(formation);
                formation.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
            });
        });
    }

    // Decorative kelp streetlights (visual only).
    const poleMat = new THREE.MeshBasicMaterial({ color: 0x22664a, transparent: true, opacity: 0.75 });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0x77ffdd, transparent: true, opacity: 0.8 });
    const lightPositions = [];
    for (let z = -36; z <= 36; z += 12) {
        if (Math.abs(z) < 8) continue;
        lightPositions.push({ x: -9, z }, { x: 9, z });
    }
    for (let x = -36; x <= 36; x += 12) {
        if (Math.abs(x) < 8) continue;
        lightPositions.push({ x, z: -9 }, { x, z: 9 });
    }
    lightPositions.forEach((pos, i) => {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, 1.6, 6), poleMat.clone());
        pole.position.set(pos.x, 0.8, pos.z);
        pole.rotation.z = Math.sin(i * 0.7) * 0.08;
        scene.add(pole);
        disposed.push(() => {
            scene.remove(pole);
            pole.geometry.dispose();
            if (pole.material) pole.material.dispose();
        });

        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), bulbMat.clone());
        bulb.position.set(pos.x, 1.7, pos.z);
        scene.add(bulb);
        disposed.push(() => {
            scene.remove(bulb);
            bulb.geometry.dispose();
            bulb.material.dispose();
        });
    });
}

// ---- 4. Seaweed Beds ----
function initSeaweedBeds() {
    if (!isCategoryEnabled('seaweedBeds') || !C.seaweedBeds?.enabled) return;
    const cfg = C.seaweedBeds;
    const rMin = Math.max(safeZoneRadius(), cfg.placementRadiusMin * bound);
    const rMax = cfg.placementRadiusMax * bound;
    const bedCount = Math.floor(randIn(cfg.bedCountMin, cfg.bedCountMax));
    for (let b = 0; b < bedCount; b++) {
        const pos = placeInRing(rMin, rMax);
        const bed = createSeaweedBed(cfg, b);
        bed.position.set(pos.x, 0, pos.z);
        bed.rotation.y = Math.random() * Math.PI * 2;
        scene.add(bed);
        seaweedBeds.push(bed);
        disposed.push(() => { scene.remove(bed); bed.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }); });
    }
}

function createSeaweedBed(cfg, bedSeed) {
    const group = new THREE.Group();
    const n = cfg.bladesPerBed || 15;
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.6, color: cfg.colorBase, vertexColors: true });
    for (let i = 0; i < n; i++) {
        const h = randIn(cfg.bladeHeight.min, cfg.bladeHeight.max);
        const geom = new THREE.BoxGeometry(0.04, h, 0.02);
        const blade = new THREE.Mesh(geom, mat);
        blade.position.set((Math.random() - 0.5) * 0.6, h / 2, (Math.random() - 0.5) * 0.6);
        blade.rotation.y = (Math.random() - 0.5) * 0.5;
        blade.userData.baseZ = (Math.random() - 0.5) * 0.2;
        blade.userData.seed = bedSeed + i;
        group.add(blade);
    }
    group.userData.seed = bedSeed;
    return group;
}

function updateSeaweedBeds(dt) {
    if (!isCategoryEnabled('seaweedBeds') || !C.seaweedBeds?.enabled) return;
    timeAccum += dt;
    seaweedBeds.forEach(bed => {
        bed.children.forEach(blade => {
            blade.rotation.z = blade.userData.baseZ + Math.sin(timeAccum * C.seaweedBeds.swaySpeed + blade.userData.seed) * C.seaweedBeds.swayIntensity;
        });
    });
}

// ---- 5. Shell Scatter ----
function initScatter() {
    if (!isCategoryEnabled('scatter') || !C.scatter?.enabled) return;
    const cfg = C.scatter;
    const rMin = Math.max(safeZoneRadius(), cfg.placementRadiusMin * bound);
    const rMax = cfg.placementRadiusMax * bound;

    const shellGeom = new THREE.ConeGeometry(0.04, 0.08, 6);
    const shellMat = new THREE.MeshBasicMaterial({ color: cfg.shellColor ?? 0xeeddcc });
    const shellCount = Math.min(80, Math.floor(cfg.shellCount * (bound / 100)));
    scatterShells = new THREE.InstancedMesh(shellGeom, shellMat, shellCount);
    const shellDummy = new THREE.Object3D();
    for (let i = 0; i < shellCount; i++) {
        const pos = placeInRing(rMin, rMax);
        shellDummy.position.set(pos.x, 0.02, pos.z);
        shellDummy.rotation.set(Math.PI / 2 * (Math.random() > 0.5 ? 1 : 0), Math.random() * Math.PI * 2, 0);
        shellDummy.scale.setScalar(randIn(cfg.scale?.min ?? 0.8, cfg.scale?.max ?? 1.2));
        shellDummy.updateMatrix();
        scatterShells.setMatrixAt(i, shellDummy.matrix);
    }
    scatterShells.instanceMatrix.needsUpdate = true;
    scene.add(scatterShells);
    disposed.push(() => { scene.remove(scatterShells); scatterShells.geometry.dispose(); scatterShells.material.dispose(); scatterShells = null; });

    const urchinGeom = new THREE.SphereGeometry(0.04, 6, 4);
    const urchinMat = new THREE.MeshBasicMaterial({ color: 0x554466 });
    const urchinCount = Math.min(40, Math.floor((cfg.urchinCount || 25) * (bound / 100)));
    scatterUrchins = new THREE.InstancedMesh(urchinGeom, urchinMat, urchinCount);
    for (let i = 0; i < urchinCount; i++) {
        const pos = placeInRing(rMin, rMax);
        shellDummy.position.set(pos.x, 0.03, pos.z);
        shellDummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
        shellDummy.scale.setScalar(randIn(cfg.scale?.min ?? 0.8, cfg.scale?.max ?? 1.2));
        shellDummy.updateMatrix();
        scatterUrchins.setMatrixAt(i, shellDummy.matrix);
    }
    scatterUrchins.instanceMatrix.needsUpdate = true;
    scene.add(scatterUrchins);
    disposed.push(() => { scene.remove(scatterUrchins); scatterUrchins.geometry.dispose(); scatterUrchins.material.dispose(); scatterUrchins = null; });

    const starPoints = 5;
    const starGeom = new THREE.BufferGeometry();
    const starVerts = [];
    for (let i = 0; i < starPoints; i++) {
        const a = (i / starPoints) * Math.PI * 2 - Math.PI / 2;
        starVerts.push(0.05 * Math.cos(a), 0, 0.05 * Math.sin(a));
    }
    starVerts.push(0, 0, 0);  // center = index 5
    starGeom.setAttribute('position', new THREE.Float32BufferAttribute(starVerts, 3));
    const starIndices = [];
    for (let i = 0; i < starPoints; i++) {
        starIndices.push(i, (i + 1) % starPoints, starPoints);
    }
    starGeom.setIndex(starIndices);
    starGeom.computeVertexNormals();
    const starMat = new THREE.MeshBasicMaterial({ color: 0xcc6644, side: THREE.DoubleSide });
    const starCount = Math.min(25, Math.floor((cfg.starfishCount || 15) * (bound / 100)));
    scatterStarfish = new THREE.InstancedMesh(starGeom, starMat, starCount);
    for (let i = 0; i < starCount; i++) {
        const pos = placeInRing(rMin, rMax);
        shellDummy.position.set(pos.x, 0.01, pos.z);
        shellDummy.rotation.set(-Math.PI / 2, Math.random() * Math.PI * 2, 0);
        shellDummy.scale.setScalar(randIn(cfg.scale?.min ?? 0.8, cfg.scale?.max ?? 1.2));
        shellDummy.updateMatrix();
        scatterStarfish.setMatrixAt(i, shellDummy.matrix);
    }
    scatterStarfish.instanceMatrix.needsUpdate = true;
    scene.add(scatterStarfish);
    disposed.push(() => { scene.remove(scatterStarfish); scatterStarfish.geometry.dispose(); scatterStarfish.material.dispose(); scatterStarfish = null; });
}

// ---- 6. Ruins ----
function initRuins() {
    if (!isCategoryEnabled('ruins') || !C.ruins?.enabled) return;
    const cfg = C.ruins;
    const rMin = Math.max(safeZoneRadius(), cfg.placementRadiusMin * bound);
    const rMax = cfg.placementRadiusMax * bound;
    const count = Math.floor(randIn(cfg.ruinCount.min, cfg.ruinCount.max));
    const step = (Math.PI * 2) / Math.max(1, count);
    for (let i = 0; i < count; i++) {
        const angle = i * step + (Math.random() - 0.5) * 0.3;
        const r = rMin + Math.random() * Math.max(0, rMax - rMin);
        const group = new THREE.Group();
        group.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
        group.rotation.y = -angle;

        const pillarH = randIn(cfg.pillarHeight.min, cfg.pillarHeight.max);
        const pillarGeom = new THREE.CylinderGeometry(0.4, 0.5, pillarH, 12);
        deformGeometry(pillarGeom, 0.04, i * 17);
        applyMossVertexColors(pillarGeom, cfg.stoneColor, cfg.mossColor, i);
        const stoneMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
        const pillar = new THREE.Mesh(pillarGeom, stoneMat);
        pillar.position.y = pillarH / 2;
        group.add(pillar);

        if (Math.random() < (cfg.wallSegmentChance ?? 0.5)) {
            const wallGeom = new THREE.BoxGeometry(1.2, 0.6, 0.4);
            deformGeometry(wallGeom, 0.03, i * 19);
            applyMossVertexColors(wallGeom, cfg.stoneColor, cfg.mossColor, i + 5);
            const wall = new THREE.Mesh(wallGeom, stoneMat);
            wall.position.set(0.8, 0.3, 0);
            wall.rotation.y = Math.PI / 4;
            group.add(wall);
        }
        scene.add(group);
        ruinGroups.push(group);
        disposed.push(() => { scene.remove(group); group.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }); });
    }
}

// ---- 7. Thermal Vents ----
function initVents() {
    if (!isCategoryEnabled('vents') || !C.vents?.enabled || bound < (C.vents.minBoundForVent || 80)) return;
    const cfg = C.vents;
    const rMin = Math.max(safeZoneRadius(), cfg.placementRadiusMin * bound);
    const rMax = cfg.placementRadiusMax * bound;
    const n = bound >= 200 ? Math.min(2, cfg.maxCount) : 1;
    for (let v = 0; v < n; v++) {
        // Avoid castle quadrant (castle at -90°): place vents in [0, π] so never behind castle
        const angle = Math.random() * Math.PI;
        const r = rMin + Math.random() * Math.max(0, rMax - rMin);
        const pos = { x: Math.cos(angle) * r, z: Math.sin(angle) * r };
        const group = new THREE.Group();
        group.position.set(pos.x, 0, pos.z);

        const baseGeom = new THREE.CylinderGeometry(0.3, 0.5, 0.2, 8);
        deformGeometry(baseGeom, 0.02, v);
        const baseMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
        group.add(new THREE.Mesh(baseGeom, baseMat));

        const light = new THREE.PointLight(cfg.lightColor, randIn(cfg.lightIntensity.min, cfg.lightIntensity.max), cfg.lightDistance);
        light.position.y = 0.15;
        group.add(light);

        const particles = [];
        const plumeCount = cfg.particleCount || 30;
        for (let i = 0; i < plumeCount; i++) {
            const plane = new THREE.Mesh(
                new THREE.PlaneGeometry(0.15, 0.3),
                new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.4, color: 0xccccaa, depthWrite: false, side: THREE.DoubleSide })
            );
            plane.position.set(0, 0.1, 0);
            plane.userData.life = Math.random() * 120;
            plane.userData.maxLife = 120 + Math.random() * 120;
            plane.userData.riseSpeed = cfg.riseSpeed || 0.08;
            group.add(plane);
            particles.push(plane);
        }
        group.userData.particles = particles;
        group.userData.light = light;
        group.userData.baseIntensity = light.intensity;
        scene.add(group);
        ventGroups.push(group);
        disposed.push(() => { scene.remove(group); group.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); if (c.isPointLight) c.dispose?.(); }); });
    }
}

function updateVents(dt) {
    if (!isCategoryEnabled('vents') || !C.vents?.enabled) return;
    timeAccum += dt;
    ventGroups.forEach(group => {
        const light = group.userData.light;
        if (light) light.intensity = group.userData.baseIntensity * (0.9 + 0.1 * Math.sin(timeAccum * (C.vents.flickerSpeed || 3)));
        (group.userData.particles || []).forEach(p => {
            p.userData.life = (p.userData.life || 0) + 1;
            p.position.y += (p.userData.riseSpeed || 0.08) * dt * 60;
            const t = p.userData.life / (p.userData.maxLife || 240);
            p.material.opacity = t < 0.2 ? (t / 0.2) * 0.5 : t > 0.8 ? ((1 - t) / 0.2) * 0.5 : 0.5;
            if (p.userData.life > (p.userData.maxLife || 240)) {
                p.userData.life = 0;
                p.userData.maxLife = 120 + Math.random() * 120;
                p.position.y = 0.1;
            }
        });
    });
}

// ---- 8. Shipwreck ----
function initShipwreck() {
    if (!isCategoryEnabled('shipwreck') || !C.shipwreck?.enabled || bound < (C.shipwreck.minBound || 100)) return;
    const cfg = C.shipwreck;
    // Opposite castle (castle at -90°): place at 90° with small random offset
    const angle = Math.PI / 2 + (Math.random() - 0.5) * 0.4;
    const r = cfg.placementRadius * bound;
    shipwreckGroup = new THREE.Group();
    shipwreckGroup.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
    shipwreckGroup.rotation.y = -angle;

    const hullGeom = new THREE.CylinderGeometry(2, 2.2, 3, 16, 1, true, 0, Math.PI * 0.4);
    deformGeometry(hullGeom, 0.05, 1);
    applyVertexColorLerp(hullGeom, cfg.rustColor, cfg.mossColor, (n, p) => getMossMask(n, p, 1));
    const useWoodTex = !!Textures.woodWreck?.albedo;
    const hullMat = new THREE.MeshStandardMaterial({
        vertexColors: !useWoodTex,
        color: 0xffffff,
        roughness: 1,
        metalness: 1
    });
    if (useWoodTex) {
        applyPbr(hullMat, Textures.woodWreck, { repeatX: 3, repeatY: 3 });
    } else {
        hullMat.roughness = 0.9;
    }
    shipwreckGroup.add(new THREE.Mesh(hullGeom, hullMat));

    const mastGeom = new THREE.CylinderGeometry(0.15, 0.2, 2.5, 8);
    applyMossVertexColors(mastGeom, cfg.rustColor, cfg.mossColor, 2);
    const mast = new THREE.Mesh(mastGeom, hullMat);
    mast.rotation.x = cfg.mastAngle || Math.PI / 6;
    mast.position.set(0.8, 1.5, 0);
    shipwreckGroup.add(mast);

    const crateGeom = new THREE.BoxGeometry(0.5, 0.4, 0.35);
    deformGeometry(crateGeom, 0.02, 3);
    applyMossVertexColors(crateGeom, 0x553322, cfg.mossColor, 4);
    shipwreckGroup.add(new THREE.Mesh(crateGeom, hullMat));
    const crate2 = new THREE.Mesh(crateGeom.clone(), hullMat);
    crate2.position.set(0.3, 0, 0.5);
    shipwreckGroup.add(crate2);

    scene.add(shipwreckGroup);
    disposed.push(() => { scene.remove(shipwreckGroup); shipwreckGroup.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }); shipwreckGroup = null; });
}

// ---- 9. Cave ----
function initCave() {
    if (!isCategoryEnabled('cave') || !C.cave?.enabled) return;
    if (C.cave.arenaList && Array.isArray(C.cave.arenaList) && !C.cave.arenaList.includes(arenaNum)) return;
    const cfg = C.cave;
    const angle = cfg.placementAngle ?? Math.PI;
    const r = 0.9 * bound;
    caveGroup = new THREE.Group();
    caveGroup.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
    caveGroup.rotation.y = -angle;

    const overhangGeom = new THREE.BoxGeometry(cfg.width, cfg.height, cfg.depth);
    const overhangMat = new THREE.MeshBasicMaterial({ color: 0x0a0a12 });
    caveGroup.add(new THREE.Mesh(overhangGeom, overhangMat));

    const backGeom = new THREE.PlaneGeometry(6, 2);
    const backMat = new THREE.MeshBasicMaterial({
        color: 0x080818,
        side: THREE.DoubleSide
    });
    const back = new THREE.Mesh(backGeom, backMat);
    back.position.z = -cfg.depth / 2 - 0.1;
    caveGroup.add(back);

    scene.add(caveGroup);
    disposed.push(() => { scene.remove(caveGroup); caveGroup.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }); caveGroup = null; });
}

// ---- 10. Grotto ----
function initGrotto() {
    if (!isCategoryEnabled('grotto') || !C.grotto?.enabled || bound < (C.grotto.minBound || 80)) return;
    const cfg = C.grotto;
    const grottoRMin = Math.max(safeZoneRadius(), cfg.placementRadiusMin * bound);
    const pos = placeInRing(grottoRMin, (cfg.placementRadiusMax || 0.8) * bound);
    grottoGroup = new THREE.Group();
    grottoGroup.position.set(pos.x, 0, pos.z);

    const nodeCount = cfg.nodeCount || 5;
    const mat = new THREE.MeshBasicMaterial({ color: cfg.lightColor });
    for (let i = 0; i < nodeCount; i++) {
        const node = new THREE.Mesh(new THREE.SphereGeometry(cfg.nodeRadius, 8, 6), mat);
        node.position.set((Math.random() - 0.5) * 0.6, 0.2 + Math.random() * 0.3, (Math.random() - 0.5) * 0.6);
        node.userData.phase = i * 0.7;
        grottoGroup.add(node);
    }
    const light = new THREE.PointLight(cfg.lightColor, cfg.lightIntensityBase || 0.5, 25);
    light.position.y = 0.3;
    grottoGroup.add(light);
    grottoGroup.userData.light = light;
    grottoGroup.userData.baseIntensity = light.intensity;

    scene.add(grottoGroup);
    disposed.push(() => { scene.remove(grottoGroup); grottoGroup.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }); grottoGroup = null; });
}

function updateGrotto(dt) {
    if (!grottoGroup || !isCategoryEnabled('grotto') || !C.grotto?.enabled) return;
    timeAccum += dt;
    const pulse = C.grotto.pulseMin + (C.grotto.pulseMax - C.grotto.pulseMin) * 0.5 * (1 + Math.sin(timeAccum * (C.grotto.pulseSpeed || 1.5)));
    if (grottoGroup.userData.light) grottoGroup.userData.light.intensity = grottoGroup.userData.baseIntensity * pulse;
}

// ---- 11. Jellyfish ----
function initJellyfish() {
    if (!isCategoryEnabled('jellyfish') || !C.jellyfish?.enabled) return;
    const cfg = C.jellyfish;
    const count = Math.min(cfg.maxCount, Math.floor(3 + bound / 40));
    const rMin = Math.max(safeZoneRadius(), cfg.placementRadiusMin * bound);
    const rMax = cfg.placementRadiusMax * bound;
    for (let i = 0; i < count; i++) {
        const pos = placeInRing(rMin, rMax);
        const j = createJellyfish(cfg, i);
        j.position.set(pos.x, randIn(cfg.heightMin, cfg.heightMax), pos.z);
        j.userData.angle = Math.random() * Math.PI * 2;
        j.userData.radius = Math.hypot(pos.x, pos.z);
        j.userData.driftSpeed = cfg.driftSpeed || 0.015;
        j.userData.bobPhase = Math.random() * Math.PI * 2;
        scene.add(j);
        jellyfishPool.push(j);
        disposed.push(() => { scene.remove(j); j.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }); });
    }
}

function createJellyfish(cfg, seed) {
    const group = new THREE.Group();
    const bellGeom = new THREE.SphereGeometry(cfg.bellRadius || 0.35, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const bellMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: cfg.opacity ?? 0.55, color: cfg.color || 0xffdddd, depthWrite: false });
    group.add(new THREE.Mesh(bellGeom, bellMat));
    const tentacleCount = cfg.tentacleCount || 6;
    for (let t = 0; t < tentacleCount; t++) {
        const angle = (t / tentacleCount) * Math.PI * 2;
        const tubeGeom = new THREE.CylinderGeometry(0.02, 0.03, 0.4, 4);
        const tube = new THREE.Mesh(tubeGeom, bellMat);
        tube.position.set(Math.cos(angle) * 0.2, -0.25, Math.sin(angle) * 0.2);
        tube.userData.phase = t;
        group.add(tube);
    }
    return group;
}

function updateJellyfish(dt) {
    if (!isCategoryEnabled('jellyfish') || !C.jellyfish?.enabled) return;
    timeAccum += dt;
    jellyfishPool.forEach(j => {
        j.userData.angle += j.userData.driftSpeed;
        j.position.x = Math.cos(j.userData.angle) * j.userData.radius;
        j.position.z = Math.sin(j.userData.angle) * j.userData.radius;
        j.position.y += Math.sin(timeAccum * (C.jellyfish.bobSpeed || 0.8) + j.userData.bobPhase) * 0.02;
        j.children.forEach((c, i) => {
            if (c.userData.phase != null) {
                c.rotation.x = Math.sin(timeAccum * (C.jellyfish.tentacleSwaySpeed || 2) + c.userData.phase) * 0.2;
            }
        });
    });
}

// ---- 12. Mantas ----
function initMantas() {
    if (!isCategoryEnabled('mantas') || !C.mantas?.enabled) return;
    const cfg = C.mantas;
    const count = cfg.count || 2;
    const pathR = bound * randIn(cfg.pathRadiusMin || 1.05, cfg.pathRadiusMax || 1.15);
    for (let i = 0; i < count; i++) {
        const manta = new THREE.Mesh(
            new THREE.PlaneGeometry(1.5 * (cfg.size || 1), 0.8 * (cfg.size || 1)),
            new THREE.MeshBasicMaterial({ color: cfg.color, transparent: true, opacity: cfg.opacity ?? 0.35, side: THREE.DoubleSide })
        );
        manta.userData.angle = (i / count) * Math.PI * 2;
        manta.userData.radius = pathR;
        manta.userData.height = randIn(cfg.heightMin || 6, cfg.heightMax || 12);
        manta.userData.speed = cfg.orbitSpeed || 0.015;
        manta.position.y = manta.userData.height;
        scene.add(manta);
        mantaRays.push(manta);
        disposed.push(() => { scene.remove(manta); manta.geometry.dispose(); manta.material.dispose(); });
    }
}

function updateMantas(dt) {
    if (!isCategoryEnabled('mantas') || !C.mantas?.enabled) return;
    mantaRays.forEach(m => {
        m.userData.angle += m.userData.speed;
        m.position.x = Math.cos(m.userData.angle) * m.userData.radius;
        m.position.z = Math.sin(m.userData.angle) * m.userData.radius;
        m.rotation.y = -m.userData.angle - Math.PI / 2;
        m.rotation.z = Math.sin(m.userData.angle * 2) * (C.mantas.bankIntensity || 0.1);
    });
}

// ---- 13. Minnows ----
function initMinnows() {
    if (!isCategoryEnabled('minnows') || !C.minnows?.enabled) return;
    const cfg = C.minnows;
    const count = Math.min(150, Math.floor((cfg.instanceCount || 100) * (bound / 100)));
    const geom = new THREE.SphereGeometry(0.03, 4, 3);
    geom.scale(2.5, 1, 0.7);
    const mat = new THREE.MeshBasicMaterial({ color: cfg.color, transparent: true, opacity: cfg.opacity ?? 0.6 });
    minnowMesh = new THREE.InstancedMesh(geom, mat, count);
    minnowSchoolState = {
        angle: Math.random() * Math.PI * 2,
        radius: Math.max(safeZoneRadius(), bound * randIn(cfg.placementRadiusMin || 0.6, cfg.placementRadiusMax || 0.85)),
        height: randIn(cfg.heightMin || 3, cfg.heightMax || 8),
        speed: cfg.orbitSpeed || 0.02,
        schoolRadius: cfg.schoolRadius || 1.5,
        offsets: []
    };
    for (let i = 0; i < count; i++) {
        minnowSchoolState.offsets.push({
            x: (Math.random() - 0.5) * 2,
            z: (Math.random() - 0.5) * 2,
            phase: Math.random() * Math.PI * 2
        });
    }
    scene.add(minnowMesh);
    disposed.push(() => { scene.remove(minnowMesh); minnowMesh.geometry.dispose(); minnowMesh.material.dispose(); minnowMesh = null; minnowSchoolState = null; });
}

function updateMinnows(dt) {
    if (!minnowMesh || !minnowSchoolState || !isCategoryEnabled('minnows') || !C.minnows?.enabled) return;
    const cfg = C.minnows;
    const s = minnowSchoolState;
    s.angle += s.speed;
    const cx = Math.cos(s.angle) * s.radius;
    const cz = Math.sin(s.angle) * s.radius;
    const dummy = new THREE.Object3D();
    timeAccum += dt;
    for (let i = 0; i < minnowMesh.count; i++) {
        const o = s.offsets[i];
        const nx = o.x + Math.sin(timeAccum * 0.5 + o.phase) * 0.3;
        const nz = o.z + Math.cos(timeAccum * 0.5 + o.phase * 1.1) * 0.3;
        dummy.position.set(cx + nx, s.height, cz + nz);
        dummy.rotation.y = -s.angle - Math.PI / 2;
        dummy.updateMatrix();
        minnowMesh.setMatrixAt(i, dummy.matrix);
    }
    minnowMesh.instanceMatrix.needsUpdate = true;
}

// ---- 14. Crabs ----
function initCrabs() {
    if (!isCategoryEnabled('crabs') || !C.crabs?.enabled) return;
    const cfg = C.crabs;
    const count = Math.floor(randIn(cfg.countMin, cfg.countMax));
    const rMin = Math.max(safeZoneRadius(), cfg.placementRadiusMin * bound);
    const rMax = cfg.placementRadiusMax * bound;
    const positions = [];
    for (let i = 0; i < count; i++) {
        const pos = placeInRing(rMin, rMax);
        let ok = true;
        for (const q of positions) {
            if (Math.hypot(pos.x - q.x, pos.z - q.z) < (cfg.minCrabDistance || 3)) { ok = false; break; }
        }
        if (!ok) continue;
        positions.push(pos);
        const crab = createCrab(cfg, i);
        crab.position.set(pos.x, 0.02, pos.z);
        crab.userData.idleUntil = 0;
        crab.userData.stepDir = new THREE.Vector2(0, 0);
        scene.add(crab);
        crabGroups.push(crab);
        disposed.push(() => { scene.remove(crab); crab.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }); });
    }
}

function createCrab(cfg, seed) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.12), new THREE.MeshBasicMaterial({ color: 0x884422 }));
    group.add(body);
    const clawGeom = new THREE.ConeGeometry(0.02, 0.06, 4);
    const clawMat = new THREE.MeshBasicMaterial({ color: 0x664422 });
    const c1 = new THREE.Mesh(clawGeom, clawMat);
    c1.position.set(0.06, 0, -0.04);
    c1.rotation.z = 0.2;
    group.add(c1);
    const c2 = new THREE.Mesh(clawGeom, clawMat);
    c2.position.set(-0.06, 0, -0.04);
    c2.rotation.z = -0.2;
    group.add(c2);
    group.userData.claws = [c1, c2];
    return group;
}

function updateCrabs(dt) {
    if (!isCategoryEnabled('crabs') || !C.crabs?.enabled) return;
    timeAccum += dt;
    crabGroups.forEach(crab => {
        crab.userData.claws?.forEach((claw, i) => {
            claw.rotation.z = (i === 0 ? 0.2 : -0.2) + Math.sin(timeAccum * (C.crabs.clawSwaySpeed || 3)) * 0.1;
        });
        if (timeAccum > (crab.userData.idleUntil || 0)) {
            crab.userData.idleUntil = timeAccum + 2 + Math.random() * 2;
            const angle = Math.random() * Math.PI * 2;
            const dist = C.crabs.stepDistance || 0.08;
            crab.userData.stepDir.set(Math.cos(angle) * dist, Math.sin(angle) * dist);
            crab.userData.stepEnd = timeAccum + (C.crabs.stepDuration || 0.3);
        }
        if (crab.userData.stepEnd && timeAccum < crab.userData.stepEnd) {
            const t = (timeAccum - (crab.userData.stepEnd - (C.crabs.stepDuration || 0.3))) / (C.crabs.stepDuration || 0.3);
            crab.position.x += crab.userData.stepDir.x * (dt / 0.3);
            crab.position.z += crab.userData.stepDir.y * (dt / 0.3);
        }
    });
}

// ---- 15. Plankton ----
function initPlankton() {
    if (!isCategoryEnabled('plankton') || !C.plankton?.enabled) return;
    const cfg = C.plankton;
    const count = cfg.count || 200;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * (bound + 20);
        positions[i * 3] = Math.cos(angle) * r;
        positions[i * 3 + 1] = Math.random() * 20;
        positions[i * 3 + 2] = Math.sin(angle) * r;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
        size: cfg.size || 0.08,
        transparent: true,
        opacity: cfg.opacityBase ?? 0.15,
        color: cfg.color ?? 0xaaccdd,
        sizeAttenuation: true
    });
    planktonPoints = new THREE.Points(geom, mat);
    scene.add(planktonPoints);
    planktonState = { positions, count, driftXZ: cfg.driftSpeedXZ || 0.008, driftY: cfg.driftSpeedY ?? 0.003 };
    disposed.push(() => { scene.remove(planktonPoints); planktonPoints.geometry.dispose(); planktonPoints.material.dispose(); planktonPoints = null; planktonState = null; });
}

function updatePlankton(dt) {
    if (!planktonPoints || !planktonState || !isCategoryEnabled('plankton') || !C.plankton?.enabled) return;
    const pos = planktonState.positions;
    for (let i = 0; i < planktonState.count; i++) {
        pos[i * 3] += planktonState.driftXZ * (0.8 + Math.sin(i) * 0.4);
        pos[i * 3 + 1] += planktonState.driftY * (0.8 + Math.cos(i * 1.3) * 0.4);
        pos[i * 3 + 2] += planktonState.driftXZ * 0.5 * (0.8 + Math.sin(i * 1.7) * 0.4);
        if (pos[i * 3 + 1] > 20) pos[i * 3 + 1] -= 20;
        if (pos[i * 3 + 1] < 0) pos[i * 3 + 1] += 20;
    }
    planktonPoints.geometry.attributes.position.needsUpdate = true;
}

// ---- 16. Light Shafts ----
function initLightShafts() {
    if (!isCategoryEnabled('lightShafts') || !C.lightShafts?.enabled || bound < (C.lightShafts.minBound || 100)) return;
    const cfg = C.lightShafts;
    const count = cfg.count || 4;
    for (let i = 0; i < count; i++) {
        const geom = new THREE.CylinderGeometry(0.5, cfg.radiusTop || 8, cfg.length || 25, 8, 1, true);
        const mat = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: cfg.opacity ?? 0.06,
            side: THREE.DoubleSide,
            color: cfg.color ?? 0xffffff,
            depthWrite: false
        });
        const shaft = new THREE.Mesh(geom, mat);
        if (i === 0) {
            shaft.position.set(0, cfg.originY ?? 22, 0);
        } else {
            const a = (i / count) * Math.PI * 2;
            const r = 15 + Math.random() * 10;
            shaft.position.set(Math.cos(a) * r, (cfg.originY ?? 22) - 2, Math.sin(a) * r);
        }
        scene.add(shaft);
        lightShaftMeshes.push(shaft);
        disposed.push(() => { scene.remove(shaft); shaft.geometry.dispose(); shaft.material.dispose(); });
    }
}

// ---- 17. Caustics ----
function initCaustics() {
    if (!isCategoryEnabled('caustics') || !C.caustics?.enabled) return;
    const cfg = C.caustics;
    const size = bound * 2.2;
    const geom = new THREE.PlaneGeometry(size, size);
    const mat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: cfg.opacity ?? 0.2,
        color: 0x4488aa,
        side: THREE.DoubleSide
    });
    causticsPlane = new THREE.Mesh(geom, mat);
    causticsPlane.rotation.x = -Math.PI / 2;
    causticsPlane.position.y = 0.01;
    scene.add(causticsPlane);
    disposed.push(() => { scene.remove(causticsPlane); causticsPlane.geometry.dispose(); causticsPlane.material.dispose(); causticsPlane = null; });
}

function updateCaustics(dt) {
    if (!causticsPlane || !causticsPlane.material.map) return;
    if (!isCategoryEnabled('caustics') || !C.caustics?.enabled) return;
    const m = causticsPlane.material;
    if (m.map) {
        m.map.offset.x += (C.caustics.speedX || 0.02) * dt;
        m.map.offset.y += (C.caustics.speedY || 0.01) * dt;
    }
}

// ---- 18. Fog ----
function initFog() {
    if (!isCategoryEnabled('fog') || !C.fog?.enabled) return;
    scene.fog = new THREE.FogExp2(C.fog.color ?? 0x0a1520, C.fog.density ?? 0.012);
    disposed.push(() => { scene.fog = null; });
}

// ---- 19. Current Ribbons ----
function initCurrentRibbons() {
    if (!isCategoryEnabled('currentRibbons') || !C.currentRibbons?.enabled) return;
    const cfg = C.currentRibbons;
    const rMin = Math.max(safeZoneRadius(), cfg.placementRadiusMin * bound);
    const rMax = cfg.placementRadiusMax * bound;
    const count = cfg.count || 4;
    for (let i = 0; i < count; i++) {
        const pos = placeInRing(rMin, rMax);
        const geom = new THREE.PlaneGeometry(cfg.width || 0.3, cfg.length || 8, 1, 15);
        const mat = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: cfg.opacity ?? 0.25,
            color: cfg.color ?? 0x4488aa,
            side: THREE.DoubleSide
        });
        const ribbon = new THREE.Mesh(geom, mat);
        ribbon.position.set(pos.x, 2, pos.z);
        ribbon.rotation.x = -Math.PI / 2;
        ribbon.rotation.z = Math.random() * 0.2;
        ribbon.userData.basePositions = geom.attributes.position.array.slice();
        scene.add(ribbon);
        currentRibbonMeshes.push(ribbon);
        disposed.push(() => { scene.remove(ribbon); ribbon.geometry.dispose(); ribbon.material.dispose(); });
    }
}

function updateCurrentRibbons(dt) {
    if (!isCategoryEnabled('currentRibbons') || !C.currentRibbons?.enabled) return;
    timeAccum += dt;
    const amp = C.currentRibbons.waveAmplitude ?? 0.15;
    const speed = C.currentRibbons.waveSpeed ?? 1.5;
    currentRibbonMeshes.forEach(ribbon => {
        const pos = ribbon.geometry.attributes.position;
        const base = ribbon.userData.basePositions;
        if (!base) return;
        for (let i = 0; i < pos.count; i++) {
            const y = base[i * 3 + 1];
            pos.array[i * 3 + 1] = base[i * 3 + 1] + Math.sin(timeAccum * speed + y * 0.5) * amp;
        }
        pos.needsUpdate = true;
        ribbon.geometry.computeVertexNormals();
    });
}

// ---- 20. Treasure ----
function initTreasure() {
    if (!isCategoryEnabled('treasure') || !C.treasure?.enabled) return;
    const cfg = C.treasure;
    const rMin = Math.max(safeZoneRadius(), cfg.placementRadiusMin * bound);
    const rMax = cfg.placementRadiusMax * bound;

    const coinGeom = new THREE.CylinderGeometry(0.06, 0.06, 0.02, 12);
    const coinMat = new THREE.MeshBasicMaterial({ color: cfg.goldColor ?? 0xccaa44 });
    const coinCount = Math.min(30, Math.floor((cfg.coinCount || 25) * (bound / 100)));
    treasureCoinMesh = new THREE.InstancedMesh(coinGeom, coinMat, coinCount);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < coinCount; i++) {
        const pos = placeInRing(rMin, rMax);
        dummy.position.set(pos.x, 0.02 + Math.random() * 0.05, pos.z);
        dummy.rotation.set(Math.PI / 2 * (Math.random() > 0.5 ? 1 : 0), Math.random() * Math.PI * 2, 0);
        dummy.updateMatrix();
        treasureCoinMesh.setMatrixAt(i, dummy.matrix);
    }
    treasureCoinMesh.instanceMatrix.needsUpdate = true;
    scene.add(treasureCoinMesh);
    disposed.push(() => { scene.remove(treasureCoinMesh); treasureCoinMesh.geometry.dispose(); treasureCoinMesh.material.dispose(); treasureCoinMesh = null; });

    for (let c = 0; c < (cfg.chestCount || 1); c++) {
        const chestRMin = Math.max(safeZoneRadius() * 0.9, rMin * 0.9);
        const pos = placeInRing(chestRMin, rMax * 0.9);
        const chest = new THREE.Mesh(
            new THREE.BoxGeometry(0.4, 0.3, 0.25),
            new THREE.MeshBasicMaterial({ color: cfg.chestColor ?? 0x553322 })
        );
        chest.position.set(pos.x, 0.15, pos.z);
        chest.rotation.y = Math.random() * Math.PI * 2;
        scene.add(chest);
        treasureChests.push(chest);
        disposed.push(() => { scene.remove(chest); chest.geometry.dispose(); chest.material.dispose(); });
    }

    const pileCount = cfg.bonePileCount || 3;
    for (let p = 0; p < pileCount; p++) {
        const pos = placeInRing(rMin, rMax);
        const group = new THREE.Group();
        group.position.set(pos.x, 0, pos.z);
        const bonesPerPile = cfg.bonesPerPile || 3;
        const boneMat = new THREE.MeshBasicMaterial({ color: cfg.boneColor ?? 0xddccbb });
        for (let b = 0; b < bonesPerPile; b++) {
            const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6), boneMat);
            bone.position.set((Math.random() - 0.5) * 0.2, 0.1, (Math.random() - 0.5) * 0.2);
            bone.rotation.z = (Math.random() - 0.5) * 0.5;
            group.add(bone);
        }
        scene.add(group);
        treasureBonePiles.push(group);
        disposed.push(() => { scene.remove(group); group.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }); });
    }
}

// ---- 21. Underwater City Skyline (Arena 1) ----
function initUnderwaterCity() {
    if (!isCategoryEnabled('underwaterCity') || !C.underwaterCity?.enabled) return;
    const cfg = C.underwaterCity;
    if (cfg.arenaList && Array.isArray(cfg.arenaList) && !cfg.arenaList.includes(arenaNum)) return;
    if (bound < (cfg.minBound || 100)) return;

    const rMin = cfg.placementRadiusMin * bound;
    const rMax = cfg.placementRadiusMax * bound;
    const podCount = Math.min(cfg.podCount || 6, 12);
    const windowCountPerPod = Math.max(2, Math.floor((cfg.windowCount || 48) / podCount));
    const maxLights = Math.min(cfg.maxPointLights || 4, 6);
    const podColor = cfg.podColor ?? 0x1a3545;
    const windowColor = cfg.windowColor ?? 0xffcc66;

    let lightsAdded = 0;

    for (let i = 0; i < podCount; i++) {
        // Forward-biased arc (camera looks toward -Z): place pods in back half
        const angle = Math.PI * 1.5 + (Math.random() - 0.5) * Math.PI * 0.9;
        const r = rMin + Math.random() * (rMax - rMin);
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;

        const group = new THREE.Group();
        group.position.set(x, 0, z);
        group.rotation.y = -angle;
        group.userData.seed = i;
        group.userData.phase = Math.random() * Math.PI * 2;

        // Pod silhouette: dome (sphere segment) + short pylon
        const podScale = 2 + Math.random() * 3;
        const domeGeom = new THREE.SphereGeometry(podScale * 0.6, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
        const domeMat = new THREE.MeshBasicMaterial({ color: podColor });
        const dome = new THREE.Mesh(domeGeom, domeMat);
        dome.position.y = podScale * 0.35;
        group.add(dome);

        const pylonGeom = new THREE.CylinderGeometry(podScale * 0.2, podScale * 0.3, podScale * 0.4, 10);
        const pylonMat = new THREE.MeshBasicMaterial({ color: podColor });
        const pylon = new THREE.Mesh(pylonGeom, pylonMat);
        pylon.position.y = podScale * 0.2;
        group.add(pylon);

        // Instanced windows (warm yellow, additive for bloom/fallback)
        const windowGeom = new THREE.CircleGeometry(0.25, 8);
        const windowMat = new THREE.MeshBasicMaterial({
            color: windowColor,
            transparent: true,
            opacity: 0.95,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        const windowMesh = new THREE.InstancedMesh(windowGeom, windowMat, windowCountPerPod);
        const dummy = new THREE.Object3D();
        for (let w = 0; w < windowCountPerPod; w++) {
            const phi = Math.random() * Math.PI * 0.4 + 0.1;
            const theta = Math.random() * Math.PI * 2;
            const wy = podScale * 0.3 + Math.sin(phi) * podScale * 0.5;
            const wx = Math.cos(theta) * Math.sin(phi) * podScale * 0.5;
            const wz = Math.sin(theta) * Math.sin(phi) * podScale * 0.5;
            dummy.position.set(wx, wy, wz);
            dummy.lookAt(dummy.position.x + 1, dummy.position.y, dummy.position.z);
            dummy.updateMatrix();
            windowMesh.setMatrixAt(w, dummy.matrix);
        }
        windowMesh.instanceMatrix.needsUpdate = true;
        windowMesh.position.y = 0;
        group.add(windowMesh);
        group.userData.windowMesh = windowMesh;

        if (lightsAdded < maxLights) {
            const light = new THREE.PointLight(windowColor, 0.5, 25);
            light.position.set(0, podScale * 0.5, 0);
            group.add(light);
            group.userData.light = light;
            group.userData.baseIntensity = 0.5;
            lightsAdded++;
        }

        scene.add(group);
        citySkylineGroups.push(group);
        disposed.push(() => {
            scene.remove(group);
            group.traverse(c => {
                if (c.geometry) c.geometry.dispose();
                if (c.material) c.material.dispose();
            });
            if (group.userData.light && group.userData.light.dispose) group.userData.light.dispose();
        });
    }
}

function updateUnderwaterCity(dt) {
    if (!isCategoryEnabled('underwaterCity') || !C.underwaterCity?.enabled || citySkylineGroups.length === 0) return;
    const cfg = C.underwaterCity;
    timeAccum += dt || 0;
    const pulse = (cfg.pulseMin ?? 0.85) + ((cfg.pulseMax ?? 1) - (cfg.pulseMin ?? 0.85)) * 0.5 * (1 + Math.sin(timeAccum * (cfg.pulseSpeed ?? 0.8)));
    citySkylineGroups.forEach(g => {
        if (g.userData.light) g.userData.light.intensity = (g.userData.baseIntensity ?? 0.5) * pulse;
        g.rotation.z = Math.sin(timeAccum * 0.3 + g.userData.phase) * 0.02;
    });
}

// ---- 22. Bioluminescent Flowers + Localized Bubble Streams ----
function initBioFlowers() {
    if (!isCategoryEnabled('bioFlowers') || !C.bioFlowers?.enabled) return;
    const cfg = C.bioFlowers;
    if (cfg.arenaList && Array.isArray(cfg.arenaList) && !cfg.arenaList.includes(arenaNum)) return;
    if (bound < (cfg.minBound || 80)) return;

    const rMin = Math.max(safeZoneRadius(), cfg.placementRadiusMin * bound);
    const rMax = cfg.placementRadiusMax * bound;
    const bedCount = Math.floor(randIn(cfg.bedCountMin ?? 4, cfg.bedCountMax ?? 10));
    const colors = cfg.petalColors ?? [0xff8844, 0xffaa66, 0xaacc66];
    const stemsPerBed = cfg.stemsPerBed ?? 8;

    for (let b = 0; b < bedCount; b++) {
        const pos = placeInRing(rMin, rMax);
        const group = new THREE.Group();
        group.position.set(pos.x, 0, pos.z);
        group.userData.seed = b;
        group.userData.swayPhase = Math.random() * Math.PI * 2;

        for (let s = 0; s < stemsPerBed; s++) {
            const sx = (Math.random() - 0.5) * 1.2;
            const sz = (Math.random() - 0.5) * 1.2;
            const stemH = 0.15 + Math.random() * 0.2;
            const stemGeom = new THREE.CylinderGeometry(0.02, 0.03, stemH, 6);
            const stemMat = new THREE.MeshBasicMaterial({ color: 0x224422 });
            const stem = new THREE.Mesh(stemGeom, stemMat);
            stem.position.set(sx, stemH / 2, sz);
            group.add(stem);

            const petalColor = colors[Math.floor(Math.random() * colors.length)];
            const emissive = randIn(cfg.emissiveIntensity?.min ?? 0.4, cfg.emissiveIntensity?.max ?? 0.8);
            const petalGeom = new THREE.SphereGeometry(0.06, 6, 6);
            const petalMat = new THREE.MeshBasicMaterial({
                color: petalColor,
                transparent: true,
                opacity: 0.9
            });
            if (petalMat.emissive) {
                petalMat.emissive = new THREE.Color(petalColor);
                petalMat.emissiveIntensity = emissive;
            }
            const petal = new THREE.Mesh(petalGeom, petalMat);
            petal.position.set(sx, stemH + 0.02, sz);
            petal.userData.phase = s * 0.7;
            group.add(petal);
        }

        scene.add(group);
        bioFlowerBeds.push(group);
        disposed.push(() => {
            scene.remove(group);
            group.traverse(c => {
                if (c.geometry) c.geometry.dispose();
                if (c.material) c.material.dispose();
            });
        });
    }

    // Localized bubble streams (2-3 groups of rising spheres near outer ring)
    const streamCount = 3;
    const bubblesPerStream = 5;
    if (!sharedBubbleStreamGeom) sharedBubbleStreamGeom = new THREE.SphereGeometry(0.08, 6, 6);
    for (let t = 0; t < streamCount; t++) {
        const pos = placeInRing(rMin * 0.95, rMax * 1.02);
        const streamGroup = new THREE.Group();
        streamGroup.position.set(pos.x, 0, pos.z);
        const bubbles = [];
        for (let i = 0; i < bubblesPerStream; i++) {
            const bubbleMat = new THREE.MeshBasicMaterial({
                color: 0x88ddff,
                transparent: true,
                opacity: 0.5,
                depthWrite: false
            });
            const bubble = new THREE.Mesh(sharedBubbleStreamGeom, bubbleMat);
            bubble.position.y = (i / bubblesPerStream) * 2.5;
            bubble.userData.riseSpeed = 0.25 + Math.random() * 0.15;
            streamGroup.add(bubble);
            bubbles.push(bubble);
        }
        streamGroup.userData.bubbles = bubbles;
        streamGroup.userData.topY = 4;
        scene.add(streamGroup);
        bubbleStreamMeshes.push(streamGroup);
        disposed.push(() => {
            scene.remove(streamGroup);
            streamGroup.traverse(c => {
                if (c.material) c.material.dispose();
            });
        });
    }
    disposed.push(() => {
        if (sharedBubbleStreamGeom) {
            sharedBubbleStreamGeom.dispose();
            sharedBubbleStreamGeom = null;
        }
    });
}

function updateBioFlowers(dt) {
    if (!isCategoryEnabled('bioFlowers') || !C.bioFlowers?.enabled) return;
    const cfg = C.bioFlowers;
    timeAccum += dt || 0;
    const sway = cfg.swayIntensity ?? 0.12;
    const speed = cfg.swaySpeed ?? 1.2;
    bioFlowerBeds.forEach(bed => {
        bed.rotation.z = Math.sin(timeAccum * speed + bed.userData.swayPhase) * sway;
    });
    const sec = (dt || 16) / 1000;
    bubbleStreamMeshes.forEach(stream => {
        stream.userData.bubbles.forEach(b => {
            b.position.y += b.userData.riseSpeed * sec;
            if (b.position.y > stream.userData.topY) b.position.y -= stream.userData.topY + 0.5;
        });
    });
}

// ---- Public API ----

export function initUnderwaterAssets(arenaBound, arenaNumber) {
    if (!C.enabled) return;
    bound = typeof arenaBound === 'number' ? arenaBound : 42;
    arenaNum = typeof arenaNumber === 'number' ? arenaNumber : 1;
    cleanupUnderwaterAssets();

    initCoral();
    initAnemones();
    initRocks();
    if (arenaNum === 1) {
        initReefCityDecor();
    }
    initSeaweedBeds();
    initScatter();
    initRuins();
    initVents();
    initShipwreck();
    initCave();
    initGrotto();
    initJellyfish();
    initMantas();
    initMinnows();
    initCrabs();
    initPlankton();
    initLightShafts();
    initCaustics();
    initFog();
    initCurrentRibbons();
    initTreasure();
    initUnderwaterCity();
    initBioFlowers();

    timeAccum = 0;
}

export function cleanupUnderwaterAssets() {
    while (disposed.length) {
        const fn = disposed.pop();
        try { fn(); } catch (_) {}
    }
    coralClusters = [];
    anemonePatches = [];
    rockFormations = [];
    seaweedBeds = [];
    scatterShells = null;
    scatterUrchins = null;
    scatterStarfish = null;
    ruinGroups = [];
    ventGroups = [];
    shipwreckGroup = null;
    caveGroup = null;
    grottoGroup = null;
    jellyfishPool = [];
    mantaRays = [];
    minnowMesh = null;
    minnowSchoolState = null;
    crabGroups = [];
    planktonPoints = null;
    planktonState = null;
    lightShaftMeshes = [];
    causticsPlane = null;
    currentRibbonMeshes = [];
    treasureCoinMesh = null;
    treasureChests = [];
    treasureBonePiles = [];
    citySkylineGroups = [];
    bioFlowerBeds = [];
    bubbleStreamMeshes = [];
}

export function updateUnderwaterAssets(dt) {
    if (!C.enabled) return;
    const sec = (dt || 0) / 1000;
    updateCoral(sec);
    updateAnemones(sec);
    updateSeaweedBeds(sec);
    updateVents(sec);
    updateGrotto(sec);
    updateJellyfish(sec);
    updateMantas(sec);
    updateMinnows(sec);
    updateCrabs(sec);
    updatePlankton(sec);
    updateCaustics(sec);
    updateCurrentRibbons(sec);
    updateUnderwaterCity(sec);
    updateBioFlowers(sec);
}
