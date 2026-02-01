import { scene } from '../core/scene.js';
import { gameState } from '../core/gameState.js';
import { enemies, obstacles, hazardZones, tempVec3, getCurrentBoss, setCurrentBoss } from '../core/entities.js';
import { player } from './player.js';
import { spawnSpecificEnemy, spawnSplitEnemy } from './enemies.js';
import { BOSS_CONFIG, ABILITY_COOLDOWNS, ABILITY_TELLS } from '../config/bosses.js';
import { DAMAGE_COOLDOWN, HEART_HEAL, BOSS_STUCK_THRESHOLD, BOSS_STUCK_FRAMES, PHASE_TRANSITION_DELAY_FRAMES, GAME_TITLE } from '../config/constants.js';
import { spawnParticle, spawnShieldBreakVFX, spawnBubbleParticle } from '../effects/particles.js';
import { spawnXpGem, spawnHeart, spawnArenaPortal } from '../systems/pickups.js';
import { createHazardZone } from '../arena/generator.js';
import { takeDamage, lastDamageTime, setLastDamageTime } from '../systems/damage.js';
import { showBossHealthBar, updateBossHealthBar, hideBossHealthBar, showExposedBanner, showPhaseAnnouncement, showBoss6CycleAnnouncement, updateBoss6CycleIndicator, hideBoss6CycleIndicator, showTutorialCallout, showChainIndicator, hideChainIndicator, showBoss6SequencePreview, hideBoss6SequencePreview } from '../ui/hud.js';
import { markBossEncountered } from '../ui/rosterUI.js';
import { createShieldBubble, createExposedVFX, updateExposedVFX, cleanupVFX, createSlamMarker, updateSlamMarker, createTeleportOriginVFX, createTeleportDestinationVFX, updateTeleportDestinationVFX, createEmergeWarningVFX, updateEmergeWarningVFX, createBurrowStartVFX, updateBurrowStartVFX, triggerSlowMo, triggerScreenFlash, createChargePathMarker, updateChargePathMarker, createHazardPreviewCircle, updateHazardPreviewCircle, createLaneWallPreview, updateLaneWallPreview, createPerchChargeVFX, updatePerchChargeVFX, createGrowthIndicator, updateGrowthIndicator, createSplitWarningVFX, updateSplitWarningVFX, createComboTether, updateComboTether, createComboLockInMarker, updateComboLockInMarker, createMinionTether, updateMinionTethers, createTetherSnapVFX, updateTetherSnapVFX, createChargeTrailSegment, updateChargeTrailSegment, createDetonationWarningVFX, updateDetonationWarningVFX, createTeleportDecoy, updateTeleportDecoy, createBlinkBarrageMarker, updateBlinkBarrageMarker, createVineZone, updateVineZone, createBurrowPath, updateBurrowPath, createFakeEmergeMarker, updateFakeEmergeMarker, createEnergyTransferVFX } from '../systems/visualFeedback.js';
import { PulseMusic } from '../systems/pulseMusic.js';

// Anti-stuck detection uses BOSS_STUCK_THRESHOLD and BOSS_STUCK_FRAMES from constants.js

// ==================== PORCUPINEFISH MESH (Boss 1) ====================
// Creates a porcupinefish-style mesh with body, spines, and eyes
// Supports inflation state: 0 = deflated (streamlined swimmer), 1 = inflated (armored orb)

function createPorcupinefishMesh(size, color) {
    const group = new THREE.Group();
    
    // Main body - sphere that will be scaled for inflation states
    const bodyGeom = new THREE.SphereGeometry(size, 24, 24);
    const bodyMat = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.5
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.castShadow = true;
    body.name = 'pufferBody';
    group.add(body);
    
    // Glow effect
    const glowGeom = new THREE.SphereGeometry(size * 1.15, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.25
    });
    const glow = new THREE.Mesh(glowGeom, glowMat);
    glow.name = 'pufferGlow';
    group.add(glow);
    
    // Eyes - two small spheres on the front
    const eyeGeom = new THREE.SphereGeometry(size * 0.15, 12, 12);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilGeom = new THREE.SphereGeometry(size * 0.08, 8, 8);
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    
    // Left eye
    const leftEye = new THREE.Group();
    const leftEyeWhite = new THREE.Mesh(eyeGeom, eyeMat);
    const leftPupil = new THREE.Mesh(pupilGeom, pupilMat);
    leftPupil.position.z = size * 0.08;
    leftEye.add(leftEyeWhite);
    leftEye.add(leftPupil);
    leftEye.position.set(-size * 0.4, size * 0.3, size * 0.75);
    leftEye.name = 'leftEye';
    group.add(leftEye);
    
    // Right eye
    const rightEye = new THREE.Group();
    const rightEyeWhite = new THREE.Mesh(eyeGeom, eyeMat.clone());
    const rightPupil = new THREE.Mesh(pupilGeom, pupilMat.clone());
    rightPupil.position.z = size * 0.08;
    rightEye.add(rightEyeWhite);
    rightEye.add(rightPupil);
    rightEye.position.set(size * 0.4, size * 0.3, size * 0.75);
    rightEye.name = 'rightEye';
    group.add(rightEye);
    
    // Mouth - small dark ellipse
    const mouthGeom = new THREE.SphereGeometry(size * 0.12, 8, 8);
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x331111 });
    const mouth = new THREE.Mesh(mouthGeom, mouthMat);
    mouth.scale.set(1.5, 0.6, 0.5);
    mouth.position.set(0, -size * 0.1, size * 0.9);
    mouth.name = 'mouth';
    group.add(mouth);
    
    // Tail fin - small cone at the back
    const tailGeom = new THREE.ConeGeometry(size * 0.3, size * 0.6, 4);
    const tailMat = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.3
    });
    const tail = new THREE.Mesh(tailGeom, tailMat);
    tail.rotation.x = Math.PI / 2;
    tail.position.set(0, 0, -size * 1.1);
    tail.name = 'tail';
    group.add(tail);
    
    // Side fins - small triangular planes
    const finGeom = new THREE.ConeGeometry(size * 0.25, size * 0.5, 3);
    const finMat = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.3,
        side: THREE.DoubleSide
    });
    
    const leftFin = new THREE.Mesh(finGeom, finMat);
    leftFin.rotation.z = Math.PI / 2;
    leftFin.rotation.y = -0.3;
    leftFin.position.set(-size * 0.9, 0, size * 0.2);
    leftFin.name = 'leftFin';
    group.add(leftFin);
    
    const rightFin = new THREE.Mesh(finGeom, finMat.clone());
    rightFin.rotation.z = -Math.PI / 2;
    rightFin.rotation.y = 0.3;
    rightFin.position.set(size * 0.9, 0, size * 0.2);
    rightFin.name = 'rightFin';
    group.add(rightFin);
    
    // Spines - distributed using icosahedron vertices for even distribution
    // Create 20 spines (icosahedron has 12 vertices, but we use more for coverage)
    const spineGroup = new THREE.Group();
    spineGroup.name = 'spines';
    
    const spineGeom = new THREE.ConeGeometry(size * 0.08, size * 0.5, 4);
    const spineMat = new THREE.MeshStandardMaterial({
        color: 0xffaa44,  // Orange-yellow spines
        emissive: 0xff6600,
        emissiveIntensity: 0.3
    });
    
    // Generate spine positions using golden spiral for even distribution
    const spineCount = 24;
    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    
    for (let i = 0; i < spineCount; i++) {
        const spine = new THREE.Mesh(spineGeom, spineMat.clone());
        
        // Golden spiral distribution on sphere
        const theta = 2 * Math.PI * i / goldenRatio;
        const phi = Math.acos(1 - 2 * (i + 0.5) / spineCount);
        
        // Position on unit sphere
        const x = Math.sin(phi) * Math.cos(theta);
        const y = Math.sin(phi) * Math.sin(theta);
        const z = Math.cos(phi);
        
        // Place spine at surface
        spine.position.set(x * size, y * size, z * size);
        
        // Point outward from center
        spine.lookAt(spine.position.clone().multiplyScalar(2));
        spine.rotateX(Math.PI / 2);  // Cone points outward
        
        // Store base scale for animation
        spine.userData.baseScale = 1.0;
        spine.userData.index = i;
        
        // Start hidden (deflated state)
        spine.scale.set(0.1, 0.1, 0.1);
        spine.visible = false;
        
        spineGroup.add(spine);
    }
    
    group.add(spineGroup);
    
    // Dorsal fin (top ridge) - visible in deflated state
    const dorsalGeom = new THREE.ConeGeometry(size * 0.15, size * 0.4, 3);
    const dorsalMat = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.4
    });
    
    const dorsalGroup = new THREE.Group();
    dorsalGroup.name = 'dorsalFin';
    for (let i = 0; i < 3; i++) {
        const dorsal = new THREE.Mesh(dorsalGeom, dorsalMat.clone());
        dorsal.position.set(0, size * 0.8, -size * 0.3 + i * size * 0.3);
        dorsal.scale.set(1, 1 - i * 0.2, 1);
        dorsalGroup.add(dorsal);
    }
    group.add(dorsalGroup);
    
    // Store references for easy access
    group.pufferBody = body;
    group.pufferBodyMat = bodyMat;
    group.pufferGlow = glow;
    group.pufferSpines = spineGroup;
    group.pufferEyes = [leftEye, rightEye];
    group.pufferTail = tail;
    group.pufferFins = [leftFin, rightFin];
    group.pufferDorsal = dorsalGroup;
    
    return group;
}

// Update porcupinefish inflation visuals
// inflationState: -0.3 to 1.0 (negative = extra deflated for charge blast)
// -0.3 = blast deflation, 0 = normal deflated, 1 = fully inflated
function updatePorcupinefishInflation(boss, deltaInflation) {
    if (!boss.isPorcupinefish) return;
    
    const inflation = boss.inflationState;
    const body = boss.pufferBody;
    const glow = boss.pufferGlow;
    const spines = boss.pufferSpines;
    const dorsal = boss.pufferDorsal;
    const tail = boss.pufferTail;
    const fins = boss.pufferFins;
    
    if (!body || !spines) return;
    
    // Clamp inflation for shape calculations (negative handled separately for scale)
    const shapeInflation = Math.max(0, inflation);
    
    // OVERALL SIZE SCALING - dramatic size change
    // Blast (-0.3): 0.7x, Deflated (0): 0.85x, Inflated (1): 1.3x
    const overallScale = 0.85 + inflation * 0.45;
    boss.scale.setScalar(Math.max(0.7, overallScale));
    
    // Body shape: deflated = elongated ellipsoid, inflated = sphere
    // Deflated: (1.3, 0.75, 1.0), Inflated: (1.0, 1.0, 1.0)
    const scaleX = 1.0 + (1 - shapeInflation) * 0.3;
    const scaleY = 0.75 + shapeInflation * 0.25;
    const scaleZ = 1.0;
    body.scale.set(scaleX, scaleY, scaleZ);
    
    // Glow follows body
    if (glow) {
        glow.scale.set(scaleX, scaleY, scaleZ);
    }
    
    // Spines: hidden when deflated, visible when inflated
    spines.children.forEach((spine, i) => {
        // Stagger spine appearance for nice effect (use shapeInflation for visibility)
        const staggeredInflation = Math.max(0, Math.min(1, shapeInflation * 1.5 - (i / spines.children.length) * 0.5));
        
        spine.visible = staggeredInflation > 0.1;
        spine.scale.setScalar(0.1 + staggeredInflation * 0.9);
        
        // Spines get more orange/red when fully inflated (aggressive)
        if (spine.material && boss.phase >= 3) {
            spine.material.emissive.setHex(0xff4400);
            spine.material.emissiveIntensity = 0.5 + shapeInflation * 0.3;
        }
    });
    
    // Dorsal fin: visible when deflated, hidden when inflated
    if (dorsal) {
        const dorsalScale = 1 - shapeInflation * 0.7;
        dorsal.scale.setScalar(dorsalScale);
        dorsal.visible = shapeInflation < 0.8;
    }
    
    // Tail: larger when deflated (propulsion), smaller when inflated
    if (tail) {
        const tailScale = 1.0 - shapeInflation * 0.4;
        tail.scale.set(tailScale, tailScale, tailScale);
    }
    
    // Side fins: more prominent when deflated
    if (fins) {
        fins.forEach(fin => {
            const finScale = 1.0 - shapeInflation * 0.5;
            fin.scale.setScalar(finScale);
        });
    }
    
    // Body color/emissive: brighter when deflated, dimmer when inflated (energy to shield)
    if (boss.pufferBodyMat) {
        boss.pufferBodyMat.emissiveIntensity = 0.6 - shapeInflation * 0.2;
    }
}

// Animate spines (rotation, pulsing)
function animatePorcupinefishSpines(boss, deltaTime) {
    if (!boss.isPorcupinefish || !boss.pufferSpines) return;
    
    const spines = boss.pufferSpines;
    const time = Date.now() * 0.001;
    
    // Only animate when inflated
    if (boss.inflationState < 0.5) return;
    
    // Phase 2: Slow rotation
    // Phase 3: Faster rotation + pulsing
    const rotSpeed = boss.phase >= 3 ? 0.015 : 0.005;
    spines.rotation.y += rotSpeed;
    
    // Pulse spines slightly
    if (boss.phase >= 3) {
        spines.children.forEach((spine, i) => {
            const pulse = 1 + Math.sin(time * 4 + i * 0.5) * 0.1;
            const baseScale = 0.1 + boss.inflationState * 0.9;
            spine.scale.setScalar(baseScale * pulse);
        });
    }
}

// Bristle effect when entering inflated state
function triggerSpineBristle(boss) {
    if (!boss.isPorcupinefish || !boss.pufferSpines) return;
    
    boss.spineBristleTimer = 20;  // frames
    boss.spineBristleScale = 1.4;  // overshoot scale
}

// Update bristle animation
function updateSpineBristle(boss) {
    if (!boss.spineBristleTimer || boss.spineBristleTimer <= 0) return;
    
    boss.spineBristleTimer--;
    
    const progress = boss.spineBristleTimer / 20;
    const bristleScale = 1 + (boss.spineBristleScale - 1) * progress;
    
    if (boss.pufferSpines) {
        boss.pufferSpines.children.forEach(spine => {
            const baseScale = 0.1 + boss.inflationState * 0.9;
            spine.scale.setScalar(baseScale * bristleScale);
        });
    }
}

// Reset porcupinefish visuals after charge ends (cleanup wiggle, etc.)
function resetPufferVisuals(boss) {
    if (!boss.isPorcupinefish || !boss.pufferBase) return;
    
    // Reset body rotation to base
    if (boss.pufferBody && boss.pufferBase.bodyRot) {
        boss.pufferBody.rotation.copy(boss.pufferBase.bodyRot);
    }
    // Reset tail scale to base
    if (boss.pufferTail && boss.pufferBase.tailScale) {
        boss.pufferTail.scale.copy(boss.pufferBase.tailScale);
    }
    
    // Reset animation state
    boss.wigglePhase = 0;
    boss.chargeDirLocked = false;
    boss.inflationSpeed = 0.05;  // Back to normal lerp speed
    
    // Reset body material color to base
    if (boss.bodyMaterial) {
        boss.bodyMaterial.emissive.setHex(boss.baseColor);
    }
}

