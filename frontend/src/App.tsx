import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import './App.css';
import { ShowcasePage } from './components/ShowcasePage';

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------
interface NodePos {
  x: number;
  y: number;
  z: number;
  id?: number;
  name?: string;
  is_active?: boolean;
}

interface GroundStation {
  id: number;
  name: string;
  desc?: string;
  lat: number;
  lon: number;
  pos: NodePos;
}

type LinkPair = [number, number];

interface PacketInfo {
  id: number;
  source: string;
  destination: string;
  from: number;
  to: number;
  progress: number;
  status: 'queued' | 'in_transit' | 'stored' | 'delivered';
  hops: number;
  latency_ms?: number;
  distance_km?: number;
  path: number[];
}

interface DeliveredPacket {
  id: number;
  source: string;
  destination: string;
  hops: number;
  latency_ms?: number;
  distance_km?: number;
  propagation_delay_ms?: number;
  queue_delay_ms?: number;
  delivered_at: string;
}

interface QoSMetrics {
  avg_latency_ms: number;
  min_latency_ms: number;
  max_latency_ms: number;
  total_dispatched: number;
  total_delivered: number;
  packet_loss_count: number;
  packet_loss_rate_pct: number;
  throughput_mbps: number;
  queue_saturation_pct: number;
  bottleneck_node: {
    id: number | null;
    name: string;
    queue_depth: number;
  };
  latency_history: number[];
}

interface StatsInfo {
  active_links_count: number;
  active_packets_count: number;
  total_delivered: number;
  delivered_history: DeliveredPacket[];
  active_nodes_count?: number;
  total_nodes_count?: number;
  offline_nodes?: number[];
  qos?: QoSMetrics;
}

interface WSPayload {
  earth_rotation: number;
  total_nodes_count?: number;
  satellites: NodePos[];
  ground_stations: GroundStation[];
  active_links: LinkPair[];
  packets: PacketInfo[];
  delivered_packets?: DeliveredPacket[];
  qos?: QoSMetrics;
  stats?: StatsInfo;
}

// ---------------------------------------------------------------------------
// Constants & Configuration
// ---------------------------------------------------------------------------
const EARTH_RADIUS_KM = 6371.0;
const EARTH_RADIUS_UNITS = 2.0;
const KM_TO_UNITS = EARTH_RADIUS_UNITS / EARTH_RADIUS_KM;
const WS_URL = 'ws://localhost:8765';
const MAX_RECONNECT_DELAY = 6000;

export const AVAILABLE_GATEWAYS = [
  { id: 'NYC', name: 'NYC Gateway (US)', region: 'North America' },
  { id: 'London', name: 'London Gateway (UK)', region: 'Europe West' },
  { id: 'Tokyo', name: 'Tokyo Gateway (JP)', region: 'Asia-Pacific' },
  { id: 'Sydney', name: 'Sydney Gateway (AU)', region: 'Oceania' },
  { id: 'Frankfurt', name: 'Frankfurt Gateway (DE)', region: 'Central Europe' },
  { id: 'Singapore', name: 'Singapore Gateway (SG)', region: 'Southeast Asia' },
] as const;

