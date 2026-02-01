// Menu Scene - Animated Three.js background for the start screen
// Features: swirling particles, glowing sphere, player model with trail, enemies

import { PulseMusic } from '../systems/pulseMusic.js';
import { ENEMY_TYPES } from '../config/enemies.js';

// Procedural Vortex Shader - creates swirling portal effect using polar coordinates
const VortexShader = {
    uniforms: {
        time: { value: 0 },
        aspect: { value: 1 },
        turns: { value: 2.8 },      // spiral turns
        tightness: { value: 10.0 }, // how fast rings compress inward
        speed: { value: 1.2 },
        core: { value: 2.2 },       // core brightness
        ringWidth: { value: 0.35 }, // overall ring thickness
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float time;
        uniform float aspect;
        uniform float turns;
        uniform float tightness;
        uniform float speed;
        uniform float core;
        uniform float ringWidth;

        varying vec2 vUv;

        // tiny hash noise (cheap)
        float hash(vec2 p) {
            p = fract(p * vec2(123.34, 345.45));
            p += dot(p, p + 34.345);
            return fract(p.x * p.y);
        }

        float smoothBand(float x, float w) {
            return smoothstep(0.5 - w, 0.5, x) * (1.0 - smoothstep(0.5, 0.5 + w, x));
        }

        void main() {
            // center UV to [-1..1], aspect-correct
            vec2 p = vUv * 2.0 - 1.0;
            p.x *= aspect;

            float r = length(p);               // radius
            float a = atan(p.y, p.x);          // angle [-pi..pi]

            // radial fade mask (keep it "portal-ish", not full-screen)
            float outer = smoothstep(1.05, 0.25, r); // fades out outside
            float inner = smoothstep(0.02, 0.18, r); // avoids hard singularity
            float mask = outer * inner;

            // swirl coordinate: angle + radius term (this is the "spiral tunnel")
            float s = a * turns + r * tightness - time * speed;

            // ring bands (two frequencies layered)
            float bands1 = 0.5 + 0.5 * sin(s * 2.0);
            float bands2 = 0.5 + 0.5 * sin(s * 4.5 + 1.2);

            // soften + make them look like luminous streaks
            float band = smoothBand(bands1, 0.18) * 0.75 + smoothBand(bands2, 0.10) * 0.45;

            // add a little "wispy" distortion so it's not perfect math stripes
            float n = hash(p * 4.0 + time * 0.05);
            band *= (0.85 + 0.30 * n);

            // color ramp: cyan core -> purple/magenta outer bands
            vec3 cyan = vec3(0.15, 0.95, 1.00);
            vec3 mag  = vec3(0.95, 0.20, 1.00);
            float t = smoothstep(0.15, 0.85, r);
            vec3 col = mix(cyan, mag, t);

            // bright rim highlight (thin cyan edge around the "tunnel opening")
            float rim = smoothstep(0.55 + ringWidth, 0.45 + ringWidth, r) - smoothstep(0.95, 0.90, r);
            col += cyan * rim * 1.2;

            // core glow (blown out center)
            float coreGlow = pow(smoothstep(0.55, 0.0, r), 2.2) * core;

            // final brightness
            float intensity = band * 1.2 + coreGlow;
            vec3 finalCol = col * intensity;

            // alpha is driven by portal mask + intensity so it blends nicely
            float alpha = mask * smoothstep(0.05, 1.2, intensity);

            gl_FragColor = vec4(finalCol, alpha);
        }
    `
};

export const MenuScene = {
    scene: null,
    camera: null,
    renderer: null,
    pickupParticles: [],  // XP gems and hearts
    sphere: null,
    sphereGlow: null,
    sphereLight: null,
    blackHole: null,      // Vortex group
    vortexPlanes: [],     // Shader-based vortex planes
    composer: null,       // Post-processing composer
    bloomPass: null,      // Bloom effect
    gridLines: [],
    verticalGridLines: [],
    menuPlayer: null,
    menuTrail: [],
    trailSpawnTimer: 0,
    trailIndex: 0,
    menuEnemies: [],
    animationId: null,
    isRunning: false,
    time: 0,
    pulseIntensity: 0,
    
    init(container) {
        // Create scene
        this.scene = new THREE.Scene();
        
        // Create camera with perspective for depth - tilted to show more grid
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 3, 12);
        this.camera.lookAt(0, 0, -2);
        
        // Create renderer with transparency
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            alpha: true 
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x000000, 0);
        
        // Add canvas to container
        this.renderer.domElement.id = 'menu-canvas';
        this.renderer.domElement.style.position = 'absolute';
        this.renderer.domElement.style.top = '0';
        this.renderer.domElement.style.left = '0';
        this.renderer.domElement.style.zIndex = '0';
        this.renderer.domElement.style.pointerEvents = 'none';
        container.insertBefore(this.renderer.domElement, container.firstChild);
        
        // Create scene elements
        this.createParticles();
        // Note: Central sphere removed - shader vortex now has built-in core glow
        this.createBlackHoleVortex();
        this.createPlayerModel();
        this.createMenuTrail();
        this.createGridFloor();
        this.createMenuEnemies();
        this.createAmbientLighting();
        
        // Set up post-processing for bloom
        this.setupPostProcessing();
        
        // Handle resize
        this.boundResize = this.onResize.bind(this);
        window.addEventListener('resize', this.boundResize);
        
        // Start animation
        this.isRunning = true;
        this.animate();
    },
    
    setupPostProcessing() {
        // Check if post-processing classes are available
        if (typeof THREE.EffectComposer === 'undefined') {
            console.warn('Post-processing not available, using basic rendering');
            return;
        }
        
        // Effect composer
        this.composer = new THREE.EffectComposer(this.renderer);
        
        // Render pass
        const renderPass = new THREE.RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);
        
        // Bloom pass for neon glow effect - tuned to avoid over-bloom on player
        this.bloomPass = new THREE.UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.6,    // strength (reduced from 1.0)
            0.4,    // radius (reduced from 0.6)
            0.4     // threshold (raised from 0.2 - only brightest things bloom)
        );
        this.composer.addPass(this.bloomPass);
    },
    
    createParticles() {
        // 50 particles total (75% reduction from 200)
        // 1% hearts = ~1 heart, rest are XP gems
        const totalCount = 50;
        const heartCount = Math.max(1, Math.floor(totalCount * 0.01)); // At least 1 heart
        const xpCount = totalCount - heartCount;
        
        // Shared geometries for performance (60% smaller than original)
        const xpGeometry = new THREE.OctahedronGeometry(0.08, 0);
        const heartSphereGeo = new THREE.SphereGeometry(0.06, 8, 8);
        const heartConeGeo = new THREE.ConeGeometry(0.08, 0.12, 8);
        
        // Create XP gems (green octahedrons)
        for (let i = 0; i < xpCount; i++) {
            const gem = new THREE.Mesh(
                xpGeometry,
                new THREE.MeshBasicMaterial({
                    color: 0x44ff44,
                    transparent: true,
                    opacity: 0.9
                })
            );
            
            // Distribute in a sphere around center
            const radius = 3 + Math.random() * 5;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            
            const baseX = radius * Math.sin(phi) * Math.cos(theta);
            const baseY = radius * Math.cos(phi);
            const baseZ = radius * Math.sin(phi) * Math.sin(theta);
            
            gem.position.set(baseX, baseY, baseZ);
            
            gem.userData = {
                type: 'xp',
                baseX, baseY, baseZ,
                speed: 0.2 + Math.random() * 0.3,
                offset: Math.random() * Math.PI * 2
            };
            
            this.pickupParticles.push(gem);
            this.scene.add(gem);
        }
        
        // Create hearts (pink, 2 spheres + inverted cone)
        for (let i = 0; i < heartCount; i++) {
            const heartGroup = new THREE.Group();
            const heartMat = new THREE.MeshBasicMaterial({
                color: 0xff4488,
                transparent: true,
                opacity: 0.9
            });
            
            const left = new THREE.Mesh(heartSphereGeo, heartMat);
            left.position.set(-0.04, 0.04, 0);
            heartGroup.add(left);
            
            const right = new THREE.Mesh(heartSphereGeo, heartMat.clone());
            right.position.set(0.04, 0.04, 0);
            heartGroup.add(right);
            
            const cone = new THREE.Mesh(heartConeGeo, heartMat.clone());
            cone.position.y = -0.04;
            cone.rotation.x = Math.PI;
            heartGroup.add(cone);
            
            // Distribute in a sphere around center
            const radius = 3 + Math.random() * 5;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            
            const baseX = radius * Math.sin(phi) * Math.cos(theta);
            const baseY = radius * Math.cos(phi);
            const baseZ = radius * Math.sin(phi) * Math.sin(theta);
            
            heartGroup.position.set(baseX, baseY, baseZ);
            
            heartGroup.userData = {
                type: 'heart',
                baseX, baseY, baseZ,
                speed: 0.15 + Math.random() * 0.2, // Hearts move a bit slower
                offset: Math.random() * Math.PI * 2
            };
            
            this.pickupParticles.push(heartGroup);
            this.scene.add(heartGroup);
        }
    },
    
    createBlackHoleVortex() {
        const vortexGroup = new THREE.Group();
        this.vortexPlanes = [];
        
        // Create helper function for vortex plane
        const createVortexPlane = (size, params = {}) => {
            const mat = new THREE.ShaderMaterial({
                uniforms: {
                    time: { value: 0 },
                    aspect: { value: 1 },
                    turns: { value: params.turns || 2.8 },
                    tightness: { value: params.tightness || 10.0 },
                    speed: { value: params.speed || 1.2 },
                    core: { value: params.core || 2.2 },
                    ringWidth: { value: params.ringWidth || 0.35 },
                },
                vertexShader: VortexShader.vertexShader,
                fragmentShader: VortexShader.fragmentShader,
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                side: THREE.DoubleSide
            });
            
            const geo = new THREE.PlaneGeometry(size, size);
            const mesh = new THREE.Mesh(geo, mat);
            return mesh;
        };
        
        // Create 3 stacked vortex planes for depth effect
        const v1 = createVortexPlane(8, { turns: 2.8, tightness: 10.0, speed: 1.2 });
        const v2 = createVortexPlane(7.5, { turns: 3.2, tightness: 11.5, speed: 1.0 });
        const v3 = createVortexPlane(7, { turns: 2.4, tightness: 9.0, speed: 1.4 });
        
        v1.position.z = -0.30;
        v2.position.z = -0.20;
        v3.position.z = -0.10;
        
        vortexGroup.add(v1, v2, v3);
        this.vortexPlanes.push(v1, v2, v3);
        
        // Position at the end of the grid (manta flies toward it)
        vortexGroup.position.set(0, 0, -18);
        vortexGroup.scale.setScalar(1.8); // Scale for visibility
        this.blackHole = vortexGroup;
        this.scene.add(vortexGroup);
    },
    
    createGridFloor() {
        // Create synthwave-style grid floor - more visible
        const gridSize = 50;
        const gridDivisions = 30;
        
        // Horizontal lines (going into distance) - cyan
        const horzMaterial = new THREE.LineBasicMaterial({ 
            color: 0x00ffff, 
            transparent: true, 
            opacity: 0.5 
        });
        
        for (let i = 0; i <= gridDivisions; i++) {
            const z = (i / gridDivisions) * gridSize - gridSize / 2;
            const geometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(-gridSize / 2, -2, z),
                new THREE.Vector3(gridSize / 2, -2, z)
            ]);
            const line = new THREE.Line(geometry, horzMaterial.clone());
            line.userData.baseZ = z;
            line.userData.isHorizontal = true;
            this.gridLines.push(line);
            this.scene.add(line);
        }
        
        // Vertical lines (perpendicular) - magenta tinted for variety
        const vertMaterial = new THREE.LineBasicMaterial({ 
            color: 0xff00ff, 
            transparent: true, 
            opacity: 0.35 
        });
        
        for (let i = 0; i <= gridDivisions; i++) {
            const x = (i / gridDivisions) * gridSize - gridSize / 2;
            const geometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(x, -2, -gridSize / 2),
                new THREE.Vector3(x, -2, gridSize / 2)
            ]);
            const line = new THREE.Line(geometry, vertMaterial.clone());
            line.userData.baseX = x;
            this.verticalGridLines.push(line);
            this.scene.add(line);
        }
    },
    
    createAmbientLighting() {
        // Ambient light for overall visibility
        const ambient = new THREE.AmbientLight(0x222233, 0.6);
        this.scene.add(ambient);
        
        // Add subtle magenta light from below
        const magentaLight = new THREE.PointLight(0xff00ff, 0.8, 25);
        magentaLight.position.set(0, -3, 0);
        this.scene.add(magentaLight);
        
        // Blue light from behind (where player is "flying from")
        const backLight = new THREE.PointLight(0x4488ff, 0.6, 30);
        backLight.position.set(0, 2, 10);
        this.scene.add(backLight);
    },
    
    createPlayerModel() {
        // Player model matching player.js style
        const playerGroup = new THREE.Group();
        
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x44aaff,
            emissive: 0x224488,
            emissiveIntensity: 0.3
        });
        
        // Body - wide flat ellipsoid (same as player.js)
        const body = new THREE.Mesh(
            new THREE.SphereGeometry(0.6, 16, 12),
            bodyMat
        );
        body.scale.set(1.5, 0.4, 1.2);
        playerGroup.add(body);
        
        // Wings (cones) - same as player.js
        const wingGeo = new THREE.ConeGeometry(0.8, 1.5, 4);
        const wingLeft = new THREE.Mesh(wingGeo, bodyMat);
        wingLeft.rotation.z = Math.PI / 2;
        wingLeft.rotation.y = -0.3;
        wingLeft.position.set(-0.8, 0, 0.1);
        playerGroup.add(wingLeft);
        
        const wingRight = new THREE.Mesh(wingGeo, bodyMat.clone());
        wingRight.rotation.z = -Math.PI / 2;
        wingRight.rotation.y = 0.3;
        wingRight.position.set(0.8, 0, 0.1);
        playerGroup.add(wingRight);
        
        // Tail
        const tail = new THREE.Mesh(
            new THREE.ConeGeometry(0.15, 0.8, 8),
            bodyMat
        );
        tail.rotation.x = Math.PI / 2;
        tail.position.set(0, 0, 0.9);
        playerGroup.add(tail);
        
        // Subtle glow effect - reduced to match in-game appearance
        // (bloom provides additional glow, so this is just a hint)
        const glow = new THREE.Mesh(
            new THREE.SphereGeometry(0.8, 16, 16),
            new THREE.MeshBasicMaterial({
                color: 0x44aaff,
                transparent: true,
                opacity: 0.08
            })
        );
        glow.scale.set(1.5, 0.5, 1.2);
        playerGroup.add(glow);
        
        // Position lower on screen, facing toward camera (flying toward black hole)
        playerGroup.position.set(0, -0.5, 4);
        playerGroup.rotation.y = Math.PI; // Face forward toward camera
        
        this.menuPlayer = playerGroup;
        this.scene.add(playerGroup);
    },
    
    createMenuTrail() {
        // Pre-create trail segments pool - matching in-game trail.js
        const trailGeom = new THREE.BoxGeometry(0.5, 0.08, 0.5);
        
        for (let i = 0; i < 40; i++) {
            const trailMat = new THREE.MeshBasicMaterial({
                color: 0x44ffff,
                transparent: true,
                opacity: 0
            });
            const segment = new THREE.Mesh(trailGeom.clone(), trailMat);
            segment.visible = false;
            segment.userData.life = 0;
            this.menuTrail.push(segment);
            this.scene.add(segment);
        }
    },
    
    spawnTrailSegment() {
        if (!this.menuPlayer) return;
        
        // Find inactive segment using round-robin
        const segment = this.menuTrail[this.trailIndex];
        this.trailIndex = (this.trailIndex + 1) % this.menuTrail.length;
        
        // Position behind player on consistent Y level (like in-game trail on ground)
        segment.position.set(
            this.menuPlayer.position.x + (Math.random() - 0.5) * 0.3,
            this.menuPlayer.position.y - 0.1,
            this.menuPlayer.position.z + 0.8 + Math.random() * 0.2
        );
        segment.userData.life = 60; // ~1 second at 60fps
        segment.visible = true;
        segment.material.opacity = 0.7;
        segment.scale.set(0.8, 1, 0.8);
    },
    
    createMenuEnemies() {
        // Create proper enemy types with visual effects
        const enemyDefs = [
            { type: 'grunt', x: -8, z: -8 },
            { type: 'shielded', x: 8, z: -6 },
            { type: 'fastBouncer', x: -6, z: 5 },
            { type: 'splitter', x: 6, z: 8 },
            { type: 'teleporter', x: -10, z: 2 }
        ];
        
        for (const def of enemyDefs) {
            const config = ENEMY_TYPES[def.type];
            if (!config) continue;
            
            const enemy = this.createEnemyMesh(def.type, config);
            const y = -1.5 + config.size * 0.7;
            enemy.position.set(def.x, y, def.z);
            
            // Store start position for idle patrol behaviors
            enemy.userData.startX = def.x;
            enemy.userData.startZ = def.z;
            
            this.menuEnemies.push(enemy);
            this.scene.add(enemy);
        }
        
        // Create Boss 1 - RED PUFFER KING
        this.createBoss1();
    },
    
    createEnemyMesh(type, config) {
        const size = config.size * 0.7;
        const group = new THREE.Group();
        
        // Main body
        const bodyMat = new THREE.MeshStandardMaterial({
            color: config.color,
            emissive: config.color,
            emissiveIntensity: config.visualProfile?.glowIntensity || 0.4
        });
        const body = new THREE.Mesh(new THREE.SphereGeometry(size, 16, 16), bodyMat);
        group.add(body);
        
        // Glow sphere
        const glowMat = new THREE.MeshBasicMaterial({
            color: config.color,
            transparent: true,
            opacity: 0.2
        });
        const glow = new THREE.Mesh(new THREE.SphereGeometry(size * 1.3, 12, 12), glowMat);
        group.add(glow);
        
        // Type-specific visuals
        if (type === 'shielded') {
            // Orbiting particles for shield effect
            group.orbitParticles = [];
            for (let i = 0; i < 3; i++) {
                const orbitMat = new THREE.MeshBasicMaterial({
                    color: config.color,
                    transparent: true,
                    opacity: 0.8
                });
                const particle = new THREE.Mesh(new THREE.SphereGeometry(size * 0.15, 8, 8), orbitMat);
                group.add(particle);
                group.orbitParticles.push(particle);
            }
            group.orbitAngle = 0;
        }
        
        // Movement data based on behavior
        const baseY = -1.5 + size;
        group.userData = {
            type: type,
            behavior: config.behavior,
            size: size,
            baseY: baseY,
            bobOffset: Math.random() * Math.PI * 2,
            // Type-specific movement
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.04,
                0,
                (Math.random() - 0.5) * 0.04
            ),
            // Teleporter-specific
            teleportTimer: type === 'teleporter' ? Math.random() * 180 : 0,
            // Splitter pulse
            pulsePhase: Math.random() * Math.PI * 2
        };
        
        return group;
    },
    
    createBoss1() {
        const boss = new THREE.Group();
        const bossSize = 1.2;
        
        // Main body - red sphere
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0xff2222,
            emissive: 0xff2222,
            emissiveIntensity: 0.5
        });
        const body = new THREE.Mesh(new THREE.SphereGeometry(bossSize, 16, 16), bodyMat);
        boss.add(body);
        
        // Glow effect
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0xff2222,
            transparent: true,
            opacity: 0.3
        });
        const glow = new THREE.Mesh(new THREE.SphereGeometry(bossSize * 1.3, 12, 12), glowMat);
        boss.add(glow);
        
        // Crown horns (5 gold cones)
        const hornMat = new THREE.MeshStandardMaterial({ 
            color: 0xffdd44,
            emissive: 0xffaa00,
            emissiveIntensity: 0.3
        });
        for (let i = 0; i < 5; i++) {
            const horn = new THREE.Mesh(
                new THREE.ConeGeometry(0.2, 0.6, 8),
                hornMat
            );
            horn.position.set((i - 2) * 0.35, bossSize + 0.2, 0);
            horn.rotation.z = (i - 2) * 0.1;
            boss.add(horn);
        }
        
        // Position boss on the grid
        boss.position.set(0, -1.5 + bossSize, -12);
        
        boss.userData = {
            type: 'boss1',
            behavior: 'boss',
            size: bossSize,
            baseY: -1.5 + bossSize,
            aiState: 'idle',
            aiTimer: 0,
            chargeTarget: new THREE.Vector3(),
            chargeSpeed: 0,
            idleAngle: 0,
            bobOffset: 0
        };
        
        this.menuEnemies.push(boss);
        this.scene.add(boss);
    },
    
    animate() {
        if (!this.isRunning) return;
        
        this.animationId = requestAnimationFrame(() => this.animate());
        this.time += 0.016; // ~60fps
        
        // Sync to music pulse
        const musicPulse = PulseMusic.getMenuPulseIntensity();
        this.pulseIntensity = this.pulseIntensity * 0.9 + musicPulse * 0.1; // Smooth it
        
        // Update pickup particles (XP gems and hearts) - orbit around center
        for (const pickup of this.pickupParticles) {
            const { baseX, baseY, baseZ, speed, offset, type } = pickup.userData;
            const angle = this.time * speed + offset;
            
            // Rotate around Y axis
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            
            pickup.position.x = baseX * cos - baseZ * sin;
            pickup.position.y = baseY + Math.sin(this.time * 0.5 + offset) * 0.3;
            pickup.position.z = baseX * sin + baseZ * cos;
            
            // Rotate the pickup itself
            pickup.rotation.y += type === 'heart' ? 0.03 : 0.05;
            if (type === 'xp') {
                pickup.rotation.x += 0.02;
            }
        }
        
        // Pulse the central sphere
        if (this.sphere) {
            const pulseScale = 1 + Math.sin(this.time * 2) * 0.1 + this.pulseIntensity * 0.2;
            this.sphere.scale.setScalar(pulseScale);
            this.sphereGlow.scale.setScalar(pulseScale * 1.5);
            
            // Modulate opacity with pulse
            const baseOpacity = 0.6 + this.pulseIntensity * 0.3;
            this.sphere.material.opacity = baseOpacity + Math.sin(this.time * 3) * 0.1;
            this.sphereGlow.material.opacity = 0.15 + Math.sin(this.time * 2) * 0.05 + this.pulseIntensity * 0.1;
            
            // Light intensity
            if (this.sphereLight) {
                this.sphereLight.intensity = 2 + Math.sin(this.time * 2) * 0.5 + this.pulseIntensity * 2;
            }
        }
        
        // Animate shader-based vortex
        if (this.vortexPlanes && this.vortexPlanes.length > 0) {
            for (const plane of this.vortexPlanes) {
                // Update time uniform for shader animation
                plane.material.uniforms.time.value = this.time;
                // Update aspect ratio in case of resize
                plane.material.uniforms.aspect.value = window.innerWidth / window.innerHeight;
            }
            
            // Subtle bob of the whole vortex group
            if (this.blackHole) {
                this.blackHole.position.y = Math.sin(this.time * 0.8) * 0.2;
                // Slight rotation for extra dynamism
                this.blackHole.rotation.z = Math.sin(this.time * 0.3) * 0.05;
            }
        }
        
        // Animate grid - scroll toward camera
        const scrollSpeed = 3;
        for (const line of this.gridLines) {
            if (line.userData.baseZ !== undefined) {
                const positions = line.geometry.attributes.position.array;
                let z = positions[2] + scrollSpeed * 0.016;
                
                // Wrap around
                if (z > 25) {
                    z -= 50;
                }
                
                positions[2] = z;
                positions[5] = z;
                line.geometry.attributes.position.needsUpdate = true;
                
                // Fade based on distance - brighter close, fades into distance
                const dist = Math.abs(z + 10);
                line.material.opacity = Math.max(0.1, 0.6 - dist * 0.012);
            }
        }
        
        // Animate player model - gentle bobbing/swaying (appears to fly forward)
        if (this.menuPlayer) {
            // Subtle bob and sway
            this.menuPlayer.position.y = -0.5 + Math.sin(this.time * 1.5) * 0.15;
            this.menuPlayer.rotation.x = Math.sin(this.time * 0.8) * 0.08;
            this.menuPlayer.rotation.z = Math.sin(this.time * 0.6) * 0.05;
            
            // Wing flap animation - children[1] and children[2] are wings
            if (this.menuPlayer.children.length >= 3) {
                const flapAngle = Math.sin(this.time * 3) * 0.2;
                this.menuPlayer.children[1].rotation.x = flapAngle;
                this.menuPlayer.children[2].rotation.x = -flapAngle;
            }
            
            // Pulse glow with music
            if (this.menuPlayer.children[4]) {
                this.menuPlayer.children[4].material.opacity = 0.12 + this.pulseIntensity * 0.15;
            }
        }
        
        // Spawn trail behind player
        this.trailSpawnTimer += 0.016;
        if (this.trailSpawnTimer > 0.04) { // Every 40ms
            this.spawnTrailSegment();
            this.trailSpawnTimer = 0;
        }
        
        // Update trail segments - move backward and fade
        for (const segment of this.menuTrail) {
            if (segment.userData.life > 0) {
                segment.userData.life--;
                segment.position.z += 0.1; // Move backward (away from camera)
                const t = segment.userData.life / 70;
                segment.material.opacity = t * 0.7;
                // Shrink as it fades
                const scale = 0.4 + t * 0.6;
                segment.scale.set(scale, scale * 0.5, scale);
                // Color shift from cyan to darker
                segment.material.color.setRGB(0.27 * t, 1 * t, 1);
                if (segment.userData.life <= 0) segment.visible = false;
            }
        }
        
        // Animate menu enemies - idle/patrol behaviors (they don't know the player is there)
        for (const enemy of this.menuEnemies) {
            const ud = enemy.userData;
            const type = ud.type;
            
            // Type-specific idle movement
            if (type === 'grunt') {
                // Wander in a small patrol pattern
                ud.wanderAngle = (ud.wanderAngle || Math.random() * Math.PI * 2) + 0.02;
                enemy.position.x = ud.startX + Math.sin(ud.wanderAngle) * 2;
                enemy.position.z = ud.startZ + Math.cos(ud.wanderAngle * 0.7) * 1.5;
            } else if (type === 'shielded') {
                // Slow patrol in a line
                ud.patrolPhase = (ud.patrolPhase || 0) + 0.008;
                enemy.position.x = ud.startX + Math.sin(ud.patrolPhase) * 3;
                
                // Animate orbiting particles (shield effect)
                if (enemy.orbitParticles) {
                    enemy.orbitAngle = (enemy.orbitAngle || 0) + 0.05;
                    for (let i = 0; i < enemy.orbitParticles.length; i++) {
                        const angle = enemy.orbitAngle + (i * Math.PI * 2 / 3);
                        const radius = ud.size * 0.8;
                        enemy.orbitParticles[i].position.x = Math.cos(angle) * radius;
                        enemy.orbitParticles[i].position.z = Math.sin(angle) * radius;
                        enemy.orbitParticles[i].position.y = Math.sin(angle * 2) * 0.1;
                    }
                }
            } else if (type === 'fastBouncer') {
                // Bounce off boundaries randomly (no homing)
                enemy.position.add(ud.velocity);
                
                // Bounce off X boundaries
                if (Math.abs(enemy.position.x) > 12) {
                    ud.velocity.x *= -1;
                    enemy.position.x = Math.sign(enemy.position.x) * 12;
                }
                // Bounce off Z boundaries
                if (enemy.position.z > 10 || enemy.position.z < -18) {
                    ud.velocity.z *= -1;
                }
                // Keep speed consistent
                const speed = ud.velocity.length();
                if (speed > 0.08) ud.velocity.multiplyScalar(0.08 / speed);
                if (speed < 0.04) ud.velocity.multiplyScalar(0.04 / speed);
            } else if (type === 'splitter') {
                // Wobble in place with pulsing
                ud.wobblePhase = (ud.wobblePhase || ud.pulsePhase) + 0.03;
                enemy.position.x = ud.startX + Math.sin(ud.wobblePhase) * 0.5;
                enemy.position.z = ud.startZ + Math.cos(ud.wobblePhase * 1.3) * 0.5;
                
                // Pulse effect (looks unstable)
                const pulse = 1 + Math.sin(this.time * 4 + ud.pulsePhase) * 0.1;
                enemy.scale.setScalar(pulse);
            } else if (type === 'teleporter') {
                // Teleport to random grid positions periodically
                ud.teleportTimer++;
                if (ud.teleportTimer > 180) {
                    ud.teleportTimer = 0;
                    // Teleport to random position on the grid
                    enemy.position.x = (Math.random() - 0.5) * 20;
                    enemy.position.z = -15 + Math.random() * 20;
                }
                // Flicker effect when about to teleport
                if (ud.teleportTimer > 150) {
                    enemy.visible = Math.floor(this.time * 20) % 2 === 0;
                } else {
                    enemy.visible = true;
                }
            } else if (type === 'boss1') {
                // Boss patrols majestically - slow figure-8 pattern
                ud.idleAngle = (ud.idleAngle || 0) + 0.008;
                enemy.position.x = Math.sin(ud.idleAngle) * 5;
                enemy.position.z = -12 + Math.sin(ud.idleAngle * 2) * 3;
            }
            
            // Common: Bob up and down
            enemy.position.y = ud.baseY + Math.sin(this.time * 2 + ud.bobOffset) * 0.15;
            
            // Common: Rotate
            enemy.rotation.y += 0.015;
        }
        
        // Subtle camera sway
        this.camera.position.x = Math.sin(this.time * 0.2) * 0.8;
        this.camera.position.y = 3 + Math.sin(this.time * 0.15) * 0.4;
        this.camera.lookAt(0, 0.3, -2);
        
        // Render with post-processing if available
        if (this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    },
    
    syncToPulse(intensity) {
        this.pulseIntensity = intensity;
    },
    
    onResize() {
        if (!this.camera || !this.renderer) return;
        
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        // Update post-processing
        if (this.composer) {
            this.composer.setSize(window.innerWidth, window.innerHeight);
        }
        if (this.bloomPass) {
            this.bloomPass.resolution.set(window.innerWidth, window.innerHeight);
        }
    },
    
    pause() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    },
    
    resume() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.animate();
        }
    },
    
    dispose() {
        this.pause();
        
        window.removeEventListener('resize', this.boundResize);
        
        // Clean up pickup particles (XP gems and hearts)
        for (const pickup of this.pickupParticles) {
            if (pickup.userData.type === 'heart') {
                // Heart is a group with children
                pickup.traverse(child => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                });
            } else {
                // XP gem is a single mesh
                pickup.geometry.dispose();
                pickup.material.dispose();
            }
        }
        
        if (this.sphere) {
            this.sphere.geometry.dispose();
            this.sphere.material.dispose();
        }
        
        if (this.sphereGlow) {
            this.sphereGlow.geometry.dispose();
            this.sphereGlow.material.dispose();
        }
        
        // Clean up black hole vortex (shader planes)
        if (this.blackHole) {
            this.blackHole.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        }
        
        // Clean up post-processing
        if (this.composer) {
            this.composer.dispose();
        }
        
        // Clean up grid lines
        for (const line of this.gridLines) {
            line.geometry.dispose();
            line.material.dispose();
        }
        for (const line of this.verticalGridLines) {
            line.geometry.dispose();
            line.material.dispose();
        }
        
        // Clean up player model
        if (this.menuPlayer) {
            this.menuPlayer.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        }
        
        // Clean up trail
        for (const segment of this.menuTrail) {
            segment.geometry.dispose();
            segment.material.dispose();
        }
        
        // Clean up menu enemies (these are Groups, not single meshes)
        for (const enemy of this.menuEnemies) {
            enemy.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        }
        
        if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.domElement && this.renderer.domElement.parentNode) {
                this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
            }
        }
        
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.pickupParticles = [];
        this.sphere = null;
        this.sphereGlow = null;
        this.blackHole = null;
        this.vortexPlanes = [];
        this.composer = null;
        this.bloomPass = null;
        this.gridLines = [];
        this.verticalGridLines = [];
        this.menuPlayer = null;
        this.menuTrail = [];
        this.menuEnemies = [];
    }
};