export function spawnBoss(arenaNumber) {
    const config = BOSS_CONFIG[Math.min(arenaNumber, 6)];
    const boss = new THREE.Group();
    
    // Boss 1 (RED PUFFER KING) uses porcupinefish mesh
    if (arenaNumber === 1) {
        const pufferMesh = createPorcupinefishMesh(config.size, config.color);
        
        // Add all porcupinefish parts to boss
        pufferMesh.children.forEach(child => {
            boss.add(child.clone());
        });
        
        // Store references from the puffer mesh
        boss.isPorcupinefish = true;
        boss.pufferBody = boss.children.find(c => c.name === 'pufferBody');
        boss.pufferBodyMat = boss.pufferBody?.material;
        boss.pufferGlow = boss.children.find(c => c.name === 'pufferGlow');
        boss.pufferSpines = boss.children.find(c => c.name === 'spines');
        boss.pufferEyes = [
            boss.children.find(c => c.name === 'leftEye'),
            boss.children.find(c => c.name === 'rightEye')
        ];
        boss.pufferTail = boss.children.find(c => c.name === 'tail');
        boss.pufferFins = [
            boss.children.find(c => c.name === 'leftFin'),
            boss.children.find(c => c.name === 'rightFin')
        ];
        boss.pufferDorsal = boss.children.find(c => c.name === 'dorsalFin');
        
        // Inflation state system
        boss.inflationState = 0;       // 0 = deflated, 1 = inflated
        boss.targetInflation = 0;      // Target we're lerping toward
        boss.inflationSpeed = 0.05;    // Lerp speed per frame
        boss.spineBristleTimer = 0;
        boss.spineBristleScale = 1.0;
        
        // Store base transforms for animation reset (wiggle, etc.)
        boss.pufferBase = {
            bodyRot: boss.pufferBody ? boss.pufferBody.rotation.clone() : null,
            tailScale: boss.pufferTail ? boss.pufferTail.scale.clone() : null,
        };
        boss.wigglePhase = 0;
        boss.bubbleAcc = 0;  // For rate-limited bubble spawning
        boss.chargeDirLocked = false;
        
        // Apply initial deflated state
        updatePorcupinefishInflation(boss, 0);
        
        // Body material reference for standard boss systems
        boss.bodyMaterial = boss.pufferBodyMat;
    } else {
        // Standard boss mesh for other bosses
        const bodyMat = new THREE.MeshStandardMaterial({
            color: config.color,
            emissive: config.color,
            emissiveIntensity: 0.5
        });
        
        const body = new THREE.Mesh(
            new THREE.SphereGeometry(config.size, 16, 16),
            bodyMat
        );
        body.castShadow = true;
        boss.add(body);
        
        // Glow effect
        boss.add(new THREE.Mesh(
            new THREE.SphereGeometry(config.size * 1.2, 16, 16),
            new THREE.MeshBasicMaterial({
                color: config.color,
                transparent: true,
                opacity: 0.3
            })
        ));
        
        // Crown/horns for non-porcupinefish bosses
        const hornMat = new THREE.MeshStandardMaterial({ color: 0xffdd44 });
        for (let i = 0; i < 5; i++) {
            const horn = new THREE.Mesh(
                new THREE.ConeGeometry(0.4, 1.2, 8),
                hornMat
            );
            horn.position.set((i - 2) * 0.6, config.size + 0.4, 0);
            horn.rotation.z = (i - 2) * 0.15;
            boss.add(horn);
        }
        
        boss.bodyMaterial = bodyMat;
    }
    
    // Boss properties
    boss.health = config.health + gameState.level * 25;
    boss.maxHealth = boss.health;
    boss.damage = config.damage;
    boss.size = config.size;
    boss.baseSize = config.size;
    boss.speed = config.speed || 0.045;
    boss.isBoss = true;
    boss.isElite = false;
    boss.xpValue = 15 + arenaNumber * 5;  // Balanced: ~1-2 level-ups per boss
    boss.baseColor = config.color;
    // bodyMaterial already set in mesh creation branch above
    boss.velocityY = 0;
    boss.aiState = 'idle';
    boss.aiTimer = 0;
    boss.phase = 1;
    boss.chargeSpeed = 0.35;
    
    // Modular ability system
    boss.abilities = { ...config.abilities };
    boss.abilityWeights = config.abilityWeights;
    boss.phaseCombos = config.phaseCombos || {};
    boss.comboDelays = config.comboDelays || {};
    boss.abilityCooldowns = {};
    boss.currentCombo = null;
    boss.comboIndex = 0;
    boss.comboDelayTimer = 0;
    boss.lastComboAbility = null;
    
    // Combo VFX state
    boss.comboTether = null;
    boss.comboLockInMarker = null;
    boss.comboActive = false;
    boss.comboStanceActive = false;
    
    // Initialize cooldowns
    for (const ability in ABILITY_COOLDOWNS) {
        boss.abilityCooldowns[ability] = 0;
    }
    
    // Anti-stuck tracking
    boss.lastPosition = new THREE.Vector3();
    boss.stuckFrames = 0;
    boss.strafeDirection = 1;  // 1 = right, -1 = left
    boss.strafeTimer = 0;
    
    // Jump target for jump slam
    boss.jumpTarget = new THREE.Vector3();
    
    // Charge trail state (Red Puffer King P2+ leaves damage trails)
    boss.chargeTrails = [];
    boss.lastChargeTrailPos = new THREE.Vector3();
    
    // Burrow state
    boss.burrowTarget = new THREE.Vector3();
    boss.emergeWarningVFX = null;
    
    // Burrow config (Boss 5)
    if (config.burrowConfig) {
        boss.burrowConfig = config.burrowConfig;
    }
    
    // Pillar perch state (Boss 2)
    if (config.pillarPerchConfig && config.pillarPerchConfig.enabled) {
        boss.pillarPerchConfig = config.pillarPerchConfig;
        boss.pillarTarget = null;
        boss.perchTimer = 0;
        boss.slamMarker = null;
        boss.slamTargetPos = new THREE.Vector3();
        boss.abilityCooldowns.pillarPerch = 0;
    }
    
    // Teleport config (Boss 3+)
    if (config.teleportConfig) {
        boss.teleportConfig = config.teleportConfig;
        boss.teleportOriginVFX = null;
        boss.teleportDestVFX = null;
        boss.vulnerableTimer = 0;
    }
    
    // Lane walls config (Boss 4)
    if (config.laneWallsConfig && config.laneWallsConfig.enabled) {
        boss.laneWallsConfig = config.laneWallsConfig;
        boss.temporaryWalls = [];
        boss.abilityCooldowns.laneWalls = 0;
    }
    
    // Growth tracking
    boss.growthScale = 1.0;
    boss.hasSplit = false;
    boss.vineZones = [];  // Overgrowth P2+ vine DOT zones
    
    // Shield and exposed state (Boss 1)
    if (config.shieldConfig && config.shieldConfig.enabled) {
        boss.shieldConfig = config.shieldConfig;
        boss.shieldActive = false;
        boss.shieldMesh = createShieldBubble(boss, config.size * 1.2, config.shieldConfig.color);
        boss.shieldMesh.visible = false;
        boss.summonedMinions = [];
        boss.minionTethers = [];      // Visible tethers from boss to minions
        boss.tetherSnapVFXList = [];  // Active snap VFX animations
        boss.shieldStartTime = 0;     // Track when shield was activated for failsafe timeout
    }
    
    if (config.exposedConfig) {
        boss.exposedConfig = config.exposedConfig;
        boss.isExposed = false;
        boss.exposedTimer = 0;
        boss.exposedVFX = null;
    }
    
    // Movement patterns (Boss 1)
    boss.orbitTimer = 0;
    boss.orbitDirection = 1;
    boss.retreatState = null;
    boss.retreatTimer = 0;
    boss.chargeDirection = new THREE.Vector3();
    
    // Boss 6 ability cycling system
    if (arenaNumber === 6) {
        initializeBoss6AbilityCycle(boss);
    }
    
    boss.position.set(0, config.size, -35);
    scene.add(boss);
    setCurrentBoss(boss);
    showBossHealthBar(config.name);
    
    // Mark boss as encountered for roster
    markBossEncountered(arenaNumber);
    
    return boss;
}

export function updateBoss() {
    const currentBoss = getCurrentBoss();
    if (!currentBoss) return;
    
    const boss = currentBoss;
    boss.aiTimer++;
    
    // ==================== PORCUPINEFISH INFLATION UPDATE ====================
    if (boss.isPorcupinefish) {
        // Don't override inflation during charge ability - let ability code control it
        const inChargeAbility = boss.aiState === 'wind_up' || boss.aiState === 'charging';
        
        if (!inChargeAbility) {
            // Determine target inflation based on shield state
            // Inflated when shield is active, deflated when chasing without shield
            if (boss.shieldActive) {
                boss.targetInflation = 1.0;  // Inflated (armored orb)
            } else if (boss.phase === 1 || !boss.shieldConfig) {
                boss.targetInflation = 0.0;  // Deflated (swimmer)
            } else {
                // Phase 2+ without shield: still slightly inflated for threat read
                boss.targetInflation = boss.isExposed ? 0.3 : 0.0;
            }
        }
        
        // Lerp inflation state toward target
        const prevInflation = boss.inflationState;
        if (Math.abs(boss.inflationState - boss.targetInflation) > 0.01) {
            boss.inflationState += (boss.targetInflation - boss.inflationState) * boss.inflationSpeed;
        } else {
            boss.inflationState = boss.targetInflation;
        }
        
        // Update visuals based on inflation
        const deltaInflation = boss.inflationState - prevInflation;
        updatePorcupinefishInflation(boss, deltaInflation);
        
        // Animate spines when inflated
        animatePorcupinefishSpines(boss, 1);
        
        // Update bristle effect
        updateSpineBristle(boss);
        
        // Slowly rotate to face player (disabled during charge commitment)
        const isCharging = boss.aiState === 'charging' || boss.chargeDirLocked;
        if (!isCharging && !boss.shieldActive) {
            const dx = player.position.x - boss.position.x;
            const dz = player.position.z - boss.position.z;
            const targetAngle = Math.atan2(dx, dz);
            const diff = Math.atan2(Math.sin(targetAngle - boss.rotation.y), Math.cos(targetAngle - boss.rotation.y));
            
            // Turn rate: ~100 degrees/sec at 60fps
            const maxStep = 0.03;
            boss.rotation.y += Math.max(-maxStep, Math.min(maxStep, diff));
        }
    }
    
    // Update temporary walls
    if (boss.temporaryWalls) {
        for (let i = boss.temporaryWalls.length - 1; i >= 0; i--) {
            const wall = boss.temporaryWalls[i];
            if (wall.isTemporary) {
                wall.remainingDuration--;
                
                // Fade out
                if (wall.remainingDuration < 60) {
                    wall.material.opacity = 0.8 * (wall.remainingDuration / 60);
                }
                
                // Remove when expired
                if (wall.remainingDuration <= 0) {
                    const obsIndex = obstacles.indexOf(wall);
                    if (obsIndex > -1) obstacles.splice(obsIndex, 1);
                    
                    wall.geometry.dispose();
                    wall.material.dispose();
                    scene.remove(wall);
                    boss.temporaryWalls.splice(i, 1);
                }
            }
        }
    }
    
    // Update cooldowns
    for (const ability in boss.abilityCooldowns) {
        if (boss.abilityCooldowns[ability] > 0) {
            boss.abilityCooldowns[ability]--;
        }
    }
    
    // Phase transitions (dramatic)
    const healthPercent = boss.health / boss.maxHealth;
    if (healthPercent < 0.33 && boss.phase < 3) {
        triggerPhaseTransition(boss, 3);
    } else if (healthPercent < 0.66 && boss.phase < 2) {
        triggerPhaseTransition(boss, 2);
    }
    
    // Update phase transition timer (frame-based delay)
    if (boss.phaseTransitioning && boss.phaseTransitionTimer > 0) {
        boss.phaseTransitionTimer--;
        if (boss.phaseTransitionTimer <= 0) {
            completePhaseTransition(boss);
        }
    }
    
    // Shield failsafe timeout - prevents softlock if minions get stuck
    if (boss.shieldActive && boss.shieldConfig && boss.shieldConfig.failsafeTimeout) {
        const shieldDuration = (Date.now() - boss.shieldStartTime) / 1000;
        if (shieldDuration >= boss.shieldConfig.failsafeTimeout) {
            // Auto-break shield with special message
            boss.shieldActive = false;
            boss.isExposed = true;
            
            // Use nerfed failsafe duration (prevents "wait out" strats)
            const failsafeDuration = boss.exposedConfig?.failsafeDuration || 180;
            boss.exposedTimer = failsafeDuration;
            boss.exposedDamageMultiplier = boss.exposedConfig?.failsafeMultiplier || 1.0;
            
            if (boss.shieldMesh) {
                boss.shieldMesh.visible = false;
            }
            
            // Show failsafe message (reduced reward warning)
            showTutorialCallout('shieldOverload', 'SHIELD OVERLOAD - Reduced vulnerable window!', 2000);
            
            // Shield break VFX and audio
            spawnShieldBreakVFX(boss.position, 0x4488ff);
            PulseMusic.onBossShieldBreak();
            PulseMusic.onBossExposed();
            
            // Create exposed VFX
            boss.exposedVFX = createExposedVFX(boss);
            
            // Kill any remaining stuck minions and clean up tethers
            if (boss.summonedMinions && boss.summonedMinions.length > 0) {
                for (const minion of boss.summonedMinions) {
                    if (minion && minion.parent) {
                        // Create snap VFX for tether
                        if (minion.tether) {
                            const snapVFX = createTetherSnapVFX(minion.position.clone(), boss.baseColor);
                            if (boss.tetherSnapVFXList) {
                                boss.tetherSnapVFXList.push(snapVFX);
                            }
                            cleanupVFX(minion.tether);
                        }
                        
                        spawnParticle(minion.position, minion.baseColor || 0xffffff, 5);
                        scene.remove(minion);
                        const idx = enemies.indexOf(minion);
                        if (idx > -1) enemies.splice(idx, 1);
                    }
                }
                boss.summonedMinions = [];
            }
            
            // Clean up any remaining tethers
            if (boss.minionTethers && boss.minionTethers.length > 0) {
                for (const tether of boss.minionTethers) {
                    cleanupVFX(tether);
                }
                boss.minionTethers = [];
            }
        }
    }
    
    // Anti-stuck detection
    updateAntiStuck(boss);
    
    // Handle exposed state
    if (boss.isExposed) {
        boss.exposedTimer--;
        if (boss.exposedVFX) {
            updateExposedVFX(boss.exposedVFX, boss.exposedTimer);
        }
        
        // Flash body material
        if (boss.bodyMaterial) {
            if (boss.exposedTimer % boss.exposedConfig.flashRate < boss.exposedConfig.flashRate / 2) {
                boss.bodyMaterial.emissiveIntensity = 0.8;
            } else {
                boss.bodyMaterial.emissiveIntensity = 0.4;
            }
        }
        
        if (boss.exposedTimer <= 0) {
            boss.isExposed = false;
            if (boss.exposedVFX) {
                cleanupVFX(boss.exposedVFX);
                boss.exposedVFX = null;
            }
            if (boss.bodyMaterial) {
                boss.bodyMaterial.emissiveIntensity = 0.5;
            }
            
            // Boss 1 Phase 3: Reactivate shield after exposed window ends
            const config = BOSS_CONFIG[gameState.currentArena];
            if (gameState.currentArena === 1 && boss.phase === 3 && config.phaseBehavior?.[3]?.canShield) {
                boss.shieldActive = true;
                boss.shieldStartTime = Date.now();
                if (boss.shieldMesh) {
                    boss.shieldMesh.visible = true;
                }
            }
        }
    }
    
    // Unified AI loop
    updateBossAI(boss);
    
    // Update combo VFX
    updateComboVFX(boss);
    
    // Update minion enrage (speed boost after 8s to prevent kiting)
    if (boss.summonedMinions && boss.summonedMinions.length > 0) {
        const now = Date.now();
        for (const minion of boss.summonedMinions) {
            if (!minion || !minion.parent) continue;  // Skip dead/removed minions
            
            if (minion.enrageStartTime) {
                const elapsed = now - minion.enrageStartTime;
                if (elapsed > minion.enrageDelay) {
                    // Calculate enrage boost: +5%/sec after delay, capped at 40%
                    const enrageTime = (elapsed - minion.enrageDelay) / 1000;
                    const boost = Math.min(minion.enrageCap, enrageTime * minion.enrageRate);
                    minion.speed = minion.baseSpeed * (1 + boost);
                    
                    // Visual feedback: increase emissive intensity as enrage builds
                    if (minion.baseMaterial || minion.material) {
                        const mat = minion.baseMaterial || minion.material;
                        mat.emissiveIntensity = 0.4 + boost * 0.8;  // Max 0.72 intensity
                    }
                }
            }
        }
    }
    
    // Update minion tethers
    if (boss.minionTethers && boss.minionTethers.length > 0) {
        updateMinionTethers(boss, boss.minionTethers);
    }
    
    // Update tether snap VFX
    if (boss.tetherSnapVFXList && boss.tetherSnapVFXList.length > 0) {
        for (let i = boss.tetherSnapVFXList.length - 1; i >= 0; i--) {
            const vfx = boss.tetherSnapVFXList[i];
            const shouldRemove = updateTetherSnapVFX(vfx);
            if (shouldRemove) {
                cleanupVFX(vfx);
                boss.tetherSnapVFXList.splice(i, 1);
            }
        }
    }
    
    // Update charge trails (Red Puffer King P2+)
    if (boss.chargeTrails && boss.chargeTrails.length > 0) {
        for (let i = boss.chargeTrails.length - 1; i >= 0; i--) {
            const trail = boss.chargeTrails[i];
            const shouldRemove = updateChargeTrailSegment(trail);
            
            // Check player collision with trail (deal damage)
            if (!shouldRemove && trail.isDamageZone) {
                const distToPlayer = trail.position.distanceTo(player.position);
                if (distToPlayer < trail.damageRadius + 0.5) {
                    const now = Date.now();
                    if (now - lastDamageTime > DAMAGE_COOLDOWN) {
                        takeDamage(trail.damage, 'Charge Trail', 'hazard');
                        setLastDamageTime(now);
                    }
                }
            }
            
            if (shouldRemove) {
                cleanupVFX(trail);
                boss.chargeTrails.splice(i, 1);
            }
        }
    }
    
    // Update vine zones (Overgrowth P2+)
    if (boss.vineZones && boss.vineZones.length > 0) {
        for (let i = boss.vineZones.length - 1; i >= 0; i--) {
            const zone = boss.vineZones[i];
            const shouldRemove = updateVineZone(zone);
            
            // Check player collision with vine zone
            if (!shouldRemove && zone.isDamageZone) {
                const distToPlayer = zone.position.distanceTo(player.position);
                if (distToPlayer < zone.radius) {
                    // Apply DOT damage (2 DPS = ~0.033 per frame at 60fps)
                    const now = Date.now();
                    if (!zone.lastDamageTime || now - zone.lastDamageTime > 500) {
                        // Deal damage every 0.5 seconds while in zone
                        takeDamage(zone.damagePerSecond * 0.5, 'Vine Zone', 'hazard');
                        zone.lastDamageTime = now;
                    }
                    
                    // Apply slow effect
                    if (zone.slowFactor && player.slowTimer === undefined) {
                        player.baseSpeed = player.speed;
                    }
                    if (zone.slowFactor) {
                        player.slowTimer = 10; // Brief slow duration
                    }
                }
            }
            
            if (shouldRemove) {
                cleanupVFX(zone);
                boss.vineZones.splice(i, 1);
            }
        }
    }
    
    // Gravity
    boss.velocityY = (boss.velocityY || 0) - 0.015;
    boss.position.y += boss.velocityY;
    if (boss.position.y < boss.size * boss.growthScale) {
        boss.position.y = boss.size * boss.growthScale;
        boss.velocityY = 0;
    }
    
    // Player collision (skip during cutscenes)
    if (!gameState.cutsceneActive) {
        const distToPlayer = boss.position.distanceTo(player.position);
        const effectiveSize = boss.size * boss.growthScale * boss.scale.x;
        if (distToPlayer < effectiveSize + 0.5) {
            const now = Date.now();
            if (now - lastDamageTime > DAMAGE_COOLDOWN) {
                const config = BOSS_CONFIG[gameState.currentArena];
                takeDamage(boss.damage, config?.name || 'Boss', 'boss');
                setLastDamageTime(now);
            }
        }
    }
    
    updateBossHealthBar();
    
    // Update Boss 6 cycle indicator and dynamic color
    if (gameState.currentArena === 6 && boss.cyclePhase) {
        updateBoss6CycleIndicator(boss.cyclePhase);
        updateBoss6Color(boss);
    }
}

// ==================== ANTI-STUCK SYSTEM ====================

function updateAntiStuck(boss) {
    const moved = boss.position.distanceTo(boss.lastPosition);
    
    // Check for stuck in any ground state (not jumping/burrowing/teleporting)
    const groundStates = ['idle', 'cooldown', 'landed', 'hazards', 'summon', 'growth'];
    const isGroundState = groundStates.includes(boss.aiState);
    
    if (isGroundState) {
        if (moved < BOSS_STUCK_THRESHOLD) {
            boss.stuckFrames++;
        } else {
            boss.stuckFrames = Math.max(0, boss.stuckFrames - 2); // Decay faster when moving
        }
    } else {
        boss.stuckFrames = 0;
    }
    
    boss.lastPosition.copy(boss.position);
    
    // If stuck, trigger recovery behavior
    if (boss.stuckFrames > BOSS_STUCK_FRAMES) {
        triggerStuckRecovery(boss);
    }
    
    // Handle strafe recovery - more aggressive movement
    if (boss.strafeTimer > 0) {
        boss.strafeTimer--;
        const strafeVec = new THREE.Vector3();
        strafeVec.subVectors(player.position, boss.position);
        strafeVec.y = 0;
        
        // Perpendicular strafe + slight forward movement
        const perpX = -strafeVec.z * boss.strafeDirection;
        const perpZ = strafeVec.x * boss.strafeDirection;
        strafeVec.normalize();
        
        // Combine perpendicular and forward movement
        boss.position.x += (perpX * 0.7 + strafeVec.x * 0.3) * boss.speed * 2;
        boss.position.z += (perpZ * 0.7 + strafeVec.z * 0.3) * boss.speed * 2;
        clampBossPosition(boss);
    }
}