export type GatewayCode = typeof AVAILABLE_GATEWAYS[number]['id'];

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);

  // Latest simulation state read by the 60fps Three.js animation loop
  const satellitesRef = useRef<NodePos[]>([]);
  const groundStationsRef = useRef<GroundStation[]>([]);
  const activeLinksRef = useRef<LinkPair[]>([]);
  const packetsRef = useRef<PacketInfo[]>([]);
  const earthRotationRef = useRef<number>(0);

  // React state for HUD panels
  const [stats, setStats] = useState<StatsInfo>({
    active_links_count: 0,
    active_packets_count: 0,
    total_delivered: 0,
    delivered_history: []
  });
  const [activePackets, setActivePackets] = useState<PacketInfo[]>([]);
  const [recentDeliveries, setRecentDeliveries] = useState<DeliveredPacket[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [source, setSource] = useState<GatewayCode>('NYC');
  const [destination, setDestination] = useState<GatewayCode>('Tokyo');
  const [autoDispatch, setAutoDispatch] = useState<boolean>(false);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  const [qosData, setQosData] = useState<QoSMetrics | null>(null);
  const [qosMinimized, setQosMinimized] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'showcase' | 'simulator'>('showcase');

  useEffect(() => {
    if (viewMode === 'simulator') {
      document.body.style.overflow = 'hidden';
      const t = setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
        if (controlsRef.current) {
          controlsRef.current.update();
        }
      }, 50);
      return () => {
        clearTimeout(t);
        document.body.style.overflow = 'auto';
      };
    } else {
      document.body.style.overflow = 'auto';
    }
  }, [viewMode]);

  // Internal Three.js handles
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const requestRef = useRef<number>(0);
  const mountedRef = useRef<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);
  const selectedNodeIdRef = useRef<number | null>(null);
  const lastDispatchTimeRef = useRef<number>(0);

  // Sync ref with state
  const selectNode = useCallback((id: number | null) => {
    selectedNodeIdRef.current = id;
    setSelectedNodeId(id);
  }, []);

  // ------------------------------------------------------------------
  // WebSocket Connection Lifecycle with Deduplication & Teardown
  // ------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;
    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let reconnectDelay = 1000;

    const connect = () => {
      if (!isMounted) return;

      ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted) return;
        setWsConnected(true);
        reconnectDelay = 1000;
        console.log('[WebSocket] Connected to LEO Data Mesh server');
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const data: WSPayload = JSON.parse(event.data);

          satellitesRef.current = data.satellites ?? [];
          groundStationsRef.current = data.ground_stations ?? [];
          activeLinksRef.current = data.active_links ?? [];
          packetsRef.current = data.packets ?? [];
          earthRotationRef.current = data.earth_rotation ?? 0;

          if (data.stats) {
            setStats(data.stats);
          }
          if (data.qos) {
            setQosData(data.qos);
          } else if (data.stats?.qos) {
            setQosData(data.stats.qos);
          }

          setActivePackets(data.packets ?? []);

          // Deduplicate incoming delivered packets by unique ID before updating state
          const incoming: DeliveredPacket[] = data.delivered_packets ?? data.stats?.delivered_history ?? [];
          if (incoming.length > 0) {
            setRecentDeliveries((prev) => {
              const fresh = incoming.filter((pkt) => !prev.some((p) => p.id === pkt.id));
              if (fresh.length === 0) return prev;
              return [...prev, ...fresh].slice(-10);
            });
          }
        } catch (err) {
          console.error('[WebSocket] Message parsing error', err);
        }
      };

      ws.onerror = () => {
        if (!isMounted) return;
        setWsConnected(false);
      };

      ws.onclose = () => {
        if (!isMounted) return;
        setWsConnected(false);
        wsRef.current = null;
        reconnectTimer = window.setTimeout(() => {
          if (isMounted) {
            reconnectDelay = Math.min(reconnectDelay * 1.5, MAX_RECONNECT_DELAY);
            connect();
          }
        }, reconnectDelay);
      };
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
      }
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      wsRef.current = null;
    };
  }, []);

  // ------------------------------------------------------------------
  // Dispatch & Reset Commands with Double-Emission Guard
  // ------------------------------------------------------------------
  const handleDispatch = useCallback((src: string = source, dst: string = destination) => {
    const now = Date.now();
    if (now - lastDispatchTimeRef.current < 800) {
      return;
    }
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }

    lastDispatchTimeRef.current = now;
    setIsDispatching(true);
    setTimeout(() => setIsDispatching(false), 800);

    ws.send(JSON.stringify({ type: 'dispatch_packet', source: src, destination: dst }));
  }, [source, destination]);

  const getNodeName = useCallback((id: number): string => {
    const satCount = satellitesRef.current.length || 100;
    if (id >= satCount) {
      const gs = groundStationsRef.current.find(g => g.id === id);
      if (gs) return `${gs.name} Gateway`;
      const gsIdx = id - satCount;
      const fallback = groundStationsRef.current[gsIdx];
      return fallback ? `${fallback.name} Gateway` : `GS-${id}`;
    }
    return satellitesRef.current[id]?.name || `STARLINK-${id}`;
  }, []);

  const handleResetSimulation = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'reset' }));
    }
    const totalCount = satellitesRef.current.length || 100;
    setStats(prev => ({
      ...prev,
      active_packets_count: 0,
      total_delivered: 0,
      delivered_history: [],
      active_nodes_count: totalCount,
      total_nodes_count: totalCount,
      offline_nodes: []
    }));
    setRecentDeliveries([]);
    setActivePackets([]);
    packetsRef.current = [];
    setAutoDispatch(false);
  }, []);

  const handleKillNode = useCallback((nodeId: number) => {
    const ws = wsRef.current;
    const satCount = satellitesRef.current.length || 100;
    if (ws && ws.readyState === WebSocket.OPEN && nodeId < satCount) {
      ws.send(JSON.stringify({ type: 'kill_node', target_id: nodeId }));
    }
  }, []);

  const handleChaosEvent = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'chaos_event' }));
    }
  }, []);

  // Auto-dispatch timer effect
  useEffect(() => {
    if (!autoDispatch) return;

    const timer = setInterval(() => {
      handleDispatch(source, destination);
    }, 3500);

    return () => {
      clearInterval(timer);
    };
  }, [autoDispatch, handleDispatch, source, destination]);

  // Reset Camera View
  const handleResetCamera = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 3.5, 7.5);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  };

  // ------------------------------------------------------------------
  // Three.js Scene Setup & Render Loop
  // ------------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    mountedRef.current = true;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    // 2. CSS2D Label Renderer (HUD labels)
    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(width, height);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    labelRenderer.domElement.style.left = '0';
    labelRenderer.domElement.style.width = '100%';
    labelRenderer.domElement.style.height = '100%';
    labelRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(labelRenderer.domElement);

    // 3. Scene & Starfield
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020409);

    const starCount = 2500;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) {
      starPositions[i] = (Math.random() - 0.5) * 500;
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.35,
      transparent: true,
      opacity: 0.8
    });
    scene.add(new THREE.Points(starGeometry, starMaterial));

    // 4. Camera & OrbitControls
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 3.5, 7.5);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.7;
    controls.zoomSpeed = 1.0;
    controls.minDistance = 2.6;
    controls.maxDistance = 22.0;
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0x334466, 1.4);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 2.2);
    sunLight.position.set(12, 6, 10);
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x0088ff, 0.8);
    rimLight.position.set(-10, -4, -8);
    scene.add(rimLight);

    // 6. Earth Mesh & Materials
    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS_UNITS, 64, 64);
    const earthMat = new THREE.MeshPhongMaterial({
      color: 0x1a457a,
      emissive: 0x020814,
      shininess: 25,
      specular: 0x224488
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earthMesh);

    // Load High-Res NASA Earth Texture
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      'https://unpkg.com/three-globe@2.41.12/example/img/earth-blue-marble.jpg',
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        earthMat.map = tex;
        earthMat.color.set(0xffffff);
        earthMat.emissive.set(0x020610);
        earthMat.needsUpdate = true;
      },
      undefined,
      () => console.warn('[Earth] Texture load fallback')
    );

    // Earth Wireframe Grid
    const wireGeo = new THREE.SphereGeometry(EARTH_RADIUS_UNITS + 0.004, 36, 18);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x00d4ff,
      wireframe: true,
      transparent: true,
      opacity: 0.08
    });
    const wireMesh = new THREE.Mesh(wireGeo, wireMat);
    scene.add(wireMesh);

    // Atmospheric Glow Layer
    const atmosGeo = new THREE.SphereGeometry(EARTH_RADIUS_UNITS * 1.055, 64, 64);
    const atmosMat = new THREE.MeshBasicMaterial({
      color: 0x3388ff,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending
    });
    scene.add(new THREE.Mesh(atmosGeo, atmosMat));

    // 7. Constellation Orbital Planes (5 guide rings)
    const orbitRingGroup = new THREE.Group();
    const ringRadius = (EARTH_RADIUS_KM + 550.0) * KM_TO_UNITS;
    const ringGeo = new THREE.RingGeometry(ringRadius - 0.002, ringRadius + 0.002, 96);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.05
    });

    for (let p = 0; p < 5; p++) {
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      ringMesh.rotation.y = (p * 72.0 * Math.PI) / 180;
      ringMesh.rotation.z = (53.0 * Math.PI) / 180;
      orbitRingGroup.add(ringMesh);
    }
    scene.add(orbitRingGroup);

    // 8. Dynamic Satellites Pool
    const satelliteMeshes: THREE.Mesh[] = [];
    const satelliteHitboxes: THREE.Mesh[] = [];
    const satGeo = new THREE.SphereGeometry(0.038, 12, 12);
    const onlineSatMat = new THREE.MeshBasicMaterial({
      color: 0x00ffaa,
      transparent: true,
      opacity: 0.95
    });
    const offlineSatMat = new THREE.MeshBasicMaterial({
      color: 0xff3b30,
      transparent: true,
      opacity: 0.85
    });

    // Invisible expanded bounding sphere hitbox for easy raycasting
    const satHitboxGeo = new THREE.SphereGeometry(0.14, 8, 8);
    const satHitboxMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false
    });

    const ensureSatellitePool = (count: number) => {
      while (satelliteMeshes.length < count) {
        const idx = satelliteMeshes.length;
        const satMesh = new THREE.Mesh(satGeo, onlineSatMat);
        satMesh.userData = { satIdx: idx };
        satMesh.visible = false;

        const hitbox = new THREE.Mesh(satHitboxGeo, satHitboxMat);
        hitbox.userData = { satIdx: idx };
        satMesh.add(hitbox);
        satelliteHitboxes.push(hitbox);

        scene.add(satMesh);
        satelliteMeshes.push(satMesh);
      }
    };

    ensureSatellitePool(100);

    // Selected Node Target Reticle
    const reticleGeo = new THREE.RingGeometry(0.07, 0.09, 24);
    const reticleMat = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });
    const targetReticle = new THREE.Mesh(reticleGeo, reticleMat);
    targetReticle.visible = false;
    scene.add(targetReticle);

    // 9. Ground Station Pool (Dynamic 6 Continental Hubs)
    const groundStationMeshes: THREE.Mesh[] = [];
    const gsLabels: CSS2DObject[] = [];
    const gsRings: THREE.Mesh[] = [];
    const gsHitboxes: THREE.Mesh[] = [];

    const gsGeo = new THREE.SphereGeometry(0.055, 16, 16);
    const gsMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const gsRingGeo = new THREE.RingGeometry(0.08, 0.11, 24);
    const gsRingMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65
    });
    const gsHitboxGeo = new THREE.SphereGeometry(0.18, 8, 8);

    const ensureGroundStationPool = (count: number) => {
      while (groundStationMeshes.length < count) {
        const i = groundStationMeshes.length;
        const gsMesh = new THREE.Mesh(gsGeo, gsMat);
        gsMesh.userData = { gsIdx: i };
        gsMesh.visible = false;
        scene.add(gsMesh);
        groundStationMeshes.push(gsMesh);

        const ring = new THREE.Mesh(gsRingGeo, gsRingMat);
        ring.visible = false;
        scene.add(ring);
        gsRings.push(ring);

        const hitbox = new THREE.Mesh(gsHitboxGeo, satHitboxMat);
        hitbox.userData = { gsIdx: i };
        gsMesh.add(hitbox);
        gsHitboxes.push(hitbox);

        const labelDiv = document.createElement('div');
        labelDiv.className = 'gs-label';
        labelDiv.textContent = 'Gateway';
        labelDiv.onclick = (e) => {
          e.stopPropagation();
          const satCount = satellitesRef.current.length || 100;
          const gs = groundStationsRef.current[i];
          selectNode(gs ? gs.id : satCount + i);
        };
        const labelObj = new CSS2DObject(labelDiv);
        labelObj.position.set(0, 0.12, 0);
        gsMesh.add(labelObj);
        gsLabels.push(labelObj);
      }
    };

    ensureGroundStationPool(6);

    // 10. Dynamic Active Links (Cyan for ISL, Neon Green for GSL)
    const islMat = new THREE.LineBasicMaterial({
      color: 0x00d4ff,
      transparent: true,
      opacity: 0.38
    });
    const islGeo = new THREE.BufferGeometry();
    const islLines = new THREE.LineSegments(islGeo, islMat);
    scene.add(islLines);

    const gslMat = new THREE.LineBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.82
    });
    const gslGeo = new THREE.BufferGeometry();
    const gslLines = new THREE.LineSegments(gslGeo, gslMat);
    scene.add(gslLines);

    // 11. Packets Pool (Glowing yellow/white spheres)
    const packetMeshes: THREE.Mesh[] = [];
    const packetCoreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      blending: THREE.AdditiveBlending
    });
    const packetHaloMat = new THREE.MeshBasicMaterial({
      color: 0xffcc00,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });

    // 12. Raycaster for Interactive Node Inspection
    const raycaster = new THREE.Raycaster();
    raycaster.params.Points = { threshold: 0.2 };
    raycaster.params.Line = { threshold: 0.1 };
    const mouse = new THREE.Vector2();

    const handleCanvasClick = (event: MouseEvent) => {
      if (!mountedRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const clickables = [...satelliteHitboxes, ...satelliteMeshes, ...gsHitboxes, ...groundStationMeshes];
      const intersects = raycaster.intersectObjects(clickables, false);

      if (intersects.length > 0) {
        const clickedObj = intersects[0].object as THREE.Mesh;
        if (clickedObj.userData && typeof clickedObj.userData.satIdx === 'number') {
          selectNode(clickedObj.userData.satIdx);
          return;
        }
        if (clickedObj.userData && typeof clickedObj.userData.gsId === 'number') {
          selectNode(clickedObj.userData.gsId);
          return;
        }
        if (clickedObj.userData && typeof clickedObj.userData.gsIdx === 'number') {
          const gs = groundStationsRef.current[clickedObj.userData.gsIdx];
          const satCount = satellitesRef.current.length || 100;
          selectNode(gs ? gs.id : satCount + clickedObj.userData.gsIdx);
          return;
        }
        const satIdx = satelliteMeshes.indexOf(clickedObj);
        if (satIdx >= 0) {
          selectNode(satIdx);
          return;
        }
        const gsIdx = groundStationMeshes.indexOf(clickedObj);
        if (gsIdx >= 0) {
          const gs = groundStationsRef.current[gsIdx];
          const satCount = satellitesRef.current.length || 100;
          selectNode(gs ? gs.id : satCount + gsIdx);
          return;
        }
      } else {
        selectNode(null);
      }
    };

    renderer.domElement.addEventListener('click', handleCanvasClick);

    // ------------------------------------------------------------------
    // 60 FPS Render Loop
    // ------------------------------------------------------------------
    let clock = new THREE.Clock();

    const animate = () => {
      if (!mountedRef.current) return;
      requestRef.current = requestAnimationFrame(animate);

      const elapsed = clock.getElapsedTime();
      controls.update();

      // Synchronize Earth rotation with GMST
      const gmst = earthRotationRef.current;
      earthMesh.rotation.y = gmst;
      wireMesh.rotation.y = gmst;

      // Build unified 3D coordinate array (scene units)
      const allScenePos: THREE.Vector3[] = [];
      const satData = satellitesRef.current;
      const satCount = satData.length;
      const gsData = groundStationsRef.current;

      ensureSatellitePool(satCount);
      ensureGroundStationPool(gsData.length);

      // 1. Update Satellite Meshes
      for (let i = 0; i < satelliteMeshes.length; i++) {
        const mesh = satelliteMeshes[i];
        if (i < satCount) {
          const sd = satData[i];
          if (sd) {
            const sx = sd.x * KM_TO_UNITS;
            const sy = sd.y * KM_TO_UNITS;
            const sz = sd.z * KM_TO_UNITS;
            const v = new THREE.Vector3(sx, sy, sz);
            allScenePos[i] = v;

            mesh.position.copy(v);
            mesh.visible = true;

            const isOnline = sd.is_active !== false;
            mesh.material = isOnline ? onlineSatMat : offlineSatMat;

            if (selectedNodeIdRef.current === i) {
              const pulse = 1.0 + 0.4 * Math.sin(elapsed * 10);
              mesh.scale.setScalar(pulse);
            } else {
              mesh.scale.setScalar(1.0);
            }
          } else {
            allScenePos[i] = new THREE.Vector3();
            mesh.visible = false;
          }
        } else {
          mesh.visible = false;
        }
      }

      // 2. Update Ground Stations (All 6 continental gateways with Occlusion & Horizon Culling)
      const camPos = camera.position;
      for (let i = 0; i < gsData.length; i++) {
        const gs = gsData[i];
        if (gs) {
          const surfaceScale = (EARTH_RADIUS_KM + 35.0) / EARTH_RADIUS_KM;
          const gx = gs.pos.x * KM_TO_UNITS * surfaceScale;
          const gy = gs.pos.y * KM_TO_UNITS * surfaceScale;
          const gz = gs.pos.z * KM_TO_UNITS * surfaceScale;
          const v = new THREE.Vector3(gx, gy, gz);
          allScenePos[gs.id] = v;

          // Horizon & Occlusion check:
          // Earth is at (0, 0, 0). Vector v is the normal from Earth's core to the surface.
          // Direction vector from gateway to camera is (camPos - v).
          // If dot product > 0.05, the station is on the front visible hemisphere of Earth.
          // If dot product <= 0.05, the station is on the back side (occluded by Earth).
          const normal = v.clone().normalize();
          const toCam = new THREE.Vector3().subVectors(camPos, v).normalize();
          const dot = normal.dot(toCam);
          const isVisible = dot > 0.05;

          const mesh = groundStationMeshes[i];
          if (mesh) {
            mesh.userData = { gsId: gs.id, gsIdx: i };
            mesh.position.copy(v);
            mesh.visible = isVisible;
          }

          const ring = gsRings[i];
          if (ring) {
            ring.position.copy(v);
            ring.lookAt(0, 0, 0);
            ring.visible = isVisible;
            if (isVisible) {
              const ringPulse = 1.0 + 0.35 * Math.sin(elapsed * 4 + i);
              ring.scale.setScalar(ringPulse);
            }
          }

          const label = gsLabels[i];
          if (label) {
            const el = label.element as HTMLDivElement;
            if (!isVisible) {
              el.style.display = 'none';
              el.style.opacity = '0';
            } else {
              el.style.display = 'flex';
              // Smooth horizon fade so labels do not pop abruptly
              const fade = Math.min(1.0, Math.max(0.0, (dot - 0.05) * 4));
              el.style.opacity = fade.toFixed(2);

              const isSrc = gs.name === source;
              const isDst = gs.name === destination;
              el.className = `gs-label ${isSrc ? 'active-src' : isDst ? 'active-dst' : ''}`;
              el.innerHTML = `<span class="gs-label-dot"></span><span>${gs.name} Gateway</span>`;
            }
          }
        }
      }

      // 3. Update Target Reticle on Selected Node
      const currentSelected = selectedNodeIdRef.current;
      if (currentSelected !== null && allScenePos[currentSelected]) {
        const targetPos = allScenePos[currentSelected];
        targetReticle.position.copy(targetPos);
        targetReticle.lookAt(camera.position);
        targetReticle.visible = true;
        const retPulse = 1.0 + 0.2 * Math.sin(elapsed * 8);
        targetReticle.scale.setScalar(retPulse);
      } else {
        targetReticle.visible = false;
      }

      // 4. Update Dynamic Links (ISL vs GSL)
      const links = activeLinksRef.current;
      const islVerts: number[] = [];
      const gslVerts: number[] = [];

      for (const [aId, bId] of links) {
        const a = allScenePos[aId];
        const b = allScenePos[bId];
        if (a && b && (a.x !== 0 || a.y !== 0 || a.z !== 0) && (b.x !== 0 || b.y !== 0 || b.z !== 0)) {
          if (aId >= satCount || bId >= satCount) {
            gslVerts.push(a.x, a.y, a.z, b.x, b.y, b.z);
          } else {
            islVerts.push(a.x, a.y, a.z, b.x, b.y, b.z);
          }
        }
      }

      islGeo.setAttribute('position', new THREE.Float32BufferAttribute(islVerts, 3));
      islGeo.attributes.position.needsUpdate = true;

      gslGeo.setAttribute('position', new THREE.Float32BufferAttribute(gslVerts, 3));
      gslGeo.attributes.position.needsUpdate = true;

      // 5. Update Packets (Glowing traveling dots)
      const pkts = packetsRef.current;

      while (packetMeshes.length < pkts.length) {
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), packetCoreMat);
        const halo = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), packetHaloMat);
        core.add(halo);
        scene.add(core);
        packetMeshes.push(core);
      }

      for (let i = 0; i < packetMeshes.length; i++) {
        const mesh = packetMeshes[i];
        if (i < pkts.length) {
          const p = pkts[i];
          if (!p) {
            mesh.visible = false;
            continue;
          }
          const fromV = allScenePos[p.from];
          const toV = allScenePos[p.to];

          const hasValidFrom = fromV && (fromV.x !== 0 || fromV.y !== 0 || fromV.z !== 0);
          const hasValidTo = toV && (toV.x !== 0 || toV.y !== 0 || toV.z !== 0);

          if (hasValidFrom && hasValidTo) {
            if (p.from === p.to) {
              mesh.position.copy(fromV);
              const storePulse = 1.0 + 0.4 * Math.sin(elapsed * 12 + i);
              mesh.scale.setScalar(storePulse);
            } else {
              const progress = Math.max(0, Math.min(1, typeof p.progress === 'number' ? p.progress : 0));
              mesh.position.lerpVectors(fromV, toV, progress);
              const hopPulse = 1.0 + 0.3 * Math.sin(elapsed * 16 + i);
              mesh.scale.setScalar(hopPulse);
            }
            mesh.visible = true;
          } else {
            mesh.visible = false;
          }
        } else {
          mesh.visible = false;
        }
      }

      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container || !mountedRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      labelRenderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('click', handleCanvasClick);
      cancelAnimationFrame(requestRef.current);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      if (container.contains(labelRenderer.domElement)) {
        container.removeChild(labelRenderer.domElement);
      }
    };
  }, [selectNode]);

  // ------------------------------------------------------------------
  // Node Inspector Telemetry computation
  // ------------------------------------------------------------------
  const selectedNodeTelemetry = selectedNodeId !== null ? (() => {
    const satCount = satellitesRef.current.length || 100;
    const isGS = selectedNodeId >= satCount;
    const links = activeLinksRef.current;
    const connectedPeers = links
      .filter(([a, b]) => a === selectedNodeId || b === selectedNodeId)
      .map(([a, b]) => (a === selectedNodeId ? b : a));

    const activePacketsAtNode = activePackets.filter(
      p => (p.from === selectedNodeId && p.progress === 0) || p.to === selectedNodeId
    );

    if (isGS) {
      const gs = groundStationsRef.current.find(g => g.id === selectedNodeId) ||
                 groundStationsRef.current[selectedNodeId - satCount];
      const latStr = gs ? `${Math.abs(gs.lat).toFixed(2)}°${gs.lat >= 0 ? 'N' : 'S'}` : '';
      const lonStr = gs ? `${Math.abs(gs.lon).toFixed(2)}°${gs.lon >= 0 ? 'E' : 'W'}` : '';
      return {
        id: selectedNodeId,
        name: gs ? `${gs.name} Gateway` : `GS-${selectedNodeId}`,
        isGS: true,
        isOnline: true,
        type: `Optical Ground Terminal (${gs?.desc || 'Continental Hub'})`,
        location: `${latStr}, ${lonStr}`,
        altitude: '0 km (Sea Level)',
        linksCount: connectedPeers.length,
        peers: connectedPeers.map(p => {
          if (p >= satCount) {
            const peerGS = groundStationsRef.current.find(g => g.id === p);
            return peerGS ? `${peerGS.name} Gateway` : `GS-${p}`;
          }
          return satellitesRef.current[p]?.name || `SAT-${p}`;
        }),
        queuedPackets: activePacketsAtNode.length,
        speed: '0.46 km/s (Earth Surface)'
      };
    } else {
      const sat = satellitesRef.current[selectedNodeId];
      const isOnline = sat?.is_active !== false;
      const satName = sat?.name || `STARLINK-${selectedNodeId}`;
      return {
        id: selectedNodeId,
        name: satName,
        isGS: false,
        isOnline: isOnline,
        type: 'SpaceX Starlink LEO Constellation',
        location: 'Low Earth Orbit (53.0° Inc)',
        altitude: '~550 km (Operational Orbit)',
        linksCount: connectedPeers.length,
        peers: connectedPeers.map(p => {
          if (p >= satCount) {
            const peerGS = groundStationsRef.current.find(g => g.id === p);
            return peerGS ? `${peerGS.name} Gateway` : `GS-${p}`;
          }
          return satellitesRef.current[p]?.name || `SAT-${p}`;
        }),
        queuedPackets: activePacketsAtNode.length,
        speed: '7.59 km/s (95.6 min period)'
      };
    }
  })() : null;

  return (
    <>
      {viewMode === 'showcase' && (
        <ShowcasePage
          onLaunchSimulator={() => {
            setViewMode('simulator');
            setTimeout(() => {
              window.dispatchEvent(new Event('resize'));
            }, 60);
          }}
          stats={{
            satelliteCount: stats.active_nodes_count !== undefined ? stats.active_nodes_count : (satellitesRef.current.length || 100),
            activeLinks: stats.active_links_count || 468,
            groundStations: groundStationsRef.current.length || 6,
            deliveredCount: stats.total_delivered || recentDeliveries.length,
            avgLatencyMs: qosData?.avg_latency_ms || 38.4,
            isConnected: wsConnected,
          }}
        />
      )}

      <div
        className="app-root"
        ref={containerRef}
        style={{ display: viewMode === 'simulator' ? 'block' : 'none' }}
      >
        {/* Top Header Bar */}
        <header className="app-header">
          <div className="header-brand">
            <div className="brand-badge">
              <span className="brand-dot" />
              <span className="brand-title">SINGULARITY</span>
            </div>
            <span className="brand-sub">LEO Data Mesh Routing Simulator</span>
          </div>

          <div className="header-metrics">
            <button
              id="nav-to-showcase-btn"
              className="showcase-nav-btn"
              onClick={() => setViewMode('showcase')}
              title="Return to Singularity Showcase Website"
            >
              <span>🌐</span>
              <span>SHOWCASE HOME</span>
            </button>
            <div className="metric-pill">
            <span className="pill-dot connected" style={{ background: wsConnected ? '#00ffaa' : '#ff4444' }} />
            <span className="pill-text">{wsConnected ? 'SYSTEM ACTIVE' : 'RECONNECTING'}</span>
          </div>
          <div className="metric-pill">
            <span className="pill-label">ACTIVE ISLs:</span>
            <span className="pill-value cyan">{stats.active_links_count}</span>
          </div>
          <div className="metric-pill">
            <span className="pill-label">CONSTELLATION:</span>
            <span className="pill-value">
              {stats.active_nodes_count !== undefined
                ? `${stats.active_nodes_count} / ${stats.total_nodes_count || satellitesRef.current.length || 100} SATS`
                : `${satellitesRef.current.length || 100} SATS`}
            </span>
          </div>
          <div className="metric-pill">
            <span className="pill-label">GATEWAYS:</span>
            <span className="pill-value green">{groundStationsRef.current.length || 6} HUBS</span>
          </div>
          <div className="metric-pill">
            <span className="pill-label">DELIVERED:</span>
            <span className="pill-value green">{recentDeliveries.length}</span>
            {recentDeliveries.length > 0 && (
              <button
                className="reset-mini-btn"
                onClick={handleResetSimulation}
                title="Reset simulation counter and deliveries"
              >
                ↺
              </button>
            )}
          </div>
          <button className="reset-cam-btn" onClick={handleResetCamera} title="Reset 3D Camera">
            ⟲ Center Globe
          </button>
        </div>
      </header>

      {/* Control / Dispatch Panel */}
      <div className="control-panel">
        <div className="panel-title">
          <span>PACKET DISPATCHER</span>
        </div>

        <div className="dispatch-controls">
          <div className="route-select-group">
            <div className="select-col">
              <label>SOURCE GATEWAY</label>
              <select
                value={source}
                onChange={(e) => {
                  const val = e.target.value as GatewayCode;
                  setSource(val);
                  if (val === destination) {
                    const other = AVAILABLE_GATEWAYS.find(g => g.id !== val)?.id || 'London';
                    setDestination(other);
                  }
                }}
              >
                {AVAILABLE_GATEWAYS.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <span className="route-arrow">➔</span>

            <div className="select-col">
              <label>DESTINATION GATEWAY</label>
              <select
                value={destination}
                onChange={(e) => setDestination(e.target.value as GatewayCode)}
              >
                {AVAILABLE_GATEWAYS.map(g => (
                  <option key={g.id} value={g.id} disabled={g.id === source}>{g.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="button-group">
            <button
              className="dispatch-btn"
              onClick={() => handleDispatch()}
              disabled={!wsConnected || isDispatching}
            >
              <span className="btn-spark" />
              {isDispatching ? 'DISPATCHING...' : 'DISPATCH PACKET'}
            </button>

            <button
              className={`auto-btn ${autoDispatch ? 'active' : ''}`}
              onClick={() => setAutoDispatch(!autoDispatch)}
            >
              {autoDispatch ? '■ STOP AUTO' : '▶ AUTO DISPATCH'}
            </button>

            <button
              className="reset-btn"
              onClick={handleResetSimulation}
              title="Reset all packets, history, and delivery stats"
            >
              ↺ RESET SIMULATION
            </button>
          </div>
        </div>
      </div>

      {/* Live Routing Feed & Deliveries (Bottom Left) */}
      <div className="routing-feed-panel">
        <div className="feed-header">
          <span>LIVE PACKET ROUTING FEED</span>
          <span className="feed-count">{activePackets.length} in transit</span>
        </div>

        <div className="feed-list">
          {activePackets.length === 0 ? (
            <div className="feed-empty">
              <span>Ready for cross-continental routing. Select gateways & click 'DISPATCH PACKET'.</span>
            </div>
          ) : (
            activePackets.map((pkt) => {
              const fromName = getNodeName(pkt.from);
              const toName = getNodeName(pkt.to);
              return (
                <div key={pkt.id} className="packet-card">
                  <div className="pkt-header">
                    <span className="pkt-badge">PKT #{pkt.id}</span>
                    <span className="pkt-route">{pkt.source} ➔ {pkt.destination}</span>
                    <span className="pkt-hops">
                      {pkt.latency_ms !== undefined && pkt.latency_ms > 0 ? (
                        <span className="cyan">{pkt.latency_ms.toFixed(1)} ms · </span>
                      ) : null}
                      {pkt.hops} {pkt.hops === 1 ? 'hop' : 'hops'}
                    </span>
                  </div>

                  <div className="pkt-status-row">
                    <span className="pkt-hop-arrow">
                      {pkt.from === pkt.to ? `Stored at ${fromName}` : `${fromName} ➔ ${toName}`}
                    </span>
                    <span className="pkt-pct">{Math.round(pkt.progress * 100)}%</span>
                  </div>

                  <div className="progress-bar-bg">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${Math.round(pkt.progress * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {recentDeliveries.length > 0 && (
          <div className="delivery-history">
            <div className="delivery-title">RECENT DELIVERIES</div>
            <div className="delivery-tags">
              {recentDeliveries.slice(-5).map((d) => (
                <div key={d.id} className="delivery-tag">
                  ✓ PKT #{d.id} ({d.source}➔{d.destination}, {d.hops} hops
                  {d.latency_ms ? ` · ${d.latency_ms.toFixed(1)}ms` : ''}
                  {d.distance_km ? ` · ${d.distance_km.toFixed(0)}km` : ''} at {d.delivered_at})
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Phase 5: Real-Time QoS Analytics Dashboard (Top Right HUD) */}
      <div className={`qos-dashboard-panel ${selectedNodeTelemetry ? 'drawer-open' : ''} ${qosMinimized ? 'minimized' : ''}`}>
        <div className="qos-header" onClick={() => setQosMinimized(!qosMinimized)}>
          <div className="qos-title-box">
            <span className="qos-icon">⚡</span>
            <span className="qos-title">REAL-TIME QoS ANALYTICS</span>
          </div>
          <button className="qos-toggle-btn" title={qosMinimized ? "Expand QoS Dashboard" : "Minimize QoS Dashboard"}>
            {qosMinimized ? '▼ EXPAND' : '▲ MINIMIZE'}
          </button>
        </div>

        {!qosMinimized && (
          <div className="qos-content">
            <div className="qos-grid">
              {/* Mean Latency */}
              <div className="qos-card">
                <span className="qos-card-label">MEAN E2E LATENCY</span>
                <span className="qos-card-val cyan">
                  {qosData && qosData.avg_latency_ms > 0 ? `${qosData.avg_latency_ms} ms` : '—'}
                </span>
                <span className="qos-card-sub">
                  {qosData && qosData.min_latency_ms > 0
                    ? `Min ${qosData.min_latency_ms} · Max ${qosData.max_latency_ms}`
                    : 'Speed-of-light (c)'}
                </span>
              </div>

              {/* Packet Loss */}
              <div className="qos-card">
                <span className="qos-card-label">PACKET LOSS</span>
                <span className={`qos-card-val ${(qosData?.packet_loss_rate_pct ?? 0) > 5 ? 'danger' : 'green'}`}>
                  {qosData ? `${qosData.packet_loss_rate_pct}%` : '0.0%'}
                </span>
                <span className="qos-card-sub">
                  {qosData ? `${qosData.packet_loss_count} dropped` : '0 dropped'}
                </span>
              </div>

              {/* Throughput */}
              <div className="qos-card">
                <span className="qos-card-label">NET THROUGHPUT</span>
                <span className="qos-card-val green">
                  {qosData ? `${qosData.throughput_mbps} Mbps` : '0 Mbps'}
                </span>
                <span className="qos-card-sub">Rolling 3s Window</span>
              </div>

              {/* Saturation */}
              <div className="qos-card">
                <span className="qos-card-label">BUFFER SATURATION</span>
                <span className={`qos-card-val ${(qosData?.queue_saturation_pct ?? 0) > 50 ? 'warning' : 'cyan'}`}>
                  {qosData ? `${qosData.queue_saturation_pct}%` : '0.0%'}
                </span>
                <div className="qos-bar-wrap">
                  <div
                    className={`qos-bar-fill ${(qosData?.queue_saturation_pct ?? 0) > 50 ? 'warning' : ''}`}
                    style={{ width: `${Math.min(100, qosData?.queue_saturation_pct ?? 0)}%` }}
                  />
                </div>
              </div>

              {/* Bottleneck Node Alert */}
              <div className="qos-card full-width">
                <span className="qos-card-label">BOTTLENECK SATELLITE</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                  <span className="qos-card-val" style={{ fontSize: '13px' }}>
                    {qosData?.bottleneck_node.name || 'Normal (Equally Balanced)'}
                  </span>
                  <span className="hw-bridge-badge">
                    <span className="hw-dot" />
                    ESP32 LoRa Bridge Active
                  </span>
                </div>
              </div>

              {/* Latency Distribution Sparkline */}
              {qosData?.latency_history && qosData.latency_history.length > 0 && (
                <div className="qos-card full-width">
                  <span className="qos-card-label">RECENT LATENCY DISTRIBUTION (ms)</span>
                  <div className="qos-sparkline-box">
                    {qosData.latency_history.slice(-16).map((lat, idx) => {
                      const maxL = Math.max(...qosData.latency_history, 50);
                      const pct = Math.max(15, Math.min(100, (lat / maxL) * 100));
                      return (
                        <div
                          key={idx}
                          className="qos-spark-bar"
                          style={{ height: `${pct}%` }}
                          title={`Delivery #${idx + 1}: ${lat} ms`}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Node Inspector Telemetry Drawer (Right side) */}
      {selectedNodeTelemetry ? (
        <div className={`telemetry-drawer ${selectedNodeTelemetry.isOnline ? '' : 'offline-node'}`}>
          <div className="telem-header">
            <div className="telem-title">
              <span className="telem-glyph">⬡</span>
              <span>NODE TELEMETRY</span>
            </div>
            <button className="telem-close" onClick={() => selectNode(null)}>✕</button>
          </div>

          <div className="telem-content">
            <div className="node-status-row">
              <div className="telem-main-id">{selectedNodeTelemetry.name}</div>
              <span className={`status-badge ${selectedNodeTelemetry.isOnline ? 'online' : 'offline'}`}>
                <span className="status-dot-sm" />
                {selectedNodeTelemetry.isOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
            <div className="telem-subtitle">{selectedNodeTelemetry.type}</div>

            <div className="telem-grid">
              <div className="telem-item">
                <span className="t-label">STATUS</span>
                <span className={`t-val ${selectedNodeTelemetry.isOnline ? 'green' : 'danger'}`}>
                  {selectedNodeTelemetry.isOnline ? 'OPERATIONAL' : 'OFFLINE / DESTROYED'}
                </span>
              </div>
              <div className="telem-item">
                <span className="t-label">ALTITUDE</span>
                <span className="t-val cyan">{selectedNodeTelemetry.altitude}</span>
              </div>
              <div className="telem-item">
                <span className="t-label">VELOCITY</span>
                <span className="t-val">{selectedNodeTelemetry.speed}</span>
              </div>
              <div className="telem-item">
                <span className="t-label">COORDINATES</span>
                <span className="t-val">{selectedNodeTelemetry.location}</span>
              </div>
              <div className="telem-item">
                <span className="t-label">ACTIVE PEERS</span>
                <span className={`t-val ${selectedNodeTelemetry.linksCount > 0 ? 'green' : 'danger'}`}>
                  {selectedNodeTelemetry.linksCount} Active Links
                </span>
              </div>
              <div className="telem-item">
                <span className="t-label">BUFFER QUEUE</span>
                <span className="t-val">{selectedNodeTelemetry.queuedPackets} Packets</span>
              </div>
            </div>

            {selectedNodeTelemetry.peers.length > 0 && (
              <div className="telem-peers-box">
                <span className="t-label">CONNECTED PEERS</span>
                <div className="peers-chips">
                  {selectedNodeTelemetry.peers.map((peer, idx) => (
                    <span key={idx} className="peer-chip">{peer}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Kill Node Button (Satellites only) */}
            {!selectedNodeTelemetry.isGS && (
              <button
                className="kill-node-btn"
                onClick={() => handleKillNode(selectedNodeTelemetry.id)}
                disabled={!selectedNodeTelemetry.isOnline || !wsConnected}
                title={selectedNodeTelemetry.isOnline ? "Simulate satellite failure / kill node" : "Satellite is already offline"}
              >
                <span>💥</span>
                <span>{selectedNodeTelemetry.isOnline ? 'KILL NODE' : 'NODE DESTROYED'}</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="inspector-hint">
          <span>Tip: Click any satellite or continental gateway to inspect real-time telemetry</span>
        </div>
      )}

      {/* Global Chaos Controls UI Deck (Bottom Center) */}
      <div className="chaos-deck">
        <div className="deck-status-item">
          <span>MESH HEALTH:</span>
          {(() => {
            const totalSats = stats.total_nodes_count ?? (satellitesRef.current.length || 100);
            const activeSats = stats.active_nodes_count ?? totalSats;
            const isFull = activeSats === totalSats;
            const isWarning = activeSats > Math.floor(totalSats * 0.6);
            return (
              <span className={`deck-status-val ${isFull ? 'green' : isWarning ? 'warning' : 'danger'}`}>
                {activeSats} / {totalSats} ONLINE
              </span>
            );
          })()}
        </div>

        <button
          className="btn-emp"
          onClick={handleChaosEvent}
          disabled={!wsConnected}
          title="Simulate EMP blast: destroy 20% of active satellites"
        >
          <span>⚡</span>
          <span>EMP / CHAOS EVENT</span>
        </button>

        <button
          className="btn-reset-chaos"
          onClick={handleResetSimulation}
          title="Restore all destroyed satellites, reset QoS counters and clear queues"
        >
          <span>↺</span>
          <span>RESET SIMULATION</span>
        </button>
      </div>
    </div>
  </>
  );
}