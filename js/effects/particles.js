import { scene } from '../core/scene.js';
import { particles } from '../core/entities.js';

export function spawnParticle(position, color, count) {
    count = count || 5;
    
    for (let i = 0; i < count; i++) {
        const particle = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 4, 4),
            new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 1
            })
        );
        
        particle.position.copy(position);
        particle.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.3,
            Math.random() * 0.3,
            (Math.random() - 0.5) * 0.3
        );
        particle.life = 30;
        
        scene.add(particle);
        particles.push(particle);
    }
}

export function updateParticles(delta) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.position.add(p.velocity);
        p.velocity.y -= 0.01;
        p.life--;
        p.material.opacity = p.life / 30;
        
        if (p.life <= 0) {
            p.geometry.dispose();
            p.material.dispose();
            scene.remove(p);
            particles.splice(i, 1);
        }
    }
}