function triggerStuckRecovery(boss) {
    boss.stuckFrames = 0;
    
    // Track recovery attempts
    boss.recoveryAttempts = (boss.recoveryAttempts || 0) + 1;
    
    // After multiple strafe attempts, force an ability
    if (boss.recoveryAttempts > 3) {
        boss.recoveryAttempts = 0;
        
        // Force teleport or jump if available (ignore cooldowns for stuck recovery)
        if (boss.abilities.teleport) {
            boss.aiState = 'teleport_out';
            boss.aiTimer = 0;
            return;
        } else if (boss.abilities.jumpSlam) {
            boss.aiState = 'jump_prep';
            boss.aiTimer = 0;
            return;
        }
    }
    
    // Pick recovery based on available abilities
    if (boss.abilities.teleport && boss.abilityCooldowns.teleport <= 0) {
        // Teleport bailout
        boss.aiState = 'teleport_out';
        boss.aiTimer = 0;
        boss.abilityCooldowns.teleport = ABILITY_COOLDOWNS.teleport;
        boss.recoveryAttempts = 0;
    } else if (boss.abilities.jumpSlam && boss.abilityCooldowns.jumpSlam <= 0) {
        // Jump slam bailout
        boss.aiState = 'jump_prep';
        boss.aiTimer = 0;
        boss.abilityCooldowns.jumpSlam = ABILITY_COOLDOWNS.jumpSlam;
        boss.recoveryAttempts = 0;
    } else if (boss.abilities.charge && boss.abilityCooldowns.charge <= 0) {
        // Charge redirect (tangent direction)
        boss.aiState = 'wind_up';
        boss.aiTimer = 0;
        boss.abilityCooldowns.charge = ABILITY_COOLDOWNS.charge;
        boss.recoveryAttempts = 0;
    } else {
        // Default: strafe mode - longer duration
        boss.strafeTimer = 60;  // 1 second strafe
        boss.strafeDirection *= -1;  // Alternate direction
    }
}

// ==================== UNIFIED AI LOOP ====================

// Shield hibernation behavior - phase-based
function getShieldBehavior(boss) {
    if (!boss.shieldActive) return null;
    
    const config = BOSS_CONFIG[gameState.currentArena];
    const phaseBehavior = config.phaseBehavior?.[boss.phase];
    
    // Use phaseBehavior config if available (Boss 1 new system)
    if (phaseBehavior) {
        if (phaseBehavior.staticMode) return 'static';  // Boss 1 Phase 2
        if (phaseBehavior.chase) return 'aggressiveChase';  // Boss 1 Phase 3
    }
    
    // Legacy behavior for other bosses
    switch (boss.phase) {
        case 1: return 'hibernate';        // Full hibernate - no attacks
        case 2: return 'timedPulse';       // Light pressure every 4s
        case 3: return 'filteredAggression'; // Full aggression minus top lethality
        default: return 'hibernate';
    }
}

// Check if ability is the "top lethality" move for this boss (blocked during P3 shield)
function isTopLethalityAbility(boss, ability) {
    // Top lethality moves per boss (blocked during Phase 3 shielded state)
    const topLethality = {
        1: 'charge',      // Red Puffer King's charge
        2: 'jumpSlam',    // Monolith's slam
        3: 'teleport',    // Ascendant's teleport
        4: 'growth',      // Overgrowth's growth
        5: 'burrow',      // Burrower's burrow
        6: 'charge'       // Chaos's charge (or first in cycle)
    };
    
    return topLethality[gameState.currentArena] === ability;
}

function updateBossAI(boss) {
    // Skip all AI processing during cutscenes
    if (boss.aiState === 'cutscene_idle' || gameState.cutsceneActive) {
        return;
    }
    
    // Red Puffer King P3 summon freeze - boss pauses briefly during ring summon
    if (boss.summonFreeze && boss.summonFreezeTimer > 0) {
        boss.summonFreezeTimer--;
        if (boss.summonFreezeTimer <= 0) {
            boss.summonFreeze = false;
        }
        return; // Skip AI while frozen
    }
    
    // If in strafe recovery, don't change state
    if (boss.strafeTimer > 0) return;
    
    // ==================== SHIELD HIBERNATION BEHAVIOR ====================
    const shieldBehavior = getShieldBehavior(boss);
    
    if (shieldBehavior === 'static') {
        // Boss 1 Phase 2: Static shield mode - anchored, only summons
        // Ensure we're in static_shielded state
        if (boss.aiState !== 'summon' && boss.aiState !== 'static_shielded') {
            boss.aiState = 'static_shielded';
            boss.aiTimer = 0;
        }
        // Continue the static_shielded state (handles rotation and summon timer)
        continueCurrentAbility(boss);
        return;
    }
    
    if (shieldBehavior === 'aggressiveChase') {
        // Boss 1 Phase 3: Chase while shielded - full aggression
        // Fall through to normal AI flow (chase + abilities)
    }
    
    if (shieldBehavior === 'hibernate') {
        // Legacy: Full hibernate - just slow orbit, no attacks
        // Initialize pulse timer if needed
        if (!boss.shieldPulseTimer) boss.shieldPulseTimer = 0;
        
        // Continue current ability if already started (don't interrupt mid-action)
        if (boss.aiState !== 'idle' && boss.aiState !== 'cooldown') {
            continueCurrentAbility(boss);
            return;
        }
        
        // Slow orbit around player instead of attacking
        const orbitSpeed = 0.02;
        const orbitDist = 10;
        const angle = Date.now() * 0.001;
        const targetX = player.position.x + Math.cos(angle) * orbitDist;
        const targetZ = player.position.z + Math.sin(angle) * orbitDist;
        
        boss.position.x += (targetX - boss.position.x) * orbitSpeed;
        boss.position.z += (targetZ - boss.position.z) * orbitSpeed;
        clampBossPosition(boss);
        return;
    }
    
    if (shieldBehavior === 'timedPulse') {
        // Legacy: Timed pulse every 4 seconds (240 frames)
        if (!boss.shieldPulseTimer) boss.shieldPulseTimer = 0;
        boss.shieldPulseTimer++;
        
        // Continue current ability if already started
        if (boss.aiState !== 'idle' && boss.aiState !== 'cooldown') {
            continueCurrentAbility(boss);
            return;
        }
        
        // Move toward player slowly between pulses
        moveTowardPlayer(boss, 0.3);
        
        // Every 4 seconds (240 frames), do a light pressure move
        if (boss.shieldPulseTimer >= 240) {
            boss.shieldPulseTimer = 0;
            
            // Pick a light pressure ability (hazards or summon repositioning)
            // Avoid high-damage moves
            if (boss.abilities.hazards && boss.abilityCooldowns.hazards <= 0) {
                startAbility(boss, 'hazards');
            } else if (boss.abilities.jumpSlam && boss.abilityCooldowns.jumpSlam <= 0) {
                // Jump slam feint - reduced damage in P2 shield state
                startAbility(boss, 'jumpSlam');
            }
        }
        return;
    }
    
    if (shieldBehavior === 'filteredAggression') {
        // Legacy: Phase 3: Full aggression but filter out top lethality move
        // Reset pulse timer since we're in P3
        boss.shieldPulseTimer = 0;
        
        // Continue to normal AI but will filter abilities in pickAbility
        // (handled below in the normal flow)
    }
    
    // Reset pulse timer when shield is down
    if (!boss.shieldActive) {
        boss.shieldPulseTimer = 0;
    }
    
    // ==================== NORMAL AI FLOW ====================
    
    // Continue current action if busy
    if (boss.aiState !== 'idle' && boss.aiState !== 'cooldown') {
        continueCurrentAbility(boss);
        return;
    }
    
    // In cooldown, move toward player slowly
    if (boss.aiState === 'cooldown') {
        moveTowardPlayer(boss, 0.5);
        
        // Use chargeRecoveryTimer if set (Boss 1 phase-based recovery), otherwise default 30
        const recoveryTime = boss.chargeRecoveryTimer !== undefined ? boss.chargeRecoveryTimer : 30;
        
        if (boss.aiTimer > recoveryTime) {
            boss.aiState = 'idle';
            boss.aiTimer = 0;
            boss.chargeRecoveryTimer = undefined;  // Reset for next charge
        }
        return;
    }
    
    // Idle state - pick next ability or movement pattern
    // Boss 1 movement patterns
    if (gameState.currentArena === 1 && Math.random() < 0.3 && boss.aiTimer > 30) {
        // 30% chance to use special movement
        if (Math.random() < 0.5) {
            boss.aiState = 'orbit';
            boss.orbitTimer = 0;
            boss.orbitDirection = Math.random() < 0.5 ? 1 : -1;
            return;
        } else {
            boss.aiState = 'retreat_charge';
            boss.retreatState = 'retreating';
            boss.retreatTimer = 0;
            return;
        }
    }
    
    moveTowardPlayer(boss, 1.0);
    
    // Check if we should execute a combo
    if (boss.currentCombo && boss.comboIndex < boss.currentCombo.length) {
        const nextAbility = boss.currentCombo[boss.comboIndex];
        
        // Check for combo delay between abilities (e.g., teleport → charge needs gap)
        if (boss.comboIndex > 0 && boss.lastComboAbility) {
            const delayKey = `${boss.lastComboAbility}_${nextAbility}`;
            const requiredDelay = boss.comboDelays[delayKey] || 0;
            
            if (boss.comboDelayTimer < requiredDelay) {
                boss.comboDelayTimer++;
                return;  // Wait for delay before next combo ability
            }
        }
        
        if (boss.abilityCooldowns[nextAbility] <= 0) {
            boss.lastComboAbility = nextAbility;
            boss.comboDelayTimer = 0;  // Reset for next combo step
            startAbility(boss, nextAbility);
            boss.comboIndex++;
            return;
        }
    } else {
        // Combo completed - cleanup VFX
        if (boss.comboActive) {
            endComboVFX(boss);
        }
        boss.currentCombo = null;
        boss.comboIndex = 0;
        boss.lastComboAbility = null;
        boss.comboDelayTimer = 0;
    }
    
    // Wait minimum time before next ability
    // Boss 6 P2+: Faster cycles (30% speed increase)
    let minWaitTime = 60;
    if (gameState.currentArena === 6 && boss.phase >= 2) {
        minWaitTime = Math.floor(60 * 0.7);  // 42 frames instead of 60
    }
    if (boss.aiTimer < minWaitTime) return;
    
    // Boss 6 P3: Update sequence preview
    if (gameState.currentArena === 6 && boss.phase >= 3) {
        updateBoss6SequencePreview(boss);
    }
    
    // Pick next ability
    const ability = pickAbility(boss);
    if (ability) {
        // Check for combo opportunity
        const combos = boss.phaseCombos[boss.phase];
        if (combos && combos.length > 0 && Math.random() < 0.3 * boss.phase) {
            // Try to start a combo that begins with this ability
            const matchingCombos = combos.filter(c => c[0] === ability);
            if (matchingCombos.length > 0) {
                boss.currentCombo = matchingCombos[Math.floor(Math.random() * matchingCombos.length)];
                boss.comboIndex = 0;
                
                // Start combo VFX and audio
                startComboVFX(boss);
            }
        }
        
        startAbility(boss, ability);
    }
}

// ==================== COMBO VFX SYSTEM ====================

function startComboVFX(boss) {
    boss.comboActive = true;
    
    // Show UI chain indicator
    showChainIndicator();
    
    // Play combo start audio
    PulseMusic.onComboStart(boss.currentCombo ? boss.currentCombo.length : 2);
    
    // Create combo tether to next ability target (estimate based on player position)
    const targetPos = player.position.clone();
    boss.comboTether = createComboTether(boss, targetPos);
    
    // Create lock-in marker at estimated target
    boss.comboLockInMarker = createComboLockInMarker(targetPos);
    
    // Phase 3 stance change - increase emissive intensity and slight tilt
    if (boss.phase >= 3) {
        boss.comboStanceActive = true;
        if (boss.bodyMaterial) {
            boss.bodyMaterial.emissiveIntensity = 0.8;
        }
        // Slight forward tilt for "aggressive" posture
        boss.rotation.x = 0.1;
    }
}

function updateComboVFX(boss) {
    if (!boss.comboActive) return;
    
    // Update tether position (track player as estimated target)
    if (boss.comboTether) {
        updateComboTether(boss.comboTether, player.position);
    }
    
    // Update lock-in marker position and animation
    if (boss.comboLockInMarker) {
        boss.comboLockInMarker.position.copy(player.position);
        boss.comboLockInMarker.position.y = 0;
        updateComboLockInMarker(boss.comboLockInMarker);
    }
    
    // Phase 3 stance pulse
    if (boss.comboStanceActive && boss.bodyMaterial) {
        const pulse = 0.7 + 0.2 * Math.sin(Date.now() * 0.01);
        boss.bodyMaterial.emissiveIntensity = pulse;
    }
}

function endComboVFX(boss) {
    if (!boss.comboActive) return;
    
    boss.comboActive = false;
    
    // Hide UI chain indicator
    hideChainIndicator();
    
    // Play combo end audio
    PulseMusic.onComboEnd();
    
    // Cleanup tether
    if (boss.comboTether) {
        // Dispose the tube geometry (not cached)
        if (boss.comboTether.tubeGeom) {
            boss.comboTether.tubeGeom.dispose();
        }
        cleanupVFX(boss.comboTether);
        boss.comboTether = null;
    }
    
    // Cleanup lock-in marker
    if (boss.comboLockInMarker) {
        cleanupVFX(boss.comboLockInMarker);
        boss.comboLockInMarker = null;
    }
    
    // Reset Phase 3 stance
    if (boss.comboStanceActive) {
        boss.comboStanceActive = false;
        if (boss.bodyMaterial) {
            boss.bodyMaterial.emissiveIntensity = 0.5;
        }
        boss.rotation.x = 0;
    }
}

function pickAbility(boss) {
    // Boss 6 uses deterministic ability cycling instead of random selection
    if (gameState.currentArena === 6 && boss.abilityCycle) {
        return pickBoss6Ability(boss);
    }
    
    const available = [];
    let totalWeight = 0;
    
    // Check if we're in Phase 3 filtered aggression (shield active)
    const isFilteredAggression = boss.shieldActive && boss.phase >= 3;
    
    // Boss 2 special: favor pillar perch ability
    if (gameState.currentArena === 2 && boss.pillarPerchConfig && boss.abilityCooldowns.pillarPerch <= 0) {
        if (Math.random() < 0.4) {
            // Skip pillar perch if it's the top lethality during filtered aggression
            if (!(isFilteredAggression && isTopLethalityAbility(boss, 'pillarPerch'))) {
                return 'pillarPerch';
            }
        }
    }
    
    // Boss 4 special: favor lane walls ability
    if (gameState.currentArena === 4 && boss.laneWallsConfig && boss.abilityCooldowns.laneWalls <= 0) {
        if (Math.random() < 0.3) {
            return 'laneWalls';
        }
    }
    
    for (const [ability, enabled] of Object.entries(boss.abilities)) {
        if (!enabled) continue;
        if (boss.abilityCooldowns[ability] > 0) continue;
        
        // Phase 3 filtered aggression: skip top lethality ability while shielded
        if (isFilteredAggression && isTopLethalityAbility(boss, ability)) {
            continue;
        }
        
        const weights = boss.abilityWeights[ability];
        if (!weights) continue;
        
        const weight = weights[boss.phase - 1] || weights[0];
        available.push({ ability, weight });
        totalWeight += weight;
    }
    
    if (available.length === 0) return null;
    
    // Weighted random selection
    let random = Math.random() * totalWeight;
    for (const { ability, weight } of available) {
        random -= weight;
        if (random <= 0) return ability;
    }
    
    return available[0].ability;
}

// ==================== BOSS 6 ABILITY CYCLING SYSTEM ====================

// Cycle names for UI display
const BOSS6_CYCLE_NAMES = ['MOVEMENT', 'AREA CONTROL', 'SUMMONS'];
const BOSS6_CYCLE_COLORS = [0xff4444, 0x44ff44, 0x4444ff];  // Red, Green, Blue

function initializeBoss6AbilityCycle(boss) {
    // Define ability "phases" that cycle predictably
    boss.abilityCycle = [
        // Cycle 0: Movement abilities (Red)
        ['charge', 'teleport', 'burrow'],
        // Cycle 1: Area control (Green)
        ['jumpSlam', 'hazards', 'growth'],
        // Cycle 2: Summons (Blue)
        ['summon', 'split']
    ];
    
    boss.currentCycleIndex = 0;
    boss.currentAbilityInCycle = 0;
    boss.cyclePhase = BOSS6_CYCLE_NAMES[0];
    boss.targetCycleColor = BOSS6_CYCLE_COLORS[0];
}

function pickBoss6Ability(boss) {
    const cycle = boss.abilityCycle[boss.currentCycleIndex];
    let ability = cycle[boss.currentAbilityInCycle];
    
    // Handle split special case (only once per fight, only below 50% health)
    if (ability === 'split') {
        if (boss.hasSplit || boss.health >= boss.maxHealth * 0.5) {
            // Skip split, move to next ability in cycle
            boss.currentAbilityInCycle++;
            if (boss.currentAbilityInCycle >= cycle.length) {
                advanceBoss6Cycle(boss);
            }
            return pickBoss6Ability(boss);  // Recurse to get valid ability
        }
    }
    
    // Check if ability is on cooldown
    if (boss.abilityCooldowns[ability] > 0) {
        // Try next ability in current cycle
        const originalIndex = boss.currentAbilityInCycle;
        for (let i = 0; i < cycle.length; i++) {
            const checkIndex = (originalIndex + i) % cycle.length;
            const checkAbility = cycle[checkIndex];
            
            // Skip split if conditions not met
            if (checkAbility === 'split' && (boss.hasSplit || boss.health >= boss.maxHealth * 0.5)) {
                continue;
            }
            
            if (boss.abilityCooldowns[checkAbility] <= 0) {
                ability = checkAbility;
                boss.currentAbilityInCycle = checkIndex;
                break;
            }
        }
        
        // If all abilities in cycle are on cooldown, return null (wait)
        if (boss.abilityCooldowns[ability] > 0) {
            return null;
        }
    }
    
    // Advance to next ability in cycle
    boss.currentAbilityInCycle++;
    if (boss.currentAbilityInCycle >= cycle.length) {
        advanceBoss6Cycle(boss);
    }
    
    // Apply phase difficulty variance (small chance to skip for unpredictability)
    const weights = boss.abilityWeights[ability];
    if (weights) {
        const weight = weights[boss.phase - 1] || weights[0];
        // Higher phases have less variance (more consistent attacks)
        if (Math.random() > weight * (0.3 + boss.phase * 0.1)) {
            // Skip this ability occasionally for slight variance
            return pickBoss6Ability(boss);
        }
    }
    
    return ability;
}

function advanceBoss6Cycle(boss) {
    boss.currentAbilityInCycle = 0;
    boss.currentCycleIndex = (boss.currentCycleIndex + 1) % boss.abilityCycle.length;
    
    // Update cycle info for UI and color
    boss.cyclePhase = BOSS6_CYCLE_NAMES[boss.currentCycleIndex];
    boss.targetCycleColor = BOSS6_CYCLE_COLORS[boss.currentCycleIndex];
    
    // Announce cycle change via HUD
    showBoss6CycleAnnouncement(BOSS6_CYCLE_NAMES[boss.currentCycleIndex]);
}

