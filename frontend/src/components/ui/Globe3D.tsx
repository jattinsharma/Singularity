import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface Globe3DProps {
  className?: string;
  autoRotateSpeed?: number;
}

interface GroundStationCoord {
  name: string;
  lat: number;
  lon: number;
  color: string;
}

const STATIONS: GroundStationCoord[] = [
  { name: 'NYC Ground Stn', lat: 40.7128, lon: -74.006, color: '#38bdf8' },
  { name: 'London Gateway', lat: 51.5074, lon: -0.1278, color: '#38bdf8' },
  { name: 'Frankfurt Hub', lat: 50.1109, lon: 8.6821, color: '#60a5fa' },
  { name: 'Tokyo Terminal', lat: 35.6762, lon: 139.6503, color: '#34d399' },
  { name: 'Singapore Gateway', lat: 1.3521, lon: 103.8198, color: '#a78bfa' },
  { name: 'Sydney Ground Stn', lat: -33.8688, lon: 151.2093, color: '#f472b6' },
];

function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

export const Globe3D: React.FC<Globe3DProps> = ({
  className = '',
  autoRotateSpeed = 0.5,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [activeStation, setActiveStation] = useState<string | null>(null);
  const [hoverCoord, setHoverCoord] = useState<{ lat: string; lon: string }>({
    lat: '35.68° N',
    lon: '139.65° E',
  });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 600;
    const height = mount.clientHeight || 500;

    // 1. Scene & Renderer
    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    mount.appendChild(renderer.domElement);

    // 2. Camera & Controls
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 1.8, 4.4);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.6;
    controls.enableZoom = false;
    controls.minDistance = 2.2;
    controls.maxDistance = 8.0;
    controls.autoRotate = true;
    controls.autoRotateSpeed = autoRotateSpeed;

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0x446699, 1.2);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 2.4);
    sunLight.position.set(6, 4, 5);
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x00f0ff, 0.9);
    rimLight.position.set(-6, -2, -4);
    scene.add(rimLight);

    // 4. Earth Globe
    const globeRadius = 1.35;
    const globeGeo = new THREE.SphereGeometry(globeRadius, 64, 64);
    const globeMat = new THREE.MeshPhongMaterial({
      color: 0x143460,
      emissive: 0x020814,
      shininess: 30,
      specular: 0x225599,
    });
    const earthMesh = new THREE.Mesh(globeGeo, globeMat);
    scene.add(earthMesh);

    // Load NASA Blue Marble Texture
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      'https://unpkg.com/three-globe@2.41.12/example/img/earth-blue-marble.jpg',
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        globeMat.map = tex;
        globeMat.color.set(0xffffff);
        globeMat.emissive.set(0x020712);
        globeMat.needsUpdate = true;
      },
      undefined,
      () => {
        // Fallback procedural shading
        globeMat.color.setHex(0x0f2b48);
      }
    );

    // Coordinate Wireframe Grid
    const wireGeo = new THREE.SphereGeometry(globeRadius + 0.005, 36, 18);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      wireframe: true,
      transparent: true,
      opacity: 0.07,
    });
    const wireMesh = new THREE.Mesh(wireGeo, wireMat);
    scene.add(wireMesh);

    // Atmospheric Glow Halo
    const atmosGeo = new THREE.SphereGeometry(globeRadius * 1.06, 48, 48);
    const atmosMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.16,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    scene.add(new THREE.Mesh(atmosGeo, atmosMat));

    // Outer Aura Ring
    const auraGeo = new THREE.SphereGeometry(globeRadius * 1.15, 32, 32);
    const auraMat = new THREE.MeshBasicMaterial({
      color: 0x6366f1,
      transparent: true,
      opacity: 0.04,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    scene.add(new THREE.Mesh(auraGeo, auraMat));

    // 5. Orbital Shells & Satellites
    const orbitGroup = new THREE.Group();
    scene.add(orbitGroup);

    const orbitRadius = globeRadius * 1.28;
    const numPlanes = 5;
    const satsPerPlane = 6;
    const totalSats = numPlanes * satsPerPlane;

    interface SimSat {
      mesh: THREE.Mesh;
      plane: number;
      initialAngle: number;
      speed: number;
    }

    const simSats: SimSat[] = [];
    const satGeometry = new THREE.SphereGeometry(0.024, 12, 12);
    const satMaterial = new THREE.MeshBasicMaterial({
      color: 0x38ef7d,
    });

    const satGlowMat = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.45,
    });
    const satGlowGeo = new THREE.SphereGeometry(0.045, 8, 8);

    // Add 5 orbital guide rings
    for (let p = 0; p < numPlanes; p++) {
      const ringGeo = new THREE.RingGeometry(orbitRadius - 0.003, orbitRadius + 0.003, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.12,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      ringMesh.rotation.y = (p * (180 / numPlanes) * Math.PI) / 180;
      ringMesh.rotation.z = (53 * Math.PI) / 180;
      orbitGroup.add(ringMesh);

      // Satellites for this plane
      for (let s = 0; s < satsPerPlane; s++) {
        const satMesh = new THREE.Mesh(satGeometry, satMaterial);
        const glowMesh = new THREE.Mesh(satGlowGeo, satGlowMat);
        satMesh.add(glowMesh);
        scene.add(satMesh);

        simSats.push({
          mesh: satMesh,
          plane: p,
          initialAngle: (s / satsPerPlane) * Math.PI * 2,
          speed: 0.4 + (p % 2) * 0.05,
        });
      }
    }

    // 6. Laser Crosslinks (Dynamic Line Mesh)
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
    });
    const lineGeo = new THREE.BufferGeometry();
    const maxLines = totalSats * 2;
    const linePositions = new Float32Array(maxLines * 6);
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    const ismLines = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(ismLines);

    // 7. Ground Stations
    const stationGroup = new THREE.Group();
    scene.add(stationGroup);

    STATIONS.forEach((station) => {
      const pos = latLonToVector3(station.lat, station.lon, globeRadius + 0.008);

      // Station Marker Pin
      const markerGeo = new THREE.CylinderGeometry(0.012, 0.002, 0.07, 8);
      const markerMat = new THREE.MeshBasicMaterial({ color: station.color });
      const pin = new THREE.Mesh(markerGeo, markerMat);
      pin.position.copy(pos);
      pin.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pos.clone().normalize());
      stationGroup.add(pin);

      // Outer Pulse Ring
      const pulseGeo = new THREE.RingGeometry(0.02, 0.038, 16);
      const pulseMat = new THREE.MeshBasicMaterial({
        color: station.color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      });
      const pulse = new THREE.Mesh(pulseGeo, pulseMat);
      pulse.position.copy(pos.clone().multiplyScalar(1.002));
      pulse.lookAt(pos.clone().multiplyScalar(2));
      stationGroup.add(pulse);
    });

    // 8. Animation Loop
    let animationFrameId: number;
    const startTime = performance.now();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = (performance.now() - startTime) * 0.001;

      controls.update();

      // Earth slow rotation sync with wireframe & stations
      earthMesh.rotation.y = elapsedTime * 0.03;
      wireMesh.rotation.y = elapsedTime * 0.03;
      stationGroup.rotation.y = elapsedTime * 0.03;

      // Update Satellites positions
      const satVectors: THREE.Vector3[] = [];
      simSats.forEach((sat, idx) => {
        const theta = sat.initialAngle + elapsedTime * sat.speed;
        const inc = (53 * Math.PI) / 180;
        const raan = (sat.plane * (180 / numPlanes) * Math.PI) / 180;

        // Plane rotation
        const unrotated = new THREE.Vector3(
          orbitRadius * Math.cos(theta),
          orbitRadius * Math.sin(theta) * Math.sin(inc),
          orbitRadius * Math.sin(theta) * Math.cos(inc)
        );

        // Apply RAAN
        const pos = unrotated.applyAxisAngle(new THREE.Vector3(0, 1, 0), raan);
        sat.mesh.position.copy(pos);
        satVectors[idx] = pos;
      });

      // Update Laser Inter-Satellite Links (ISL) between closest neighbor satellites
      let lineIdx = 0;
      const positions = lineGeo.attributes.position.array as Float32Array;

      for (let i = 0; i < satVectors.length; i++) {
        for (let j = i + 1; j < satVectors.length; j++) {
          const dist = satVectors[i].distanceTo(satVectors[j]);
          // Link if within distance and line-of-sight doesn't pierce earth
          if (dist > 0.4 && dist < 1.05 && lineIdx < maxLines) {
            const mid = satVectors[i].clone().add(satVectors[j]).multiplyScalar(0.5);
            if (mid.length() > globeRadius * 1.02) {
              positions[lineIdx * 6] = satVectors[i].x;
              positions[lineIdx * 6 + 1] = satVectors[i].y;
              positions[lineIdx * 6 + 2] = satVectors[i].z;
              positions[lineIdx * 6 + 3] = satVectors[j].x;
              positions[lineIdx * 6 + 4] = satVectors[j].y;
              positions[lineIdx * 6 + 5] = satVectors[j].z;
              lineIdx++;
            }
          }
        }
      }

      // Zero out unused lines
      for (let k = lineIdx * 6; k < positions.length; k++) {
        positions[k] = 0;
      }
      lineGeo.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animate();

    // Handle Window Resize
    const handleResize = () => {
      if (!mount) return;
      const newWidth = mount.clientWidth;
      const newHeight = mount.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [autoRotateSpeed]);

  return (
    <div className={`relative w-full h-full min-h-[420px] rounded-2xl overflow-hidden bg-gradient-to-b from-[#030712] via-[#050c1e] to-[#02050f] border border-cyan-500/20 shadow-[0_0_50px_rgba(6,182,212,0.15)] ${className}`}>
      {/* Three.js Canvas Mount */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Left HUD Telemetry */}
      <div className="absolute top-4 left-4 pointer-events-none z-10 flex flex-col gap-1.5 backdrop-blur-md bg-black/60 border border-cyan-500/20 px-3 py-2 rounded-lg font-mono text-[11px] text-cyan-400/90 shadow-lg">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span className="font-semibold text-white tracking-wider">CONSTELLATION TWIN</span>
        </div>
        <div className="text-white/60 text-[10px]">
          Altitude: <span className="text-cyan-300">550.0 km (LEO)</span>
        </div>
        <div className="text-white/60 text-[10px]">
          Planes / Inclination: <span className="text-cyan-300">5 / 53.0° Walker</span>
        </div>
        <div className="text-white/60 text-[10px]">
          Inter-Sat Optical Links: <span className="text-emerald-400">ACTIVE (10.0 Gbps)</span>
        </div>
      </div>

      {/* Top Right Quick Station Tags */}
      <div className="absolute top-4 right-4 z-10 hidden sm:flex flex-wrap max-w-[220px] justify-end gap-1.5">
        {STATIONS.map((stn) => (
          <button
            key={stn.name}
            onClick={() => {
              setActiveStation(stn.name);
              setHoverCoord({
                lat: `${Math.abs(stn.lat).toFixed(2)}° ${stn.lat >= 0 ? 'N' : 'S'}`,
                lon: `${Math.abs(stn.lon).toFixed(2)}° ${stn.lon >= 0 ? 'E' : 'W'}`,
              });
            }}
            className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-all ${
              activeStation === stn.name
                ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                : 'bg-black/40 border-white/10 text-white/70 hover:border-white/30'
            }`}
          >
            {stn.name.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Bottom Bar: Orbit Speed & Controls Hint */}
      <div className="absolute bottom-3 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
        <div className="backdrop-blur-md bg-black/50 border border-white/10 px-2.5 py-1 rounded text-[10px] font-mono text-white/50">
          Target Coord: <span className="text-cyan-300 font-semibold">{hoverCoord.lat}, {hoverCoord.lon}</span>
        </div>
        <div className="backdrop-blur-md bg-black/50 border border-white/10 px-2.5 py-1 rounded text-[10px] font-mono text-white/40">
          Drag to rotate • Scroll to zoom
        </div>
      </div>
    </div>
  );
};