// Boss 6 P3: Get upcoming abilities for sequence preview
function getBoss6UpcomingAbilities(boss, count = 3) {
    if (!boss.abilityCycle) return [];
    
    const upcoming = [];
    let cycleIdx = boss.currentCycleIndex;
    let abilityIdx = boss.currentAbilityInCycle;
    
    for (let i = 0; i < count; i++) {
        const cycle = boss.abilityCycle[cycleIdx];
        if (!cycle) break;
        
        let ability = cycle[abilityIdx];
        
        // Skip split if already used or not low HP
        if (ability === 'split' && (boss.hasSplit || boss.health >= boss.maxHealth * 0.5)) {
            abilityIdx++;
            if (abilityIdx >= cycle.length) {
                cycleIdx = (cycleIdx + 1) % boss.abilityCycle.length;
                abilityIdx = 0;
            }
            ability = boss.abilityCycle[cycleIdx][abilityIdx];
        }
        
        upcoming.push(ability);
        
        // Advance to next
        abilityIdx++;
        if (abilityIdx >= cycle.length) {
            cycleIdx = (cycleIdx + 1) % boss.abilityCycle.length;
            abilityIdx = 0;
        }
    }
    
    return upcoming;
}

// Boss 6 P3: Update sequence preview in UI
function updateBoss6SequencePreview(boss) {
    const upcoming = getBoss6UpcomingAbilities(boss, 3);
    showBoss6SequencePreview(upcoming);
}

// Update Boss 6 color based on current cycle (lerps toward target color)
function updateBoss6Color(boss) {
    if (!boss.bodyMaterial || !boss.targetCycleColor) return;
    
    const currentColor = boss.bodyMaterial.color.getHex();
    const targetColor = boss.targetCycleColor;
    
    // Skip if colors are already close enough
    if (currentColor === targetColor) return;
    
    const lerpedColor = lerpColor(currentColor, targetColor, 0.05);
    boss.bodyMaterial.color.setHex(lerpedColor);
    boss.bodyMaterial.emissive.setHex(lerpedColor);
    
    // Update glow mesh color too (child index 1)
    if (boss.children[1] && boss.children[1].material) {
        boss.children[1].material.color.setHex(lerpedColor);
    }
}

// Linear interpolation between two hex colors
function lerpColor(c1, c2, t) {
    const r1 = (c1 >> 16) & 0xff;
    const g1 = (c1 >> 8) & 0xff;
    const b1 = c1 & 0xff;
    
    const r2 = (c2 >> 16) & 0xff;
    const g2 = (c2 >> 8) & 0xff;
    const b2 = c2 & 0xff;
    
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    
    return (r << 16) | (g << 8) | b;
}

// Export cycle constants for HUD
export { BOSS6_CYCLE_NAMES, BOSS6_CYCLE_COLORS };

// ==================== DEMO ABILITY SYSTEM ====================
// For phase transition cutscenes - triggers ability in safe direction

export function triggerDemoAbility(boss, abilityName) {
    if (!boss) return;
    
    boss.inDemoMode = true;
    boss.demoAbility = abilityName;
    
    // Calculate safe direction (away from player, or toward arena edge)
    const playerDir = tempVec3.subVectors(player.position, boss.position).normalize();
    const safeDir = playerDir.clone().negate();  // Opposite of player
    safeDir.y = 0;
    safeDir.normalize();
    
    // Store the safe direction for use during ability
    boss.demoChargeDir = safeDir.clone();
    
    switch (abilityName) {
        case 'charge':
            boss.aiState = 'wind_up';
            boss.aiTimer = 0;
            boss.bodyMaterial.emissiveIntensity = 1;
            boss.chargeMarker = null;
            if (boss.isPorcupinefish) {
                boss.targetInflation = 1.0;
                boss.wigglePhase = 0;
                boss.chargeDirLocked = false;
            }
            break;
        case 'summon':
            // For demo, just show the summon animation
            boss.aiState = 'summon';
            boss.aiTimer = 0;
            break;
    }
}

export function isDemoModeActive(boss) {
    return boss && boss.inDemoMode;
}

export function endDemoMode(boss) {
    if (boss) {
        boss.inDemoMode = false;
        boss.demoAbility = null;
        boss.demoChargeDir = null;
    }
}

// ==================== CUTSCENE SAFETY SYSTEM ====================
// Ensures player safety during boss intro and phase transition cutscenes

const CUTSCENE_SAFE_DISTANCE = 15;  // Minimum distance between boss and player
const BOSS_CUTSCENE_POSITION = { x: 0, y: 0, z: -20 };  // Boss position during cutscenes (arena center-back)

/**
 * Prepare boss for cutscene - disengage from combat and move to safe position
 * Call this before any boss intro or phase transition cutscene begins
 */
export function prepareBossForCutscene(boss) {
    if (!boss) return;
    
    // Set cutscene state
    gameState.cutsceneActive = true;
    gameState.cutsceneInvincible = true;
    
    // Store previous AI state for potential restoration
    boss.preCutsceneAiState = boss.aiState;
    
    // Disable boss AI - enter cutscene idle state
    boss.aiState = 'cutscene_idle';
    boss.aiTimer = 0;
    
    // Clear any active abilities/charges
    boss.chargeDirection = null;
    boss.chargeDirLocked = false;
    boss.chargeMarker = null;
    
    // Move boss to safe cutscene position (arena center-back)
    const config = BOSS_CONFIG[gameState.currentArena];
    const bossY = config ? config.size : 3;
    boss.position.set(BOSS_CUTSCENE_POSITION.x, bossY, BOSS_CUTSCENE_POSITION.z);
    
    // Face toward arena center (where player typically is)
    boss.rotation.y = 0;
}

/**
 * End cutscene and reposition player to safe distance from boss
 * Call this when cutscene ends to ensure player isn't immediately in danger
 */
export function endCutsceneAndRepositionPlayer(boss) {
    if (!boss) {
        // No boss - just clear cutscene state
        gameState.cutsceneActive = false;
        gameState.cutsceneInvincible = false;
        return;
    }
    
    // Calculate safe position for player - opposite side of arena from boss
    const bossPos = boss.position;
    const dirFromBoss = new THREE.Vector3(0, 0, 1);  // Default: toward positive Z (front of arena)
    
    // If player exists, use direction away from boss
    if (player && player.position) {
        dirFromBoss.subVectors(player.position, bossPos);
        dirFromBoss.y = 0;
        if (dirFromBoss.lengthSq() > 0.1) {
            dirFromBoss.normalize();
        } else {
            // Player too close to boss - use default direction
            dirFromBoss.set(0, 0, 1);
        }
    }
    
    // Position player at safe distance from boss
    const safePos = new THREE.Vector3(
        bossPos.x + dirFromBoss.x * CUTSCENE_SAFE_DISTANCE,
        1,  // Player height
        bossPos.z + dirFromBoss.z * CUTSCENE_SAFE_DISTANCE
    );
    
    // Clamp to arena bounds (approximate - arenas are roughly 40-50 units radius)
    const maxRadius = 35;
    const distFromCenter = Math.sqrt(safePos.x * safePos.x + safePos.z * safePos.z);
    if (distFromCenter > maxRadius) {
        const scale = maxRadius / distFromCenter;
        safePos.x *= scale;
        safePos.z *= scale;
    }
    
    // Move player to safe position
    if (player && player.position) {
        player.position.copy(safePos);
        player.velocity.set(0, 0, 0);  // Clear any momentum
    }
    
    // Resume normal boss AI
    boss.aiState = 'idle';
    boss.aiTimer = 0;
    
    // Clear cutscene state
    gameState.cutsceneActive = false;
    
    // Brief invincibility buffer after cutscene (30 frames = 0.5 seconds)
    setTimeout(() => {
        gameState.cutsceneInvincible = false;
    }, 500);
}

// Helper to spawn intro minions around boss
export function spawnIntroMinions(boss, count = 3) {
    if (!boss) return [];
    
    const minions = [];
    const radius = 6;
    
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const spawnPos = new THREE.Vector3(
            boss.position.x + Math.cos(angle) * radius,
            1,
            boss.position.z + Math.sin(angle) * radius
        );
        
        // Spawn a grunt-type enemy for intro
        const minion = spawnSpecificEnemy('grunt', spawnPos);
        if (minion) {
            // Mark as intro minion (won't attack immediately)
            minion.isIntroMinion = true;
            minion.introTimer = 120;  // 2 seconds before becoming active
            minions.push(minion);
        }
    }
    
    return minions;
}

function startAbility(boss, ability) {
    boss.aiTimer = 0;
    boss.abilityCooldowns[ability] = ABILITY_COOLDOWNS[ability];
    
    switch (ability) {
        case 'charge':
            boss.aiState = 'wind_up';
            boss.bodyMaterial.emissiveIntensity = 1;
            boss.chargeMarker = null;  // Will be created on first frame
            // Porcupinefish: inflate during wind-up, reset wiggle
            if (boss.isPorcupinefish) {
                boss.targetInflation = 1.0;
                boss.wigglePhase = 0;
                boss.chargeDirLocked = false;
            }
            break;
        case 'summon':
            boss.aiState = 'summon';
            break;
        case 'jumpSlam':
            boss.aiState = 'jump_prep';
            boss.bodyMaterial.emissiveIntensity = 1;
            break;
        case 'hazards':
            boss.aiState = 'hazards';
            break;
        case 'teleport':
            boss.aiState = 'teleport_out';
            break;
        case 'growth':
            boss.aiState = 'growth';
            break;
        case 'split':
            if (!boss.hasSplit && boss.health < boss.maxHealth * 0.5) {
                boss.aiState = 'split';
            } else {
                boss.aiState = 'idle';  // Can't split yet
            }
            break;
        case 'burrow':
            boss.aiState = 'burrowing';
            break;
        case 'pillarPerch':
            if (boss.pillarPerchConfig && boss.abilityCooldowns.pillarPerch <= 0) {
                boss.aiState = 'pillar_leap';
                boss.aiTimer = 0;
            } else {
                boss.aiState = 'idle';
            }
            break;
        case 'laneWalls':
            boss.aiState = 'lane_walls_preview';
            boss.aiTimer = 0;
            boss.wallPreviews = [];
            break;
    }
}

function continueCurrentAbility(boss) {
    const tellDuration = getTellDuration(boss);
    
    switch (boss.aiState) {
        // CHARGE ABILITY
        case 'wind_up':
            // Create telegraph marker on first frame
            if (boss.aiTimer === 0) {
                // Demo mode: use safe direction for marker
                let dir;
                if (boss.inDemoMode && boss.demoChargeDir) {
                    dir = boss.demoChargeDir.clone();
                } else {
                    dir = tempVec3.subVectors(player.position, boss.position).normalize();
                    dir.y = 0;
                }
                boss.chargeMarker = createChargePathMarker(boss.position, dir, 15);
                
                // Audio cue for charge wind-up
                PulseMusic.onBossChargeWindup();
            }
            
            // Update marker
            if (boss.chargeMarker) {
                updateChargePathMarker(boss.chargeMarker, boss.aiTimer / tellDuration.charge);
            }
            
            // Porcupinefish: Wiggle animation during wind-up (offsets from base)
            if (boss.isPorcupinefish && boss.pufferBase) {
                boss.wigglePhase += 0.3;
                
                // Intensity ramps up toward lock-in
                const progress = boss.aiTimer / tellDuration.charge;
                const intensity = 0.5 + progress * 0.5;
                
                if (boss.pufferBody && boss.pufferBase.bodyRot) {
                    const br = boss.pufferBase.bodyRot;
                    boss.pufferBody.rotation.set(
                        br.x + Math.sin(boss.wigglePhase) * 0.1 * intensity,
                        br.y,
                        br.z + Math.cos(boss.wigglePhase * 0.7) * 0.08 * intensity
                    );
                }
                
                if (boss.pufferTail && boss.pufferBase.tailScale) {
                    const ts = boss.pufferBase.tailScale;
                    boss.pufferTail.scale.set(
                        ts.x * (1 + Math.sin(boss.wigglePhase * 2) * 0.3 * intensity),
                        ts.y,
                        ts.z
                    );
                }
            }
            
            // Charge lock-in moment (last ~6 frames before charging)
            const lockInFrames = 6;
            const framesUntilCharge = tellDuration.charge - boss.aiTimer;
            
            if (framesUntilCharge <= lockInFrames && boss.isPorcupinefish) {
                // Direction is now locked - store it if not already
                if (!boss.chargeDirLocked) {
                    boss.chargeDirLocked = true;
                    
                    // Demo mode: use safe direction
                    if (boss.inDemoMode && boss.demoChargeDir) {
                        boss.lockedChargeDir = boss.demoChargeDir.clone();
                    } else {
                        boss.lockedChargeDir = tempVec3.subVectors(player.position, boss.position).normalize().clone();
                        boss.lockedChargeDir.y = 0;
                    }
                    
                    // Visual flash for lock-in (gold flash on body)
                    if (boss.bodyMaterial) {
                        boss.bodyMaterial.emissive.setHex(0xffdd44);
                    }
                }
            }
            
            if (boss.aiTimer > tellDuration.charge) {
                boss.aiState = 'charging';
                
                // Demo mode: use safe direction (away from player)
                if (boss.inDemoMode && boss.demoChargeDir) {
                    boss.chargeDirection = boss.demoChargeDir.clone();
                }
                // Use locked direction if available (porcupinefish), otherwise calculate fresh
                else if (boss.chargeDirLocked && boss.lockedChargeDir) {
                    boss.chargeDirection = boss.lockedChargeDir.clone();
                } else {
                    boss.chargeDirection = tempVec3.subVectors(player.position, boss.position).normalize().clone();
                    boss.chargeDirection.y = 0;
                }
                
                // Skip corner protection in demo mode
                if (!boss.inDemoMode) {
                    // Corner trap protection: If player is near a corner, bias charge toward center
                    // This gives player an escape route instead of pinning them
                    const cornerDist = Math.min(
                        45 - Math.abs(player.position.x),
                        45 - Math.abs(player.position.z)
                    );
                    if (cornerDist < 8) {
                        const centerBias = new THREE.Vector3(-player.position.x, 0, -player.position.z)
                            .normalize().multiplyScalar(0.3);
                        boss.chargeDirection.add(centerBias).normalize();
                    }
                }
                
                boss.aiTimer = 0;
                
                // Cleanup marker
                if (boss.chargeMarker) {
                    cleanupVFX(boss.chargeMarker);
                    boss.chargeMarker = null;
                }
            }
            break;
        case 'charging':
            // Porcupinefish: BLAST deflation during charge (puffer releasing water)
            if (boss.isPorcupinefish) {
                boss.targetInflation = -0.3;  // Extra-small for dramatic blast effect (0.7x scale)
                boss.inflationSpeed = 0.2;    // Very fast deflation
                
                // Rate-limited bubble trail (not every frame)
                boss.bubbleAcc = (boss.bubbleAcc || 0) + 2;  // ~2 bubbles per frame budget
                while (boss.bubbleAcc >= 1) {
                    boss.bubbleAcc -= 1;
                    spawnBubbleParticle(boss);
                }
            }
            
            boss.position.add(boss.chargeDirection.clone().multiplyScalar(boss.chargeSpeed));
            
            // Red Puffer King P2+: Leave damage trails during charge
            if (gameState.currentArena === 1 && boss.phase >= 2) {
                const distFromLastTrail = boss.position.distanceTo(boss.lastChargeTrailPos);
                if (distFromLastTrail > 2.5 || boss.lastChargeTrailPos.length() === 0) {
                    // Drop a trail segment
                    const trail = createChargeTrailSegment(boss.position.clone(), boss.baseColor, 2.0);
                    boss.chargeTrails.push(trail);
                    boss.lastChargeTrailPos.copy(boss.position);
                }
            }
            
            if (boss.aiTimer > 50 || isOutOfBounds(boss)) {
                boss.aiState = 'cooldown';
                boss.aiTimer = 0;
                boss.bodyMaterial.emissiveIntensity = 0.5;
                clampBossPosition(boss);
                // Reset trail position for next charge
                boss.lastChargeTrailPos.set(0, 0, 0);
                
                // Porcupinefish: Reset visuals after charge ends
                resetPufferVisuals(boss);
                
                // End demo mode if active
                if (boss.inDemoMode) {
                    endDemoMode(boss);
                }
                
                // Boss 1: Set phase-based recovery timer for charge
                const config = BOSS_CONFIG[gameState.currentArena];
                if (gameState.currentArena === 1 && config.chargeRecovery) {
                    boss.chargeRecoveryTimer = config.chargeRecovery[`phase${boss.phase}`] || 30;
                }
            }
            break;
            
        // SUMMON ABILITY
        case 'summon':
            if (boss.aiTimer === Math.floor(tellDuration.summon)) {
                let summonCount = boss.phase + 1;
                
                // Boss 1 Phase 3: Apply summon cap (max 4 active minions)
                const config = BOSS_CONFIG[gameState.currentArena];
                if (gameState.currentArena === 1 && boss.phase >= 3) {
                    const summonCap = config.phaseBehavior?.[3]?.summonCap || 4;
                    const currentMinions = boss.summonedMinions?.filter(m => m && m.parent).length || 0;
                    summonCount = Math.min(summonCount, Math.max(0, summonCap - currentMinions));
                    
                    // If already at cap, skip summon entirely
                    if (summonCount <= 0) {
                        boss.aiState = 'idle';
                        boss.aiTimer = 0;
                        break;
                    }
                }
                
                // Activate shield if configured
                if (boss.shieldConfig && boss.shieldConfig.activateOnSummon) {
                    boss.shieldActive = true;
                    boss.shieldStartTime = Date.now();  // Track for failsafe timeout
                    if (boss.shieldMesh) {
                        boss.shieldMesh.visible = true;
                    }
                    // Trigger porcupinefish inflation bristle effect
                    if (boss.isPorcupinefish) {
                        triggerSpineBristle(boss);
                    }
                    // Clear previous minions array (only if not Phase 3 with cap)
                    if (!(gameState.currentArena === 1 && boss.phase >= 3)) {
                        boss.summonedMinions = [];
                    }
                    
                    // Tutorial callout for Arena 1 - explain shield mechanic to new players
                    if (gameState.currentArena === 1) {
                        showTutorialCallout('bossShield', 'SHIELD ACTIVE - Kill minions to break it!', 3000);
                    }
                    
                    // Audio cue for shield activation
                    PulseMusic.onBossShieldActivate();
                }
                
                // Red Puffer King P3: Ring summon around PLAYER with inward arrows
                const isRedPufferKingP3 = gameState.currentArena === 1 && boss.phase >= 3;
                const spawnCenter = isRedPufferKingP3 ? player.position : boss.position;
                const spawnRadius = isRedPufferKingP3 ? 10 : 4 + Math.random() * 2;
                
                // Red Puffer King P3: Brief spawn freeze - boss pauses while summoning
                if (isRedPufferKingP3) {
                    boss.summonFreeze = true;
                    boss.summonFreezeTimer = 60; // 1 second freeze
                }
                
                for (let i = 0; i < summonCount; i++) {
                    // Arena-aware minion spawning - spawn what player has learned
                    let enemyType;
                    if (gameState.currentArena === 1) {
                        // Arena 1: Only grunts (what player has learned)
                        enemyType = 'grunt';
                    } else if (boss.abilities.teleport && Math.random() < 0.3) {
                        // Later arenas with teleport: chance to spawn teleporters
                        enemyType = 'teleporter';
                    } else {
                        // Default: fastBouncers
                        enemyType = 'fastBouncer';
                    }
                    
                    // Position minions in ring formation
                    const spawnAngle = (i / summonCount) * Math.PI * 2;
                    const spawnPos = new THREE.Vector3(
                        spawnCenter.x + Math.cos(spawnAngle) * spawnRadius,
                        boss.position.y,
                        spawnCenter.z + Math.sin(spawnAngle) * spawnRadius
                    );
                    const minion = spawnSpecificEnemy(enemyType, spawnPos);
                    
                    // Red Puffer King P3: Create inward arrow indicator
                    if (isRedPufferKingP3 && minion) {
                        // Point minion toward center (player position)
                        const toCenter = new THREE.Vector3()
                            .subVectors(spawnCenter, spawnPos)
                            .normalize();
                        minion.rotation.y = Math.atan2(toCenter.x, toCenter.z);
                    }
                    
                    // Track minion for shield system (when shield is active OR activateOnSummon is true)
                    if (boss.shieldConfig && (boss.shieldActive || boss.shieldConfig.activateOnSummon)) {
                        minion.isBossMinion = true;
                        minion.parentBoss = boss;
                        
                        // Phase 3: Summons are 30% squishier (easier to clear while boss fights)
                        if (boss.phase >= 3) {
                            minion.health *= 0.7;
                            minion.maxHealth *= 0.7;
                        }
                        
                        // Enrage timer: +5% speed/sec after 8 seconds, capped at +40%
                        minion.enrageStartTime = Date.now();
                        minion.enrageDelay = 8000;   // 8 seconds before enrage starts
                        minion.enrageRate = 0.05;    // 5% per second
                        minion.enrageCap = 0.4;      // Max 40% speed boost
                        minion.baseSpeed = minion.speed;
                        
                        boss.summonedMinions.push(minion);
                        
                        // Create visible tether from boss to minion
                        const tether = createMinionTether(boss, minion, boss.baseColor);
                        minion.tether = tether;  // Store reference on minion
                        boss.minionTethers.push(tether);
                    }
                }
                spawnParticle(boss.position, boss.baseColor, 10);
            }
            if (boss.aiTimer > tellDuration.summon + 20) {
                boss.aiState = 'idle';
                boss.aiTimer = 0;
            }
            break;
            
        // JUMP SLAM ABILITY
        case 'jump_prep':
            if (boss.aiTimer > tellDuration.jumpSlam) {
                boss.aiState = 'jumping';
                boss.velocityY = 0.45;
                boss.jumpTarget.copy(player.position);
                boss.aiTimer = 0;
            }
            break;
        case 'jumping':
            tempVec3.subVectors(boss.jumpTarget, boss.position);
            tempVec3.y = 0;
            tempVec3.normalize();
            boss.position.add(tempVec3.multiplyScalar(0.15));
            
            // FIX: Changed velocityY < 0 to velocityY <= 0 to handle race condition
            // where gravity resets velocityY to 0 when boss hits ground
            if (boss.position.y <= boss.size * boss.growthScale + 0.1 && boss.velocityY <= 0) {
                boss.aiState = 'landed';
                boss.aiTimer = 0;
                boss.bodyMaterial.emissiveIntensity = 0.5;
                // Damage nearby player
                if (player.position.distanceTo(boss.position) < 6) {
                    const config = BOSS_CONFIG[gameState.currentArena];
                    takeDamage(boss.damage * 0.6, `${config?.name || 'Boss'} - Jump Slam`, 'boss');
                }
                // Create hazard if boss has hazards ability (respects hazard budget)
                if (boss.abilities.hazards && canCreateMoreHazards(4)) {
                    createHazardZone(boss.position.x, boss.position.z, 4, 400);
                }
                spawnParticle(boss.position, boss.baseColor, 25);
            }
            break;
        case 'landed':
            if (boss.aiTimer > 40) {
                boss.aiState = 'idle';
                boss.aiTimer = 0;
            }
            break;
            
        // HAZARDS ABILITY
        case 'hazards':
            // Create preview markers on first frame
            if (boss.aiTimer === 0) {
                boss.hazardPreviews = [];
                const hazardCount = boss.phase + 1;
                const placedPositions = [];
                const radius = 2 + boss.phase * 0.5;
                
                // Monolith P2+: Lane hazards (grid-aligned)
                const isMonolithP2 = gameState.currentArena === 2 && boss.phase >= 2;
                
                for (let i = 0; i < hazardCount; i++) {
                    let hazardPos = null;
                    let attempts = 0;
                    
                    // Try to find a valid position that doesn't overlap and doesn't block all routes
                    while (!hazardPos && attempts < 10) {
                        let testPos;
                        
                        if (isMonolithP2) {
                            // Lane-based placement: snap to grid lines
                            const laneSpacing = 10;
                            const lanes = [-20, -10, 0, 10, 20];
                            const playerLaneX = lanes.reduce((prev, curr) => 
                                Math.abs(curr - player.position.x) < Math.abs(prev - player.position.x) ? curr : prev
                            );
                            const playerLaneZ = lanes.reduce((prev, curr) => 
                                Math.abs(curr - player.position.z) < Math.abs(prev - player.position.z) ? curr : prev
                            );
                            
                            // Alternate between X-axis and Z-axis lanes
                            if (i % 2 === 0) {
                                // X-axis lane (same X as player, offset Z)
                                const offsetZ = (i - hazardCount / 2) * laneSpacing;
                                testPos = new THREE.Vector3(playerLaneX, 0, player.position.z + offsetZ);
                            } else {
                                // Z-axis lane (same Z as player, offset X)
                                const offsetX = (i - hazardCount / 2) * laneSpacing;
                                testPos = new THREE.Vector3(player.position.x + offsetX, 0, playerLaneZ);
                            }
                            
                            // Clamp to arena bounds
                            testPos.x = Math.max(-40, Math.min(40, testPos.x));
                            testPos.z = Math.max(-40, Math.min(40, testPos.z));
                        } else {
                            // Random placement (original behavior)
                            const angle = Math.random() * Math.PI * 2;
                            const dist = 5 + Math.random() * 10;
                            testPos = new THREE.Vector3(
                                boss.position.x + Math.cos(angle) * dist,
                                0,
                                boss.position.z + Math.sin(angle) * dist
                            );
                        }
                        
                        // Validate position
                        const overlapping = isPositionOverlappingHazards(testPos, placedPositions, radius * 2 + 2);
                        const blocking = isBlockingAllRoutes(testPos, radius);
                        
                        if (!overlapping && !blocking) {
                            hazardPos = testPos;
                            placedPositions.push(testPos);
                        }
                        attempts++;
                    }
                    
                    // If we found a valid position, create preview
                    if (hazardPos) {
                        const preview = createHazardPreviewCircle(hazardPos, radius);
                        boss.hazardPreviews.push({ preview, pos: hazardPos, radius });
                    }
                }
                
                // Monolith P3: Mark existing hazards for detonation
                if (gameState.currentArena === 2 && boss.phase >= 3) {
                    boss.detonationPending = true;
                    boss.detonationTimer = 90; // 1.5 second warning
                    // Store references to existing hazards for detonation
                    boss.detonationTargets = hazardZones.slice(); // Copy current hazards
                }
            }
            
            // Update preview markers
            if (boss.hazardPreviews) {
                boss.hazardPreviews.forEach(hp => updateHazardPreviewCircle(hp.preview));
            }
            
            // Monolith P3: Update detonation warning VFX
            if (boss.detonationPending && boss.detonationWarnings) {
                const progress = 1 - (boss.detonationTimer / 90);
                boss.detonationWarnings.forEach(vfx => updateDetonationWarningVFX(vfx, progress));
            }
            
            // Spawn actual hazards (respects hazard budget)
            if (boss.aiTimer === Math.floor(tellDuration.hazards)) {
                if (boss.hazardPreviews) {
                    boss.hazardPreviews.forEach(hp => {
                        // Only create hazard if within budget
                        if (canCreateMoreHazards(hp.radius)) {
                            createHazardZone(hp.pos.x, hp.pos.z, hp.radius, 300);
                        }
                        cleanupVFX(hp.preview);
                    });
                    boss.hazardPreviews = null;
                }
                
                // Monolith P3: Create detonation warnings for existing hazards
                if (boss.detonationPending && boss.detonationTargets) {
                    boss.detonationWarnings = [];
                    for (const hazard of boss.detonationTargets) {
                        if (hazard && hazard.parent) {
                            const detonationRadius = hazard.radius * 3;
                            const warning = createDetonationWarningVFX(
                                hazard.position.clone(),
                                hazard.radius,
                                detonationRadius
                            );
                            warning.targetHazard = hazard;
                            boss.detonationWarnings.push(warning);
                        }
                    }
                }
            }
            
            // Monolith P3: Execute detonation
            if (boss.detonationPending && boss.detonationTimer !== undefined) {
                boss.detonationTimer--;
                
                if (boss.detonationTimer <= 0) {
                    // Detonate all marked hazards - expand to 3x radius
                    if (boss.detonationWarnings) {
                        for (const warning of boss.detonationWarnings) {
                            if (warning.targetHazard && warning.targetHazard.parent) {
                                const hazard = warning.targetHazard;
                                const expandedRadius = hazard.radius * 3;
                                
                                // Check player collision with expanded radius
                                const distToPlayer = hazard.position.distanceTo(player.position);
                                if (distToPlayer < expandedRadius) {
                                    const now = Date.now();
                                    if (now - lastDamageTime > DAMAGE_COOLDOWN) {
                                        takeDamage(1.5, 'Hazard Detonation', 'hazard');
                                        setLastDamageTime(now);
                                    }
                                }
                                
                                // Visual burst
                                spawnParticle(hazard.position, 0xff8844, 15);
                            }
                            cleanupVFX(warning);
                        }
                        boss.detonationWarnings = null;
                    }
                    
                    boss.detonationPending = false;
                    boss.detonationTargets = null;
                }
            }
            
            if (boss.aiTimer > tellDuration.hazards + 30) {
                // Cleanup any remaining previews
                if (boss.hazardPreviews) {
                    boss.hazardPreviews.forEach(hp => cleanupVFX(hp.preview));
                    boss.hazardPreviews = null;
                }
                // Cleanup any remaining detonation warnings
                if (boss.detonationWarnings) {
                    boss.detonationWarnings.forEach(vfx => cleanupVFX(vfx));
                    boss.detonationWarnings = null;
                }
                boss.detonationPending = false;
                boss.aiState = 'idle';
                boss.aiTimer = 0;
            }
            break;
            
        // TELEPORT ABILITY
        case 'teleport_out':
            // Origin shimmer effect
            if (boss.aiTimer === 0) {
                boss.teleportOriginVFX = createTeleportOriginVFX(boss.position);
                PulseMusic.onTeleport(false);
                
                // Ascendant P3: Start blink barrage sequence
                if (gameState.currentArena === 3 && boss.phase >= 3 && !boss.blinkBarrageActive) {
                    boss.blinkBarrageActive = true;
                    boss.blinkBarrageIndex = 0;
                    boss.blinkBarragePositions = [];
                    boss.blinkBarrageMarkers = [];
                    
                    // Pre-generate 3 teleport positions and show markers
                    for (let i = 0; i < 3; i++) {
                        const pos = getValidTeleportDestination(boss);
                        // Offset each position to avoid overlap
                        pos.x += (i - 1) * 8;
                        pos.z += (Math.random() - 0.5) * 10;
                        boss.blinkBarragePositions.push(pos);
                        
                        const marker = createBlinkBarrageMarker(pos, i + 1);
                        boss.blinkBarrageMarkers.push(marker);
                    }
                }
            }
            
            // Ascendant: Update blink barrage markers
            if (boss.blinkBarrageMarkers) {
                boss.blinkBarrageMarkers.forEach(m => updateBlinkBarrageMarker(m));
            }
            
            boss.scale.setScalar(Math.max(0.01, 1 - boss.aiTimer / tellDuration.teleport));
            
            if (boss.aiTimer > tellDuration.teleport) {
                // Ascendant P2+: Create decoy markers alongside real destination
                const isAscendantP2 = gameState.currentArena === 3 && boss.phase >= 2;
                
                let destPos;
                
                // Ascendant P3: Use blink barrage positions
                if (boss.blinkBarrageActive && boss.blinkBarragePositions) {
                    destPos = boss.blinkBarragePositions[boss.blinkBarrageIndex];
                    
                    // Remove the marker for this position
                    if (boss.blinkBarrageMarkers[boss.blinkBarrageIndex]) {
                        cleanupVFX(boss.blinkBarrageMarkers[boss.blinkBarrageIndex]);
                        boss.blinkBarrageMarkers[boss.blinkBarrageIndex] = null;
                    }
                    
                    boss.blinkBarrageIndex++;
                } else {
                    destPos = getValidTeleportDestination(boss);
                }
                
                // Ascendant P2: Create decoys (not during blink barrage)
                if (isAscendantP2 && !boss.blinkBarrageActive) {
                    boss.teleportDecoys = [];
                    
                    // Create 2 fake decoys
                    for (let i = 0; i < 2; i++) {
                        const fakePos = getValidTeleportDestination(boss);
                        // Offset to spread them out
                        fakePos.x += (Math.random() - 0.5) * 15;
                        fakePos.z += (Math.random() - 0.5) * 15;
                        const decoy = createTeleportDecoy(fakePos, false);
                        boss.teleportDecoys.push(decoy);
                    }
                    
                    // Create real marker with distinct visual
                    const realDecoy = createTeleportDecoy(destPos, true);
                    boss.teleportDecoys.push(realDecoy);
                    
                    // Play higher pitch audio for real destination
                    PulseMusic.onTeleportReal?.();
                } else {
                    // Normal destination marker (or blink barrage)
                    boss.teleportDestVFX = createTeleportDestinationVFX(destPos);
                }
                
                // Cleanup origin VFX
                if (boss.teleportOriginVFX) {
                    cleanupVFX(boss.teleportOriginVFX);
                    boss.teleportOriginVFX = null;
                }
                
                // Move boss
                boss.position.copy(destPos);
                boss.aiState = 'teleport_in';
                boss.aiTimer = 0;
                PulseMusic.onTeleport(true);
                spawnParticle(boss.position, 0xaa44ff, 15);
            }
            break;
        case 'teleport_in':
            // Update destination VFX
            if (boss.teleportDestVFX) {
                updateTeleportDestinationVFX(boss.teleportDestVFX);
            }
            
            // Update decoys
            if (boss.teleportDecoys) {
                boss.teleportDecoys.forEach(d => updateTeleportDecoy(d));
            }
            
            boss.scale.setScalar(Math.min(1, boss.aiTimer / 20));
            
            if (boss.aiTimer > 20) {
                boss.scale.setScalar(1);
                
                // Cleanup destination VFX
                if (boss.teleportDestVFX) {
                    cleanupVFX(boss.teleportDestVFX);
                    boss.teleportDestVFX = null;
                }
                
                // Cleanup decoys
                if (boss.teleportDecoys) {
                    boss.teleportDecoys.forEach(d => cleanupVFX(d));
                    boss.teleportDecoys = null;
                }
                
                // Ascendant P3: Continue blink barrage
                if (boss.blinkBarrageActive && boss.blinkBarrageIndex < 3) {
                    // Brief pause then teleport again
                    boss.aiState = 'teleport_out';
                    boss.aiTimer = Math.floor(tellDuration.teleport * 0.5);  // Faster subsequent teleports
                    return;
                } else if (boss.blinkBarrageActive) {
                    // Blink barrage complete - cleanup remaining markers
                    if (boss.blinkBarrageMarkers) {
                        boss.blinkBarrageMarkers.forEach(m => { if (m) cleanupVFX(m); });
                        boss.blinkBarrageMarkers = null;
                    }
                    boss.blinkBarrageActive = false;
                    boss.blinkBarragePositions = null;
                    boss.blinkBarrageIndex = 0;
                }
                
                // Enter vulnerability window (Boss 3+)
                if (boss.teleportConfig && boss.teleportConfig.vulnerabilityWindow) {
                    boss.isVulnerable = true;
                    boss.vulnerableTimer = boss.teleportConfig.vulnerabilityWindow;
                    if (!boss.exposedVFX) {
                        boss.exposedVFX = createExposedVFX(boss);
                    }
                }
                
                // Spawn teleporter minion in higher phases (capped at 2 max)
                if (boss.phase >= 2 && Math.random() < 0.4) {
                    const activeTeleporters = enemies.filter(e => e.enemyType === 'teleporter').length;
                    const maxTeleporters = 2;
                    
                    if (activeTeleporters < maxTeleporters) {
                        spawnSpecificEnemy('teleporter', boss.position);
                    }
                }
                
                boss.aiState = boss.teleportConfig?.vulnerabilityWindow ? 'teleport_recovery' : 'idle';
                boss.aiTimer = 0;
            }
            break;
            
        case 'teleport_recovery':
            if (boss.isVulnerable) {
                // Show "EXPOSED!" banner and audio cue on first frame
                if (boss.vulnerableTimer === boss.teleportConfig.vulnerabilityWindow) {
                    showExposedBanner(boss.teleportConfig.vulnerabilityWindow);
                    PulseMusic.onBossExposed();
                }
                
                boss.vulnerableTimer--;
                if (boss.exposedVFX) {
                    updateExposedVFX(boss.exposedVFX, boss.vulnerableTimer);
                }
                
                // Faster, more distinct flash with yellow highlight (attack opportunity)
                if (boss.bodyMaterial) {
                    const flashSpeed = 6;  // Faster than previous 10
                    if (boss.vulnerableTimer % flashSpeed < flashSpeed / 2) {
                        boss.bodyMaterial.emissive.setHex(0xffff00);  // Yellow = vulnerable
                        boss.bodyMaterial.emissiveIntensity = 1.0;
                    } else {
                        boss.bodyMaterial.emissive.setHex(boss.baseColor);
                        boss.bodyMaterial.emissiveIntensity = 0.4;
                    }
                }
                
                if (boss.vulnerableTimer <= 0) {
                    boss.isVulnerable = false;
                    if (boss.exposedVFX) {
                        cleanupVFX(boss.exposedVFX);
                        boss.exposedVFX = null;
                    }
                    if (boss.bodyMaterial) {
                        boss.bodyMaterial.emissive.setHex(boss.baseColor);
                        boss.bodyMaterial.emissiveIntensity = 0.5;
                    }
                    boss.aiState = 'idle';
                    boss.aiTimer = 0;
                }
            } else {
                boss.aiState = 'idle';
                boss.aiTimer = 0;
            }
            break;
            
        // GROWTH ABILITY
        case 'growth':
            // Create growth indicator on first frame
            if (boss.aiTimer === 0) {
                boss.growthIndicator = createGrowthIndicator(boss);
                PulseMusic.onBossGrowthStart();
                
                // Overgrowth P2+: Create vine DOT zones around boss
                if (gameState.currentArena === 4 && boss.phase >= 2) {
                    const vineCount = boss.phase >= 3 ? 4 : 2;
                    const vineRadius = 3;
                    
                    for (let i = 0; i < vineCount; i++) {
                        const angle = (i / vineCount) * Math.PI * 2 + Math.random() * 0.5;
                        const dist = 5 + Math.random() * 3;
                        const vinePos = new THREE.Vector3(
                            boss.position.x + Math.cos(angle) * dist,
                            0,
                            boss.position.z + Math.sin(angle) * dist
                        );
                        
                        const vineZone = createVineZone(vinePos, vineRadius, 5.0);
                        boss.vineZones.push(vineZone);
                    }
                }
            }
            
            // Arena 6: smaller max growth (1.25) to prevent corridor blocking
            const maxGrowth = gameState.currentArena === 6 ? 1.25 : 1.5;
            
            if (boss.growthScale < maxGrowth) {
                boss.growthScale += 0.003;
                boss.scale.setScalar(boss.growthScale);
                
                // Update growth indicator
                if (boss.growthIndicator) {
                    updateGrowthIndicator(boss.growthIndicator, boss.growthScale, boss);
                }
                
                // Pulsing glow during growth
                if (boss.bodyMaterial) {
                    boss.bodyMaterial.emissiveIntensity = 0.5 + Math.sin(boss.aiTimer * 0.2) * 0.3;
                }
            }
            
            // Spawn water balloons during growth (with cap)
            if (boss.aiTimer % 60 === 0 && boss.aiTimer > 0) {
                // Cap water balloons at 2 during growth
                const activeWaterBalloons = enemies.filter(e => e.enemyType === 'waterBalloon').length;
                if (activeWaterBalloons < 2) {
                    spawnSpecificEnemy('waterBalloon', boss.position);
                }
            }
            
            if (boss.aiTimer > 120) {
                // Cleanup growth indicator
                if (boss.growthIndicator) {
                    cleanupVFX(boss.growthIndicator);
                    boss.growthIndicator = null;
                }
                if (boss.bodyMaterial) {
                    boss.bodyMaterial.emissiveIntensity = 0.5;
                }
                boss.aiState = 'idle';
                boss.aiTimer = 0;
            }
            break;
            
        // SPLIT ABILITY
        case 'split':
            // Create split warning VFX on first frame
            if (boss.aiTimer === 0) {
                boss.splitWarning = createSplitWarningVFX(boss);
                boss.originalPosition = boss.position.clone();
                PulseMusic.onBossSplitWarning();
            }
            
            // Update warning VFX
            if (boss.splitWarning) {
                updateSplitWarningVFX(boss.splitWarning, boss.aiTimer, tellDuration.split, boss);
            }
            
            // Boss shakes during split preparation (intensity increases)
            const shakeProgress = boss.aiTimer / tellDuration.split;
            const shakeIntensity = 0.05 + shakeProgress * 0.15;
            if (boss.originalPosition) {
                boss.position.x = boss.originalPosition.x + (Math.random() - 0.5) * shakeIntensity;
                boss.position.z = boss.originalPosition.z + (Math.random() - 0.5) * shakeIntensity;
            }
            
            // Flash body material as split approaches
            if (boss.bodyMaterial) {
                const flashSpeed = 4 + shakeProgress * 8;
                if (boss.aiTimer % Math.max(2, Math.floor(6 - shakeProgress * 4)) < Math.floor((6 - shakeProgress * 4) / 2)) {
                    boss.bodyMaterial.emissiveIntensity = 0.8 + shakeProgress * 0.4;
                } else {
                    boss.bodyMaterial.emissiveIntensity = 0.4;
                }
            }
            
            if (boss.aiTimer === Math.floor(tellDuration.split)) {
                boss.hasSplit = true;
                
                // Arena 6: spawn fewer, weaker mini-bosses to reduce cognitive load
                const miniBossCount = gameState.currentArena === 6 ? 2 : 3;
                const miniBossHealth = gameState.currentArena === 6 ? 100 : 150;
                const miniBossSimple = gameState.currentArena === 6;  // No special behaviors
                
                // Spawn mini-bosses with improved spacing
                for (let i = 0; i < miniBossCount; i++) {
                    spawnMiniBoss(boss.position, i, miniBossCount, miniBossHealth, miniBossSimple);
                }
                
                // Cleanup warning VFX
                if (boss.splitWarning) {
                    cleanupVFX(boss.splitWarning);
                    boss.splitWarning = null;
                }
                
                // Reset position
                if (boss.originalPosition) {
                    boss.position.copy(boss.originalPosition);
                    boss.originalPosition = null;
                }
                
                // Reset material
                if (boss.bodyMaterial) {
                    boss.bodyMaterial.emissiveIntensity = 0.5;
                }
                
                PulseMusic.onBossSplit();
                spawnParticle(boss.position, boss.baseColor, 25);
            }
            
            if (boss.aiTimer > tellDuration.split + 30) {
                boss.aiState = 'idle';
                boss.aiTimer = 0;
            }
            break;
            
        // BURROW ABILITY
        case 'burrowing':
            // Create burrow start VFX on first frame
            if (boss.aiTimer === 0) {
                boss.burrowStartVFX = createBurrowStartVFX(boss);
                PulseMusic.onBurrowStart();
            }
            
            boss.position.y -= 0.1;
            
            // Update burrow start VFX
            if (boss.burrowStartVFX) {
                updateBurrowStartVFX(boss.burrowStartVFX, boss.position.y);
            }
            
            if (boss.position.y < -2) {
                // Cleanup burrow start VFX
                if (boss.burrowStartVFX) {
                    cleanupVFX(boss.burrowStartVFX);
                    boss.burrowStartVFX = null;
                }
                
                // Calculate emerge position with corridor awareness
                const emergeTarget = calculateEmergeTarget(boss, player.position);
                boss.burrowTarget.copy(emergeTarget);
                boss.burrowTarget.y = boss.size * boss.growthScale;
                
                // Burrower P3: Create visible travel path
                if (gameState.currentArena === 5 && boss.phase >= 3) {
                    boss.burrowPath = createBurrowPath(boss.position.clone(), boss.burrowTarget);
                }
                
                // Start emerge warning
                boss.aiState = 'emerge_warning';
                boss.aiTimer = 0;
                
                // Create warning VFX at emerge location
                boss.emergeWarningVFX = createEmergeWarningVFX(boss.burrowTarget);
                PulseMusic.onBurrowWarning();
            }
            break;
            
        case 'emerge_warning':
            // Burrower P2+: Create fake emerge markers on first frame
            if (boss.aiTimer === 0 && gameState.currentArena === 5 && boss.phase >= 2) {
                boss.fakeEmergeMarkers = [];
                const fakeCount = boss.phase >= 3 ? 3 : 2;
                
                for (let i = 0; i < fakeCount; i++) {
                    // Position fake markers at random locations
                    const fakePos = new THREE.Vector3(
                        player.position.x + (Math.random() - 0.5) * 20,
                        0,
                        player.position.z + (Math.random() - 0.5) * 20
                    );
                    
                    // Don't place fake too close to real
                    if (fakePos.distanceTo(boss.burrowTarget) > 8) {
                        const fakeMarker = createFakeEmergeMarker(fakePos);
                        boss.fakeEmergeMarkers.push(fakeMarker);
                    }
                }
                
                // Note: Real marker already has audio cue (onBurrowWarning), fakes are silent
            }
            
            // Update warning VFX
            if (boss.emergeWarningVFX) {
                updateEmergeWarningVFX(boss.emergeWarningVFX, boss.aiTimer);
            }
            
            // Update fake markers
            if (boss.fakeEmergeMarkers) {
                boss.fakeEmergeMarkers.forEach(m => updateFakeEmergeMarker(m));
            }
            
            // Update burrow path (P3)
            if (boss.burrowPath) {
                updateBurrowPath(boss.burrowPath);
            }
            
            const warningTime = boss.burrowConfig?.emergeWarningTime || 45;
            if (boss.aiTimer > warningTime) {
                // Move to emerge position
                boss.position.x = boss.burrowTarget.x;
                boss.position.z = boss.burrowTarget.z;
                boss.aiState = 'emerging';
                boss.aiTimer = 0;
                
                // Cleanup warning VFX
                if (boss.emergeWarningVFX) {
                    cleanupVFX(boss.emergeWarningVFX);
                    boss.emergeWarningVFX = null;
                }
                
                // Cleanup fake markers
                if (boss.fakeEmergeMarkers) {
                    boss.fakeEmergeMarkers.forEach(m => cleanupVFX(m));
                    boss.fakeEmergeMarkers = null;
                }
                
                // Cleanup burrow path
                if (boss.burrowPath) {
                    cleanupVFX(boss.burrowPath);
                    boss.burrowPath = null;
                }
            }
            break;
            
        case 'emerging':
            boss.position.y += 0.2;
            
            // Dust plume VFX
            if (boss.aiTimer === 0) {
                spawnParticle(boss.position, 0x886644, 15);
            }
            
            if (boss.position.y >= boss.size * boss.growthScale) {
                boss.position.y = boss.size * boss.growthScale;
                boss.aiState = 'idle';
                boss.aiTimer = 0;
                
                PulseMusic.onBurrowEmerge();
                
                // Damage player if nearby
                const emergeDamageRadius = boss.burrowConfig?.emergeDamageRadius || 5;
                if (player.position.distanceTo(boss.position) < emergeDamageRadius) {
                    const config = BOSS_CONFIG[gameState.currentArena];
                    takeDamage(boss.damage * 0.8, `${config?.name || 'Boss'} - Burrow Emerge`, 'boss');
                }
                
                // Create temporary hazard on emerge (Boss 5 hazard preview)
                // Only create if within global hazard budget
                if (boss.burrowConfig?.emergeHazard?.enabled) {
                    const hazardRadius = boss.burrowConfig.emergeHazard.radius;
                    
                    // Check both local coverage and global budget
                    const localCoverage = calculateHazardCoverage(
                        boss.position.x, 
                        boss.position.z,
                        10  // Check 10-unit radius for hazard density
                    );
                    
                    // Only create hazard if within both local and global budgets
                    if (localCoverage < 0.3 && canCreateMoreHazards(hazardRadius)) {
                        createHazardZone(
                            boss.position.x, 
                            boss.position.z,
                            hazardRadius,
                            boss.burrowConfig.emergeHazard.duration
                        );
                    }
                }
                
                spawnParticle(boss.position, boss.baseColor, 20);
            }
            break;
            
        // ORBIT STRAFE (Boss 1 movement pattern)
        case 'orbit':
            const playerDist = boss.position.distanceTo(player.position);
            const idealDist = 8;
            
            // Calculate perpendicular direction for strafing
            tempVec3.subVectors(player.position, boss.position);
            tempVec3.y = 0;
            tempVec3.normalize();
            
            // Perpendicular strafe
            const strafeX = -tempVec3.z * boss.orbitDirection;
            const strafeZ = tempVec3.x * boss.orbitDirection;
            
            // Distance adjustment (move closer or farther to maintain ideal distance)
            const distAdjust = (playerDist - idealDist) * 0.02;
            
            // Apply movement
            boss.position.x += strafeX * boss.speed * 1.2 + tempVec3.x * distAdjust;
            boss.position.z += strafeZ * boss.speed * 1.2 + tempVec3.z * distAdjust;
            clampBossPosition(boss);
            
            boss.orbitTimer++;
            if (boss.orbitTimer > 120) {
                boss.aiState = 'idle';
                boss.aiTimer = 0;
            }
            break;
            
        // RETREAT CHARGE (Boss 1 movement pattern)
        case 'retreat_charge':
            switch (boss.retreatState) {
                case 'retreating':
                    // Move away from player
                    tempVec3.subVectors(boss.position, player.position);
                    tempVec3.y = 0;
                    tempVec3.normalize();
                    boss.position.add(tempVec3.multiplyScalar(boss.speed * 1.5));
                    clampBossPosition(boss);
                    
                    boss.retreatTimer++;
                    if (boss.retreatTimer > 40) {
                        boss.retreatState = 'winding';
                        boss.retreatTimer = 0;
                    }
                    break;
                    
                case 'winding':
                    // Wind up (telegraph)
                    boss.bodyMaterial.emissiveIntensity = 
                        0.5 + (boss.retreatTimer / 30) * 0.5;
                    boss.retreatTimer++;
                    if (boss.retreatTimer > 30) {
                        boss.retreatState = 'charging';
                        boss.retreatTimer = 0;
                        boss.chargeDirection = tempVec3.subVectors(
                            player.position, 
                            boss.position
                        ).normalize().clone();
                    }
                    break;
                    
                case 'charging':
                    // Fast charge
                    boss.position.add(
                        boss.chargeDirection.clone()
                            .multiplyScalar(boss.chargeSpeed * 1.2)
                    );
                    boss.retreatTimer++;
                    if (boss.retreatTimer > 50 || isOutOfBounds(boss)) {
                        boss.aiState = 'cooldown';
                        boss.aiTimer = 0;
                        boss.bodyMaterial.emissiveIntensity = 0.5;
                        clampBossPosition(boss);
                        boss.retreatState = null;
                    }
                    break;
            }
            break;
            
        // STATIC SHIELDED (Boss 1 Phase 2)
        case 'static_shielded':
            // Boss stays mostly stationary, only rotating to face player
            const staticDx = player.position.x - boss.position.x;
            const staticDz = player.position.z - boss.position.z;
            const staticTargetAngle = Math.atan2(staticDz, staticDx);
            boss.rotation.y = staticTargetAngle;
            
            // Check if shield should be reactivated after exposed window
            if (!boss.shieldActive && !boss.isExposed && boss.summonedMinions.length === 0) {
                // Reactivate shield and prepare to summon again
                boss.shieldActive = true;
                boss.shieldStartTime = Date.now();
                if (boss.shieldMesh) {
                    boss.shieldMesh.visible = true;
                }
                // Trigger porcupinefish inflation bristle effect
                if (boss.isPorcupinefish) {
                    triggerSpineBristle(boss);
                }
                boss.summonTimer = 180;  // Short delay before next summon (3 seconds)
            }
            
            // Summon minions periodically when shield is active (every 4 seconds)
            if (boss.shieldActive) {
                if (!boss.summonTimer) boss.summonTimer = 0;
                boss.summonTimer++;
                
                if (boss.summonTimer >= 240 && boss.abilityCooldowns.summon <= 0) {
                    boss.summonTimer = 0;
                    startAbility(boss, 'summon');
                }
            }
            
            // Stay in this state until Phase 3 transition
            break;
        
        // CUTSCENE IDLE (during boss intro and phase transitions)
        case 'cutscene_idle':
            // Boss does nothing during cutscenes - AI is suspended
            // Just face toward player slowly for visual interest
            const cutsceneDx = player.position.x - boss.position.x;
            const cutsceneDz = player.position.z - boss.position.z;
            const cutsceneTargetAngle = Math.atan2(cutsceneDx, cutsceneDz);
            const cutsceneDiff = Math.atan2(Math.sin(cutsceneTargetAngle - boss.rotation.y), Math.cos(cutsceneTargetAngle - boss.rotation.y));
            boss.rotation.y += cutsceneDiff * 0.02;  // Very slow turn
            break;
            
        // PILLAR PERCH + SLAM (Boss 2)
        case 'pillar_leap':
            // Find suitable pillar (tall ones)
            const targetPillar = findNearestTallPillar(boss, 15);
            if (!targetPillar) {
                boss.aiState = 'idle';
                break;
            }
            
            // Vertical streak trail VFX (simple particle trail)
            spawnParticle(boss.position, 0xffffff, 5);
            
            // Jump to pillar top
            boss.velocityY = 0.5;
            boss.pillarTarget = targetPillar;
            boss.aiState = 'pillar_rising';
            break;
            
        case 'pillar_rising':
            // Arc toward pillar top
            if (boss.pillarTarget) {
                const pillarTop = new THREE.Vector3(
                    boss.pillarTarget.position.x,
                    boss.pillarTarget.position.y + boss.pillarTarget.geometry.parameters.height / 2,
                    boss.pillarTarget.position.z
                );
                
                tempVec3.subVectors(pillarTop, boss.position);
                tempVec3.y = 0;
                tempVec3.normalize().multiplyScalar(0.1);
                boss.position.add(tempVec3);
                
                // Check if landed on pillar
                // FIX: Changed velocityY < 0 to velocityY <= 0 to handle race condition
                if (boss.position.y >= pillarTop.y - 0.5 && boss.velocityY <= 0) {
                    boss.position.copy(pillarTop);
                    boss.position.y += boss.size;
                    boss.velocityY = 0;
                    boss.aiState = 'pillar_perched';
                    boss.perchTimer = 0;
                }
            } else {
                boss.aiState = 'idle';
            }
            break;
            
        case 'pillar_perched':
            boss.perchTimer++;
            
            // Create perch charge VFX on first frame
            if (boss.perchTimer === 1) {
                boss.perchChargeVFX = createPerchChargeVFX(boss);
                PulseMusic.onPillarPerch();
            }
            
            // Update perch charge VFX
            if (boss.perchChargeVFX) {
                const chargeProgress = boss.perchTimer / boss.pillarPerchConfig.perchDuration;
                updatePerchChargeVFX(boss.perchChargeVFX, chargeProgress, boss);
            }
            
            // Charging slam telegraph - extended timing for accessibility
            // Now: marker appears at frame 20, tracks until frame 65, locks for 40 frames
            if (boss.perchTimer > 20) {
                // Show landing marker at player position
                if (!boss.slamMarker) {
                    boss.slamMarker = createSlamMarker(player.position, boss.pillarPerchConfig.slamRadius);
                    boss.slamTargetPos.copy(player.position);
                    PulseMusic.onSlamCharge();
                }
                
                // Update marker position (tracks player until frame 65)
                if (boss.perchTimer < 65) {
                    boss.slamTargetPos.copy(player.position);
                    boss.slamMarker.position.x = boss.slamTargetPos.x;
                    boss.slamMarker.position.z = boss.slamTargetPos.z;
                }
                
                // Pass lock state to marker for visual escalation
                const isLocked = boss.perchTimer >= 65;
                updateSlamMarker(boss.slamMarker, isLocked);
            }
            
            // Execute slam (perchDuration = 105 for 40 frames of locked warning)
            if (boss.perchTimer > boss.pillarPerchConfig.perchDuration) {
                // Cleanup perch charge VFX
                if (boss.perchChargeVFX) {
                    cleanupVFX(boss.perchChargeVFX);
                    boss.perchChargeVFX = null;
                }
                
                boss.aiState = 'pillar_slam';
                boss.velocityY = 0.6;
                boss.slamDestination = boss.slamTargetPos.clone();
            }
            break;
            
        case 'pillar_slam':
            // Arc toward slam destination
            tempVec3.subVectors(boss.slamDestination, boss.position);
            tempVec3.y = 0;
            tempVec3.normalize().multiplyScalar(0.25);
            boss.position.add(tempVec3);
            
            // Impact
            // FIX: Changed velocityY < 0 to velocityY <= 0 to handle race condition
            if (boss.position.y <= boss.size + 0.1 && boss.velocityY <= 0) {
                // Slam impact!
                boss.position.y = boss.size;
                boss.velocityY = 0;
                
                // Audio cue for impact
                PulseMusic.onSlamImpact();
                
                // Damage in radius
                if (player.position.distanceTo(boss.position) < boss.pillarPerchConfig.slamRadius) {
                    const config = BOSS_CONFIG[gameState.currentArena];
                    takeDamage(boss.pillarPerchConfig.slamDamage, `${config?.name || 'Boss'} - Pillar Slam`, 'boss');
                }
                
                // VFX
                spawnParticle(boss.position, boss.baseColor, 25);
                
                // Create hazard zone at impact (respects hazard budget)
                if (boss.abilities.hazards && canCreateMoreHazards(4)) {
                    createHazardZone(boss.position.x, boss.position.z, 4, 300);
                    PulseMusic.onHazardSpawn();
                }
                
                // Cleanup
                if (boss.slamMarker) {
                    cleanupVFX(boss.slamMarker);
                    boss.slamMarker = null;
                }
                
                boss.aiState = 'cooldown';
                boss.abilityCooldowns.pillarPerch = boss.pillarPerchConfig.cooldown;
            }
            break;
            
        // LANE WALLS ABILITY (Boss 4) - Preview phase
        case 'lane_walls_preview':
            if (boss.aiTimer === 0 && boss.laneWallsConfig) {
                const config = boss.laneWallsConfig;
                const playerPos = player.position;
                boss.validWallPositions = [];  // Store validated positions for spawn phase
                
                // Create preview markers with validation
                for (let i = 0; i < config.wallCount; i++) {
                    const offset = (i === 0 ? -1 : 1) * 8;
                    
                    // Validate wall position against geometry
                    const validPos = getValidWallPosition(
                        boss.position, playerPos, offset,
                        config.wallLength, config.wallHeight
                    );
                    
                    if (validPos) {
                        const wallPos = new THREE.Vector3(validPos.x, 0, validPos.z);
                        const preview = createLaneWallPreview(wallPos, validPos.angle, config.wallLength, config.wallHeight);
                        boss.wallPreviews.push(preview);
                        boss.validWallPositions.push(validPos);
                    }
                }
                
                // Play warning audio
                PulseMusic.onLaneWallWarning();
            }
            
            // Update previews
            if (boss.wallPreviews) {
                const progress = boss.aiTimer / 30;
                boss.wallPreviews.forEach(preview => updateLaneWallPreview(preview, progress));
            }
            
            // Spawn actual walls after telegraph
            if (boss.aiTimer > 30) {
                // Cleanup previews
                if (boss.wallPreviews) {
                    boss.wallPreviews.forEach(preview => cleanupVFX(preview));
                    boss.wallPreviews = null;
                }
                boss.aiState = 'spawning_lane_walls';
                boss.aiTimer = 0;
            }
            break;
            
        case 'spawning_lane_walls':
            if (boss.aiTimer === 0 && boss.laneWallsConfig) {
                // Create temporary walls using validated positions
                const config = boss.laneWallsConfig;
                const validPositions = boss.validWallPositions || [];
                
                for (const validPos of validPositions) {
                    const wallX = validPos.x;
                    const wallZ = validPos.z;
                    const angle = validPos.angle;
                    
                    const wallGeom = new THREE.BoxGeometry(config.wallLength, config.wallHeight, 1);
                    const wallMat = new THREE.MeshStandardMaterial({
                        color: boss.baseColor,
                        emissive: boss.baseColor,
                        emissiveIntensity: 0.3,
                        transparent: true,
                        opacity: 0.8
                    });
                    
                    const wall = new THREE.Mesh(wallGeom, wallMat);
                    wall.position.set(wallX, config.wallHeight / 2, wallZ);
                    wall.rotation.y = angle; // Face toward player
                    
                    // Collision data
                    const halfLength = config.wallLength / 2;
                    wall.collisionData = {
                        minX: wallX - halfLength * Math.abs(Math.cos(angle)) - 0.5,
                        maxX: wallX + halfLength * Math.abs(Math.cos(angle)) + 0.5,
                        minZ: wallZ - halfLength * Math.abs(Math.sin(angle)) - 0.5,
                        maxZ: wallZ + halfLength * Math.abs(Math.sin(angle)) + 0.5,
                        topY: config.wallHeight
                    };
                    
                    wall.isTemporary = true;
                    wall.remainingDuration = config.wallDuration;
                    
                    scene.add(wall);
                    obstacles.push(wall);
                    boss.temporaryWalls.push(wall);
                }
                
                // Clear validated positions
                boss.validWallPositions = null;
                
                if (validPositions.length > 0) {
                    PulseMusic.onWallSpawn();
                    spawnParticle(boss.position, boss.baseColor, 15);
                }
            }
            
            if (boss.aiTimer > 30) {
                boss.aiState = 'idle';
                boss.aiTimer = 0;
                boss.abilityCooldowns.laneWalls = boss.laneWallsConfig.cooldown;
            }
            break;
    }
}

// ==================== HELPER FUNCTIONS ====================

function findNearestTallPillar(boss, minDistance) {
    // Find pillars from obstacles (height > 6 = tall pillar)
    // Uses collisionData for consistent height detection
    const tallPillars = obstacles.filter(obs => {
        // Prefer collisionData, fallback to geometry.parameters
        let height = 0;
        if (obs.collisionData && obs.collisionData.topY) {
            height = obs.collisionData.topY;
        } else if (obs.geometry && obs.geometry.parameters) {
            height = obs.geometry.parameters.height || 0;
        }
        
        const dist = boss.position.distanceTo(obs.position);
        return height > 6 && dist > minDistance;
    });
    
    if (tallPillars.length === 0) return null;
    
    // Strategic pillar selection - score by threat value
    const scored = tallPillars.map(pillar => {
        const pillarPos = pillar.position;
        const distToPlayer = pillarPos.distanceTo(player.position);
        const distToBoss = pillarPos.distanceTo(boss.position);
        
        // Ideal distance: close enough to threaten, far enough to give dodge window
        const idealDist = 15;
        const distScore = 1 - Math.abs(distToPlayer - idealDist) / 30;
        
        // Prefer pillars boss can reach quickly
        const reachScore = 1 - Math.min(distToBoss / 50, 1);
        
        // Slight randomness to prevent predictability
        const randomFactor = 0.8 + Math.random() * 0.4;
        
        return {
            pillar,
            score: (distScore * 0.7 + reachScore * 0.3) * randomFactor
        };
    });
    
    // Sort by score and pick from top 3 (weighted toward best)
    scored.sort((a, b) => b.score - a.score);
    const topPillars = scored.slice(0, Math.min(3, scored.length));
    return topPillars[Math.floor(Math.random() * topPillars.length)].pillar;
}

// Check if a platform is reachable by the player (has step access or is jumpable from ground)
function isPlayerReachable(platformCollision) {
    const platformTop = platformCollision.topY;
    const maxJumpHeight = 2.5;  // Player can jump about this high
    
    // If platform is low enough to jump to from ground, it's reachable
    if (platformTop <= maxJumpHeight) return true;
    
    const platformCenterX = (platformCollision.minX + platformCollision.maxX) / 2;
    const platformCenterZ = (platformCollision.minZ + platformCollision.maxZ) / 2;
    
    // Check for nearby step access (lower platform that provides intermediate step)
    for (const obs of obstacles) {
        if (!obs.collisionData) continue;
        const c = obs.collisionData;
        
        // Skip if it's the same platform
        if (c === platformCollision) continue;
        
        const obsCenterX = (c.minX + c.maxX) / 2;
        const obsCenterZ = (c.minZ + c.maxZ) / 2;
        
        // Check horizontal distance
        const dx = Math.abs(obsCenterX - platformCenterX);
        const dz = Math.abs(obsCenterZ - platformCenterZ);
        const dist = Math.sqrt(dx * dx + dz * dz);
        
        // Must be close enough to jump between (within 8 units)
        // AND lower than target platform
        // AND the height difference must be jumpable
        if (dist < 8 && c.topY < platformTop && (platformTop - c.topY) <= maxJumpHeight) {
            return true;
        }
    }
    
    return false;
}

// Teleport destination selection with platform size validation
function getValidTeleportDestination(boss) {
    const goElevated = boss.teleportConfig && boss.teleportConfig.preferElevated && 
                      Math.random() < boss.teleportConfig.elevatedChance;
    
    if (goElevated && gameState.currentArena >= 3) {
        const bossRadius = boss.size;
        const minPlatformSize = bossRadius * 2;  // Boss diameter as minimum platform size
        
        // Filter for valid elevated platforms (large enough for boss AND reachable by player)
        const validPlatforms = obstacles.filter(obs => {
            if (!obs.collisionData) return false;
            const c = obs.collisionData;
            
            // Calculate platform dimensions
            const width = c.maxX - c.minX;
            const depth = c.maxZ - c.minZ;
            
            // Must be elevated (topY > 2) AND large enough for boss AND reachable by player
            return c.topY > 2 &&
                   width >= minPlatformSize &&
                   depth >= minPlatformSize &&
                   isPlayerReachable(c);
        });
        
        if (validPlatforms.length > 0) {
            const platform = validPlatforms[Math.floor(Math.random() * validPlatforms.length)];
            const c = platform.collisionData;
            return new THREE.Vector3(
                (c.minX + c.maxX) / 2,  // Center of platform
                c.topY + boss.size,
                (c.minZ + c.maxZ) / 2
            );
        }
    }
    
    // Fallback to ground position near player
    const angle = Math.random() * Math.PI * 2;
    const dist = 12 + Math.random() * 12;
    return new THREE.Vector3(
        Math.max(-40, Math.min(40, player.position.x + Math.cos(angle) * dist)),
        boss.size,
        Math.max(-40, Math.min(40, player.position.z + Math.sin(angle) * dist))
    );
}

// ==================== CORRIDOR-AWARE BURROW TARGETING ====================

// Calculate best emerge target with corridor awareness and escape route validation
function calculateEmergeTarget(boss, playerPos) {
    const attempts = 10;
    let bestTarget = null;
    let bestScore = -Infinity;
    
    for (let i = 0; i < attempts; i++) {
        const offset = new THREE.Vector3(
            (Math.random() - 0.5) * 8,
            0,
            (Math.random() - 0.5) * 8
        );
        const target = playerPos.clone().add(offset);
        
        // Clamp to bounds
        target.x = Math.max(-40, Math.min(40, target.x));
        target.z = Math.max(-40, Math.min(40, target.z));
        
        // Score this target
        const score = scoreEmergeTarget(target, playerPos, boss);
        
        if (score > bestScore) {
            bestScore = score;
            bestTarget = target;
        }
    }
    
    return bestTarget || playerPos.clone();
}

// Score an emerge target based on fairness criteria
function scoreEmergeTarget(target, playerPos, boss) {
    let score = 0;
    
    // Prefer targets away from walls (not in corridors)
    const distFromWalls = getMinDistanceFromWalls(target);
    score += distFromWalls * 2;  // Weight corridor avoidance
    
    // Prefer targets with escape routes for player
    const playerEscapeRoutes = countEscapeRoutes(playerPos, target);
    score += playerEscapeRoutes * 5;  // Heavily favor targets with escape routes
    
    // Ensure target isn't inside geometry
    if (isInsideObstacle(target)) {
        score -= 100;  // Heavy penalty
    }
    
    // Prefer targets not stacking on existing hazards
    const hazardOverlap = countHazardOverlap(target, boss.burrowConfig?.emergeDamageRadius || 5);
    score -= hazardOverlap * 3;
    
    // Slight preference for targets closer to player (more threatening but fair)
    const distToPlayer = target.distanceTo(playerPos);
    if (distToPlayer > 2 && distToPlayer < 6) {
        score += 2;  // Sweet spot distance
    }
    
    return score;
}

// Get minimum distance from target to any corridor wall
function getMinDistanceFromWalls(pos) {
    let minDist = Infinity;
    
    // Check distance from all obstacles (walls)
    for (const obs of obstacles) {
        const c = obs.collisionData;
        if (!c) continue;
        
        // Calculate distance to obstacle bounds
        const distX = Math.max(c.minX - pos.x, 0, pos.x - c.maxX);
        const distZ = Math.max(c.minZ - pos.z, 0, pos.z - c.maxZ);
        const dist = Math.sqrt(distX * distX + distZ * distZ);
        
        // If inside obstacle horizontally, distance is 0
        if (pos.x >= c.minX && pos.x <= c.maxX && pos.z >= c.minZ && pos.z <= c.maxZ) {
            return 0;
        }
        
        minDist = Math.min(minDist, dist);
    }
    
    // Also check arena boundary walls
    const boundaryDist = Math.min(
        42 - Math.abs(pos.x),
        42 - Math.abs(pos.z)
    );
    minDist = Math.min(minDist, boundaryDist);
    
    return minDist;
}

// Count how many escape directions player has from emerge point
function countEscapeRoutes(playerPos, emergeTarget) {
    const escapeDirections = [
        { dx: 1, dz: 0 },   // East
        { dx: -1, dz: 0 },  // West
        { dx: 0, dz: 1 },   // South
        { dx: 0, dz: -1 }   // North
    ];
    
    let validRoutes = 0;
    const emergeDamageRadius = 5;  // Standard emerge damage radius
    
    for (const dir of escapeDirections) {
        const escapePoint = new THREE.Vector3(
            playerPos.x + dir.dx * 8,
            0,
            playerPos.z + dir.dz * 8
        );
        
        // Route is valid if it's away from emerge and not blocked
        const awayFromEmerge = escapePoint.distanceTo(emergeTarget) > emergeDamageRadius + 1;
        const notBlocked = !isInsideObstacle(escapePoint) && isInBounds(escapePoint);
        
        if (awayFromEmerge && notBlocked) {
            validRoutes++;
        }
    }
    
    return validRoutes;
}

// Check if a position is inside any obstacle
function isInsideObstacle(pos) {
    for (const obs of obstacles) {
        const c = obs.collisionData;
        if (!c) continue;
        
        // Check if position is within obstacle bounds (with small margin)
        if (pos.x >= c.minX - 1 && pos.x <= c.maxX + 1 &&
            pos.z >= c.minZ - 1 && pos.z <= c.maxZ + 1) {
            return true;
        }
    }
    return false;
}

// Check if position is within arena bounds
function isInBounds(pos) {
    return Math.abs(pos.x) < 42 && Math.abs(pos.z) < 42;
}

// Count how much hazard area overlaps with emerge radius
function countHazardOverlap(target, checkRadius) {
    let overlapCount = 0;
    
    for (const hz of hazardZones) {
        if (!hz.position) continue;
        
        const dist = Math.sqrt(
            (hz.position.x - target.x) ** 2 + 
            (hz.position.z - target.z) ** 2
        );
        
        // If hazard and emerge zones overlap
        const hazardRadius = hz.radius || 3;
        if (dist < checkRadius + hazardRadius) {
            overlapCount++;
        }
    }
    
    return overlapCount;
}

// ==================== HAZARD BUDGET SYSTEM ====================

// Maximum arena coverage allowed for hazards (25% to ensure traversability)
const MAX_HAZARD_COVERAGE = 0.25;
const ARENA_SIZE = 84;  // -42 to +42
const ARENA_AREA = ARENA_SIZE * ARENA_SIZE;

// Check if more hazards can be created without exceeding budget
function canCreateMoreHazards(newRadius) {
    let currentHazardArea = 0;
    
    for (const hz of hazardZones) {
        if (!hz.position) continue;
        const hazardRadius = hz.radius || 3;
        currentHazardArea += Math.PI * hazardRadius * hazardRadius;
    }
    
    const newHazardArea = Math.PI * newRadius * newRadius;
    const totalCoverage = (currentHazardArea + newHazardArea) / ARENA_AREA;
    
    return totalCoverage < MAX_HAZARD_COVERAGE;
}

// Check if position overlaps with existing hazards
function isPositionOverlappingHazards(pos, existingPositions, minDist) {
    // Check against existing hazards in scene
    for (const hz of hazardZones) {
        if (!hz.position) continue;
        const dist = Math.sqrt(
            (pos.x - hz.position.x) ** 2 + 
            (pos.z - hz.position.z) ** 2
        );
        if (dist < minDist) return true;
    }
    
    // Check against positions being placed in this batch
    for (const other of existingPositions) {
        const dist = pos.distanceTo(other);
        if (dist < minDist) return true;
    }
    
    return false;
}

// Check if hazard would block all escape routes from player
function isBlockingAllRoutes(pos, radius) {
    // Check 4 cardinal escape routes from the hazard position
    // Each route needs a clear path to arena bounds
    const routes = [
        { x: pos.x + radius + 2, z: pos.z },
        { x: pos.x - radius - 2, z: pos.z },
        { x: pos.x, z: pos.z + radius + 2 },
        { x: pos.x, z: pos.z - radius - 2 }
    ];
    
    let clearRoutes = 0;
    for (const route of routes) {
        // Check if route point is within arena bounds
        if (Math.abs(route.x) < 42 && Math.abs(route.z) < 42) {
            clearRoutes++;
        }
    }
    
    // Need at least 2 clear routes to be fair
    return clearRoutes < 2;
}

// Calculate hazard coverage percentage in an area (for stacking prevention)
function calculateHazardCoverage(x, z, checkRadius) {
    let coveredArea = 0;
    const totalArea = Math.PI * checkRadius * checkRadius;
    
    for (const hz of hazardZones) {
        if (!hz.position) continue;
        
        const dist = Math.sqrt(
            (hz.position.x - x) ** 2 + 
            (hz.position.z - z) ** 2
        );
        
        const hazardRadius = hz.radius || 3;
        if (dist < checkRadius + hazardRadius) {
            // Approximate overlap area using simple circle overlap
            const overlap = Math.max(0, hazardRadius - Math.max(0, dist - checkRadius));
            coveredArea += Math.PI * overlap * overlap;
        }
    }
    
    return Math.min(1, coveredArea / totalArea);
}

// ==================== LANE WALL VALIDATION ====================

// Validate and adjust lane wall position to avoid geometry conflicts
function getValidWallPosition(bossPos, playerPos, offset, wallLength, wallHeight) {
    const angle = Math.atan2(playerPos.z - bossPos.z, playerPos.x - bossPos.x);
    const perpAngle = angle + Math.PI / 2;
    
    let wallX = bossPos.x + Math.cos(perpAngle) * offset;
    let wallZ = bossPos.z + Math.sin(perpAngle) * offset;
    
    // Check for platform collision and adjust position
    for (const obs of obstacles) {
        if (obs.isTemporary) continue;  // Skip other temp walls
        const c = obs.collisionData;
        if (!c) continue;
        
        // Calculate wall bounding box (AABB approximation)
        const halfLength = wallLength / 2;
        const wallMinX = wallX - halfLength * Math.abs(Math.cos(angle)) - 1;
        const wallMaxX = wallX + halfLength * Math.abs(Math.cos(angle)) + 1;
        const wallMinZ = wallZ - halfLength * Math.abs(Math.sin(angle)) - 1;
        const wallMaxZ = wallZ + halfLength * Math.abs(Math.sin(angle)) + 1;
        
        // Check overlap with platform
        const overlap = !(wallMaxX < c.minX || wallMinX > c.maxX ||
                         wallMaxZ < c.minZ || wallMinZ > c.maxZ);
        
        if (overlap && c.topY > 1) {
            // Shift wall position away from platform
            const shiftDir = offset > 0 ? 1 : -1;
            wallX += Math.cos(perpAngle) * 4 * shiftDir;
            wallZ += Math.sin(perpAngle) * 4 * shiftDir;
        }
    }
    
    // Validate player escape routes
    const escapeRoutes = countPlayerEscapeRoutes(wallX, wallZ, wallLength, angle, playerPos);
    if (escapeRoutes < 2) {
        // Not enough escape routes - skip this wall
        return null;
    }
    
    // Clamp to arena bounds
    wallX = Math.max(-38, Math.min(38, wallX));
    wallZ = Math.max(-38, Math.min(38, wallZ));
    
    return { x: wallX, z: wallZ, angle };
}

// Count how many escape routes the player has from a proposed wall position
function countPlayerEscapeRoutes(wallX, wallZ, wallLength, wallAngle, playerPos) {
    // Check 4 cardinal directions from player position
    const checkDist = 8;
    const routes = [
        { dx: checkDist, dz: 0 },
        { dx: -checkDist, dz: 0 },
        { dx: 0, dz: checkDist },
        { dx: 0, dz: -checkDist }
    ];
    
    let clearRoutes = 0;
    const halfLength = wallLength / 2;
    
    for (const route of routes) {
        const checkX = playerPos.x + route.dx;
        const checkZ = playerPos.z + route.dz;
        
        // Check if this route is blocked by the proposed wall
        const blocked = isPointNearWall(checkX, checkZ, wallX, wallZ, halfLength, wallAngle);
        
        // Also check against existing obstacles
        let obstacleBlocked = false;
        for (const obs of obstacles) {
            const c = obs.collisionData;
            if (!c) continue;
            if (checkX > c.minX && checkX < c.maxX && checkZ > c.minZ && checkZ < c.maxZ && c.topY > 1) {
                obstacleBlocked = true;
                break;
            }
        }
        
        if (!blocked && !obstacleBlocked) {
            clearRoutes++;
        }
    }
    
    return clearRoutes;
}

// Check if a point is near a wall line segment
function isPointNearWall(px, pz, wallX, wallZ, halfLength, wallAngle) {
    // Wall endpoints
    const wx1 = wallX - Math.cos(wallAngle) * halfLength;
    const wz1 = wallZ - Math.sin(wallAngle) * halfLength;
    const wx2 = wallX + Math.cos(wallAngle) * halfLength;
    const wz2 = wallZ + Math.sin(wallAngle) * halfLength;
    
    // Distance from point to line segment
    const dx = wx2 - wx1;
    const dz = wz2 - wz1;
    const lengthSq = dx * dx + dz * dz;
    
    if (lengthSq === 0) return false;
    
    let t = Math.max(0, Math.min(1, ((px - wx1) * dx + (pz - wz1) * dz) / lengthSq));
    const closestX = wx1 + t * dx;
    const closestZ = wz1 + t * dz;
    
    const distSq = (px - closestX) ** 2 + (pz - closestZ) ** 2;
    return distSq < 4;  // Within 2 units of wall
}

function getTellDuration(boss) {
    const phaseKey = `phase${boss.phase}`;
    const tells = {};
    for (const [ability, durations] of Object.entries(ABILITY_TELLS)) {
        tells[ability] = durations[phaseKey] || durations.phase1;
    }
    return tells;
}

function moveTowardPlayer(boss, speedMultiplier = 1.0) {
    tempVec3.subVectors(player.position, boss.position);
    tempVec3.y = 0;
    tempVec3.normalize();
    boss.position.add(tempVec3.multiplyScalar(boss.speed * speedMultiplier));
    clampBossPosition(boss);
}

function clampBossPosition(boss) {
    boss.position.x = Math.max(-42, Math.min(42, boss.position.x));
    boss.position.z = Math.max(-42, Math.min(42, boss.position.z));
}

// Phase transition timing uses PHASE_TRANSITION_DELAY_FRAMES from constants.js

// Dramatic phase transition with VFX
function triggerPhaseTransition(boss, newPhase) {
    // Skip if already transitioning or same phase
    if (boss.phaseTransitioning || boss.phase >= newPhase) return;
    
    boss.phaseTransitioning = true;
    boss.pendingPhase = newPhase;
    boss.phaseTransitionTimer = PHASE_TRANSITION_DELAY_FRAMES;
    
    // Freeze frame effect
    triggerSlowMo(30, 0.1); // 0.5 second at 10% speed
    
    // Screen flash in boss color
    triggerScreenFlash(boss.baseColor, 20);
    
    // Boss visual effect - bright white
    if (boss.bodyMaterial) {
        boss.bodyMaterial.emissive.setHex(0xffffff);
        boss.bodyMaterial.emissiveIntensity = 1.5;
    }
    
    // Particle burst
    spawnParticle(boss.position, boss.baseColor, 30);
    
    // Overgrowth P3: Trigger split at phase transition (not health-based)
    if (gameState.currentArena === 4 && newPhase === 3 && !boss.hasSplit) {
        boss.forceP3Split = true;  // Flag to trigger split in completePhaseTransition
    }
    
    // UI announcement
    const config = BOSS_CONFIG[gameState.currentArena];
    showPhaseAnnouncement(newPhase, config?.name || 'BOSS');
    
    // Audio stinger
    PulseMusic.onBossPhaseChange(newPhase);
}

// Complete phase transition after delay (called from updateBoss)
function completePhaseTransition(boss) {
    if (!boss.phaseTransitioning || boss.phaseTransitionTimer > 0) return;
    
    const newPhase = boss.pendingPhase;
    boss.phase = newPhase;
    boss.speed *= newPhase === 2 ? 1.15 : 1.3;
    boss.currentCombo = null;
    
    // Update visual for new phase
    updateBossPhaseVisuals(boss);
    
    // Red Puffer King Phase 2: Demo minion spawn + energy transfer + shield formation
    const config = BOSS_CONFIG[gameState.currentArena];
    if (gameState.currentArena === 1 && newPhase === 2) {
        if (boss.shieldConfig && config.phaseBehavior?.[2]?.autoShield) {
            // Initialize summon tracking
            boss.summonedMinions = boss.summonedMinions || [];
            boss.minionTethers = boss.minionTethers || [];
            
            // PHASE 2 DEMO: Spawn minions first, then show energy transfer to form shield
            const demoMinions = [];
            const minionCount = 3;
            const spawnRadius = 8;
            
            for (let i = 0; i < minionCount; i++) {
                const angle = (i / minionCount) * Math.PI * 2;
                const spawnPos = new THREE.Vector3(
                    boss.position.x + Math.cos(angle) * spawnRadius,
                    1,
                    boss.position.z + Math.sin(angle) * spawnRadius
                );
                const minion = spawnSpecificEnemy('grunt', spawnPos);
                if (minion) {
                    minion.isBossMinion = true;
                    minion.parentBoss = boss;
                    boss.summonedMinions.push(minion);
                    demoMinions.push(minion);
                    
                    // Create tether VFX
                    const tether = createMinionTether(boss, minion, boss.baseColor);
                    if (tether) {
                        minion.tether = tether;
                        boss.minionTethers.push(tether);
                    }
                }
            }
            
            // Show energy transfer VFX from minions to boss
            if (demoMinions.length > 0) {
                createEnergyTransferVFX(demoMinions, boss, 90);
                // Slow-mo during energy transfer for emphasis
                triggerSlowMo(60, 0.4);  // 1 second at 40% speed
            }
            
            // Delay shield activation slightly for dramatic effect
            setTimeout(() => {
                boss.shieldActive = true;
                boss.shieldStartTime = Date.now();
                if (boss.shieldMesh) {
                    boss.shieldMesh.visible = true;
                }
                
                // Trigger porcupinefish inflation bristle effect for dramatic Phase 2 entrance
                if (boss.isPorcupinefish) {
                    triggerSpineBristle(boss);
                    // Extra dramatic: instant partial inflation before lerp takes over
                    boss.inflationState = 0.3;
                }
                
                triggerScreenFlash(0x4488ff, 15);
            }, 1500);  // 1.5 seconds after minion spawn
            
            // Enter static shielded state
            boss.aiState = 'static_shielded';
            boss.aiTimer = 0;
            // Disable summon timer since we already spawned minions
            boss.summonTimer = 300;  // 5 second delay before next summon wave
            
            // Show tutorial for first time
            showTutorialCallout('phase2Shield', 'Kill linked minions to break the shield!', 3000);
            PulseMusic.onBossShieldActivate?.();
        }
    }
    
    // Red Puffer King Phase 3: Demo shielded dash, then resume aggressive chase
    if (gameState.currentArena === 1 && newPhase === 3) {
        // Exit static_shielded state if still in it
        if (boss.aiState === 'static_shielded') {
            boss.aiState = 'idle';
            boss.aiTimer = 0;
        }
        // Keep shield active if it was up (stacked mechanic)
        // Shield will only break when minions are killed
        
        // Ensure shield is visible and prominent for demo
        if (!boss.shieldActive) {
            boss.shieldActive = true;
            boss.shieldStartTime = Date.now();
        }
        if (boss.shieldMesh) {
            boss.shieldMesh.visible = true;
            // Make shield extra prominent for Phase 3 demo
            if (boss.shieldMesh.material) {
                boss.shieldMesh.material.opacity = 0.7;  // More visible
                boss.shieldMesh.material.emissive?.setHex(0xff4444);  // Red tint for aggression
                boss.shieldMesh.material.emissiveIntensity = 0.5;
            }
        }
        
        // PHASE 3 DEMO: Trigger a shielded dash demonstration
        // Delay slightly to let phase transition visuals settle
        setTimeout(() => {
            if (boss && boss.health > 0) {
                // Slow-mo during shielded charge demo for emphasis
                triggerSlowMo(45, 0.3);  // 0.75 second at 30% speed
                // Trigger demo charge in safe direction while shielded
                triggerDemoAbility(boss, 'charge');
            }
        }, 500);  // 0.5 second delay
        
        // Show Phase 3 callout
        showTutorialCallout('phase3Pressure', 'PHASE 3 - Boss charges while shielded!', 2500);
    }
    
    // Overgrowth P3: Trigger split immediately
    if (boss.forceP3Split) {
        boss.forceP3Split = false;
        boss.aiState = 'split';
        boss.aiTimer = 0;
    }
    
    boss.phaseTransitioning = false;
    boss.pendingPhase = null;
}

// Update boss appearance based on phase
function updateBossPhaseVisuals(boss) {
    if (!boss.bodyMaterial) return;
    
    switch (boss.phase) {
        case 1:
            boss.bodyMaterial.emissive.setHex(boss.baseColor);
            boss.bodyMaterial.emissiveIntensity = 0.3;
            break;
        case 2:
            boss.bodyMaterial.emissive.setHex(boss.baseColor);
            boss.bodyMaterial.emissiveIntensity = 0.5;
            break;
        case 3:
            // Red-shifted and intense
            boss.bodyMaterial.emissive.setHex(0xff4444);
            boss.bodyMaterial.emissiveIntensity = 0.7;
            break;
    }
    
    // Porcupinefish-specific phase visuals
    if (boss.isPorcupinefish) {
        switch (boss.phase) {
            case 1:
                // Deflated swimmer - orange-yellow spines (dormant)
                if (boss.pufferSpines) {
                    boss.pufferSpines.children.forEach(spine => {
                        if (spine.material) {
                            spine.material.color.setHex(0xffaa44);
                            spine.material.emissive.setHex(0xff6600);
                            spine.material.emissiveIntensity = 0.3;
                        }
                    });
                }
                break;
            case 2:
                // Inflated armored - spines become more prominent
                if (boss.pufferSpines) {
                    boss.pufferSpines.children.forEach(spine => {
                        if (spine.material) {
                            spine.material.color.setHex(0xff8833);
                            spine.material.emissive.setHex(0xff5500);
                            spine.material.emissiveIntensity = 0.4;
                        }
                    });
                }
                // Trigger dramatic bristle effect
                triggerSpineBristle(boss);
                break;
            case 3:
                // Aggressive inflated - red-hot spines
                if (boss.pufferSpines) {
                    boss.pufferSpines.children.forEach(spine => {
                        if (spine.material) {
                            spine.material.color.setHex(0xff4422);
                            spine.material.emissive.setHex(0xff2200);
                            spine.material.emissiveIntensity = 0.6;
                        }
                    });
                }
                // Body also gets red-shifted
                if (boss.pufferBodyMat) {
                    boss.pufferBodyMat.emissive.setHex(0xff3333);
                }
                // Extra dramatic bristle for Phase 3
                boss.spineBristleScale = 1.6;
                triggerSpineBristle(boss);
                break;
        }
    }
}

function isOutOfBounds(boss) {
    return Math.abs(boss.position.x) > 42 || Math.abs(boss.position.z) > 42;
}

function spawnMiniBoss(position, index, totalCount = 3, health = 150, simpleMode = false) {
    const angle = (index / totalCount) * Math.PI * 2;
    const baseDistance = 8;  // Increased from 5 for better spacing
    
    // Calculate initial spawn position
    let spawnX = position.x + Math.cos(angle) * baseDistance;
    let spawnZ = position.z + Math.sin(angle) * baseDistance;
    let spawnY = 1.5;  // Mini-boss size
    
    // Validate spawn position against platform geometry
    for (const obs of obstacles) {
        if (obs.isTemporary) continue;
        const c = obs.collisionData;
        if (!c) continue;
        
        // Check if spawn position is inside a platform
        if (spawnX > c.minX && spawnX < c.maxX &&
            spawnZ > c.minZ && spawnZ < c.maxZ) {
            // On a platform - spawn on top
            spawnY = c.topY + 1.5;
            break;
        }
        
        // Check if spawn position is too close to platform edge
        const margin = 2;
        if (spawnX > c.minX - margin && spawnX < c.maxX + margin &&
            spawnZ > c.minZ - margin && spawnZ < c.maxZ + margin &&
            c.topY > 1) {
            // Too close to platform - shift spawn position outward
            const shiftDir = new THREE.Vector3(spawnX - position.x, 0, spawnZ - position.z).normalize();
            spawnX += shiftDir.x * 3;
            spawnZ += shiftDir.z * 3;
        }
    }
    
    // Clamp to arena bounds
    spawnX = Math.max(-40, Math.min(40, spawnX));
    spawnZ = Math.max(-40, Math.min(40, spawnZ));
    
    // Simple mode (Arena 6): different color to indicate weaker threat
    const bossColor = simpleMode ? 0x88aaff : 0x66ffff;
    const emissiveColor = simpleMode ? 0x6688cc : 0x44ffff;
    
    const miniBoss = new THREE.Mesh(
        new THREE.SphereGeometry(1.5, 12, 12),
        new THREE.MeshStandardMaterial({
            color: bossColor,
            emissive: emissiveColor,
            emissiveIntensity: 0.4
        })
    );
    
    miniBoss.position.set(spawnX, spawnY, spawnZ);
    miniBoss.castShadow = true;
    miniBoss.health = health;
    miniBoss.maxHealth = health;
    miniBoss.speed = simpleMode ? 0.035 : 0.04;  // Slightly slower in simple mode
    miniBoss.damage = simpleMode ? 10 : 15;      // Less damage in simple mode
    miniBoss.size = 1.5;
    miniBoss.baseSize = 1.5;
    miniBoss.isBoss = false;
    miniBoss.isElite = true;
    miniBoss.xpValue = simpleMode ? 15 : 20;
    miniBoss.baseColor = bossColor;
    miniBoss.velocityY = 0;
    miniBoss.velocity = new THREE.Vector3();
    miniBoss.enemyType = simpleMode ? 'miniBossSimple' : 'miniBoss';
    miniBoss.behavior = 'chase';  // Always chase (simple mode has no special behaviors)
    miniBoss.damageReduction = simpleMode ? 0.2 : 0.3;  // Less tanky in simple mode
    miniBoss.simpleMode = simpleMode;  // Track for behavior systems
    
    scene.add(miniBoss);
    enemies.push(miniBoss);
}

export function killBoss() {
    const currentBoss = getCurrentBoss();
    if (!currentBoss || currentBoss.isDying) return;
    currentBoss.isDying = true;
    
    // Cleanup combo VFX if active
    if (currentBoss.comboActive) {
        endComboVFX(currentBoss);
    }
    
    // Track boss defeat for combat stats
    if (gameState.combatStats) {
        gameState.combatStats.bossesDefeated++;
    }
    
    // Check if this is the final boss (Arena 6)
    const isFinalBoss = gameState.currentArena === 6;
    
    // Spawn XP gems from boss
    for (let i = 0; i < 12; i++) {
        const offset = new THREE.Vector3(
            (Math.random() - 0.5) * 6,
            0,
            (Math.random() - 0.5) * 6
        );
        spawnXpGem(currentBoss.position.clone().add(offset), currentBoss.xpValue / 12);
    }
    
    // Spawn heart
    spawnHeart(currentBoss.position.clone(), HEART_HEAL.boss);
    
    // Particles
    spawnParticle(currentBoss.position, currentBoss.baseColor, 20);
    
    // Final boss special victory sequence
    if (isFinalBoss) {
        // Extended slow-mo for dramatic effect
        triggerSlowMo(0.1, 3000);
        
        // Screen flash
        triggerScreenFlash(0xffffff, 0.7);
        
        // Multiple staggered particle bursts (celebratory fireworks effect)
        const bossPos = currentBoss.position.clone();
        const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
        
        for (let wave = 0; wave < 3; wave++) {
            setTimeout(() => {
                for (let i = 0; i < 6; i++) {
                    const offset = new THREE.Vector3(
                        (Math.random() - 0.5) * 15,
                        3 + Math.random() * 5,
                        (Math.random() - 0.5) * 15
                    );
                    spawnParticle(bossPos.clone().add(offset), colors[i], 15);
                }
            }, wave * 500);
        }
        
        // Victory fanfare audio
        PulseMusic.onFinalBossVictory();
        
        // Show victory message (triggers game completion UI)
        showTutorialCallout('victory', `CONGRATULATIONS! YOU HAVE CONQUERED ${GAME_TITLE.toUpperCase()}!`, 5000);
    }
    
    // Clear all remaining enemies on boss defeat
    for (const enemy of enemies) {
        // Spawn small particle burst for each cleared enemy
        spawnParticle(enemy.position, enemy.baseColor || 0xffffff, 5);
        
        // Cleanup enemy resources (don't dispose cached geometries)
        if (enemy.isGroup || enemy.type === 'Group') {
            enemy.traverse(child => {
                if (child.material) child.material.dispose();
            });
        } else {
            if (enemy.baseMaterial) enemy.baseMaterial.dispose();
            if (enemy.material) enemy.material.dispose();
        }
        scene.remove(enemy);
    }
    enemies.length = 0;
    
    // Cleanup boss
    currentBoss.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
    });
    scene.remove(currentBoss);
    setCurrentBoss(null);
    
    gameState.bossActive = false;
    hideBossHealthBar();
    hideBoss6CycleIndicator();
    gameState.kills++;
    gameState.score += isFinalBoss ? 2000 : 750;  // Extra score for final boss
    
    // Spawn arena portal after boss death (not for final boss - game ends there)
    if (!isFinalBoss) {
        const portalPos = currentBoss.position.clone();
        portalPos.y = 0;  // Ground level
        
        // Delay portal spawn for dramatic effect (2 seconds after boss death)
        setTimeout(() => {
            spawnArenaPortal(portalPos);
            showTutorialCallout('portal', 'Enter the portal to proceed to the next arena!', 3000);
        }, 2000);
    }
}
