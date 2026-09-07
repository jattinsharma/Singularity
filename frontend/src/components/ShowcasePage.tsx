import React from 'react';
import {
  Satellite,
  Radio,
  Zap,
  Globe,
  ShieldAlert,
  Cpu,
  Layers,
  Sparkles,
  Rocket,
  Compass,
  Server,
  Play,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ContainerScroll } from '@/components/ui/container-scroll-animation';
import RadialOrbitalTimeline from '@/components/ui/radial-orbital-timeline';
import type { TimelineItem } from '@/components/ui/radial-orbital-timeline';
import { Globe3D } from '@/components/ui/Globe3D';

interface ShowcaseStats {
  satelliteCount?: number;
  activeLinks?: number;
  groundStations?: number;
  deliveredCount?: number;
  avgLatencyMs?: number;
  isConnected?: boolean;
}

interface ShowcasePageProps {
  onLaunchSimulator: () => void;
  stats?: ShowcaseStats;
}

// ---------------------------------------------------------------------------
// Aerospace Architecture Timeline Data
// ---------------------------------------------------------------------------
const SINGULARITY_TIMELINE: TimelineItem[] = [
  {
    id: 1,
    title: 'SGP4 Orbital Core',
    date: 'Phase 1',
    content: 'Simplified General Perturbations (SGP4) analytical propagator computing J2 gravitational zonal harmonics and orbital state vectors for 100 satellites in real time.',
    category: 'Physics',
    icon: Compass,
    relatedIds: [2],
    status: 'completed',
    energy: 100,
  },
  {
    id: 2,
    title: 'Coherent Laser ISL',
    date: 'Phase 2',
    content: 'Dynamic 1550nm optical inter-satellite crosslinks with line-of-sight acquisition, pointing, and tracking (ATP) across 5 Walker star orbital planes.',
    category: 'Optical',
    icon: Zap,
    relatedIds: [1, 3],
    status: 'completed',
    energy: 95,
  },
  {
    id: 3,
    title: 'Store-Carry-Forward',
    date: 'Phase 3',
    content: 'Disruption-Tolerant Networking (DTN) memory buffer. Satellites carry packets through orbital transit when optical crosslinks drop over dark oceanic sectors.',
    category: 'Routing',
    icon: Server,
    relatedIds: [2, 4],
    status: 'completed',
    energy: 90,
  },
  {
    id: 4,
    title: 'Solar EMP & Chaos',
    date: 'Phase 4',
    content: 'Atmospheric radiation event generator and node failure injection engine testing autonomous sub-millisecond mesh rerouting under severe satellite attrition.',
    category: 'Resilience',
    icon: ShieldAlert,
    relatedIds: [3, 5],
    status: 'completed',
    energy: 85,
  },
  {
    id: 5,
    title: 'Global Ground Grid',
    date: 'Phase 5',
    content: '6 strategic high-throughput continental gateway terminals in New York, London, Frankfurt, Tokyo, Singapore, and Sydney calculating true speed-of-light propagation delays.',
    category: 'Gateways',
    icon: Globe,
    relatedIds: [4, 6],
    status: 'completed',
    energy: 92,
  },
  {
    id: 6,
    title: 'Multi-Shell Relays',
    date: 'Phase 6',
    content: 'Hierarchical vertical Inter-Layer Links (ILL) integrating LEO (550 km), MEO (8,000 km), and GEO (35,786 km) space relays for worldwide redundancy.',
    category: 'Constellation',
    icon: Layers,
    relatedIds: [5, 7],
    status: 'in-progress',
    energy: 65,
  },
  {
    id: 7,
    title: 'ESP32 LoRa Bridge',
    date: 'Phase 7',
    content: 'Hardware-in-the-Loop bridge transforming simulated packets into real 433/868/915 MHz LoRa sub-GHz radio waves using physical USB-attached microcontrollers.',
    category: 'Hardware',
    icon: Cpu,
    relatedIds: [6],
    status: 'completed',
    energy: 88,
  },
];

export const ShowcasePage: React.FC<ShowcasePageProps> = ({
  onLaunchSimulator,
  stats = {
    satelliteCount: 100,
    activeLinks: 468,
    groundStations: 6,
    deliveredCount: 42,
    avgLatencyMs: 38.4,
    isConnected: true,
  },
}) => {
  return (
    <div className="min-h-screen bg-[#020408] text-slate-100 font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Background Subtle Radial Lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[20%] w-[600px] h-[600px] rounded-full bg-cyan-500/10 blur-[130px]" />
        <div className="absolute top-[35%] right-[-10%] w-[550px] h-[550px] rounded-full bg-indigo-500/10 blur-[140px]" />
        <div className="absolute bottom-[10%] left-[5%] w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-[120px]" />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 1. Header / Navigation */}
      {/* ------------------------------------------------------------------ */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#020408]/80 border-b border-cyan-500/10 px-6 py-3.5 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-500 p-[1px] shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-400/40 transition-all">
              <div className="w-full h-full bg-[#020610] rounded-xl flex items-center justify-center">
                <Satellite className="w-5 h-5 text-cyan-400 group-hover:rotate-12 transition-transform duration-300" />
              </div>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-extrabold tracking-widest text-sm bg-gradient-to-r from-white via-cyan-100 to-cyan-300 bg-clip-text text-transparent font-['Outfit']">
                  SINGULARITY
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded border border-cyan-500/30 text-cyan-400 font-mono">
                  v5.0
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono tracking-tight">
                LEO SATELLITE DATA MESH
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-slate-400">
            <a href="#constellation" className="hover:text-cyan-400 transition-colors">
              Constellation Twin
            </a>
            <a href="#preview" className="hover:text-cyan-400 transition-colors">
              3D Simulator
            </a>
            <a href="#physics" className="hover:text-cyan-400 transition-colors">
              Physics vs Cables
            </a>
            <a href="#architecture" className="hover:text-cyan-400 transition-colors">
              Architecture
            </a>
            <a href="#timeline" className="hover:text-cyan-400 transition-colors">
              Roadmap
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-950/40 border border-cyan-500/20 text-[11px] font-mono text-cyan-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>100 NODES ACTIVE</span>
            </div>

            <Button
              onClick={onLaunchSimulator}
              className="relative group overflow-hidden bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-semibold text-xs px-4 py-2 rounded-lg shadow-lg shadow-cyan-500/20 hover:shadow-cyan-400/40 transition-all cursor-pointer"
            >
              <Rocket className="w-3.5 h-3.5 mr-1.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              Launch Mission Control
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-12 pb-24 flex flex-col gap-24">
        {/* ------------------------------------------------------------------ */}
        {/* 2. Hero Section */}
        {/* ------------------------------------------------------------------ */}
        <section className="flex flex-col items-center text-center pt-8 md:pt-14 gap-8">
          {/* Status Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/50 border border-cyan-500/30 text-xs text-cyan-300 font-mono shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin" style={{ animationDuration: '4s' }} />
            <span>SGP4 ASTRODYNAMICS ENGINE • REAL-TIME DIGITAL TWIN</span>
          </div>

          {/* Headline */}
          <div className="max-w-4xl flex flex-col gap-4">
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.08] font-['Outfit']">
              The Speed of Light <br className="hidden sm:inline" />
              in the{' '}
              <span className="bg-gradient-to-r from-cyan-300 via-sky-400 to-indigo-400 bg-clip-text text-transparent">
                Vacuum of Space
              </span>
            </h1>
            <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Explore autonomous optical crosslink routing across a 100-satellite Walker Star constellation.
              Bypass terrestrial fiber bottlenecks and undersea cable disruptions with real-time Store-Carry-Forward networking.
            </p>
          </div>

          {/* Dual CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button
              onClick={onLaunchSimulator}
              size="lg"
              className="bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold px-8 py-6 rounded-xl shadow-[0_0_30px_rgba(6,182,212,0.4)] hover:shadow-[0_0_45px_rgba(6,182,212,0.6)] transition-all cursor-pointer text-sm"
            >
              <Play className="w-4 h-4 mr-2 fill-current" />
              Launch Mission Control (3D WebGL)
            </Button>
            <a href="#constellation">
              <Button
                variant="outline"
                size="lg"
                className="border-slate-800 bg-slate-950/60 hover:bg-slate-900/80 text-slate-200 px-6 py-6 rounded-xl border font-medium text-sm transition-all cursor-pointer"
              >
                <Globe className="w-4 h-4 mr-2 text-cyan-400" />
                Explore Constellation Twin
              </Button>
            </a>
          </div>

          {/* Telemetry Stats Strip */}
          <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <Card className="bg-slate-950/50 border-cyan-500/15 backdrop-blur-md">
              <CardHeader className="p-5 pb-2 text-left">
                <CardDescription className="text-slate-400 text-xs font-mono">CONSTELLATION NODES</CardDescription>
                <CardTitle className="text-2xl sm:text-3xl font-bold font-mono text-cyan-400">
                  {stats.satelliteCount || 100}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0 text-left text-[11px] text-slate-500 font-mono">
                Walker 100/5/1 • 53.0° Inc
              </CardContent>
            </Card>

            <Card className="bg-slate-950/50 border-cyan-500/15 backdrop-blur-md">
              <CardHeader className="p-5 pb-2 text-left">
                <CardDescription className="text-slate-400 text-xs font-mono">ORBITAL ALTITUDE</CardDescription>
                <CardTitle className="text-2xl sm:text-3xl font-bold font-mono text-white">
                  550 <span className="text-sm text-cyan-400 font-normal">km</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0 text-left text-[11px] text-slate-500 font-mono">
                LEO • 96 min orbital period
              </CardContent>
            </Card>

            <Card className="bg-slate-950/50 border-cyan-500/15 backdrop-blur-md">
              <CardHeader className="p-5 pb-2 text-left">
                <CardDescription className="text-slate-400 text-xs font-mono">NYC → TOKYO LATENCY</CardDescription>
                <CardTitle className="text-2xl sm:text-3xl font-bold font-mono text-emerald-400">
                  ~{stats.avgLatencyMs || 38.4} <span className="text-sm text-emerald-300 font-normal">ms</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0 text-left text-[11px] text-slate-500 font-mono">
                vs ~110ms undersea fiber
              </CardContent>
            </Card>

            <Card className="bg-slate-950/50 border-cyan-500/15 backdrop-blur-md">
              <CardHeader className="p-5 pb-2 text-left">
                <CardDescription className="text-slate-400 text-xs font-mono">GROUND GATEWAYS</CardDescription>
                <CardTitle className="text-2xl sm:text-3xl font-bold font-mono text-cyan-400">
                  {stats.groundStations || 6} <span className="text-sm text-slate-400 font-normal">Hubs</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0 text-left text-[11px] text-slate-500 font-mono">
                NYC, LON, FRA, TYO, SIN, SYD
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* 3. Container Scroll Animation (Mission Control Preview) */}
        {/* ------------------------------------------------------------------ */}
        <section id="preview" className="relative -mt-16 md:-mt-24">
          <ContainerScroll
            titleComponent={
              <div className="flex flex-col items-center gap-3">
                <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 font-mono px-3 py-1">
                  FULL 3D ORBITAL SIMULATOR
                </Badge>
                <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white font-['Outfit']">
                  Mission Control in Your Browser
                </h2>
                <p className="text-slate-400 text-sm max-w-xl mx-auto">
                  Interactive real-time physics simulation powered by Three.js WebGL and FastAPI WebSocket telemetry.
                </p>
              </div>
            }
          >
            {/* Live Interactive Mission Control Preview Card */}
            <div className="relative w-full h-full bg-[#030712] rounded-xl overflow-hidden flex flex-col group">
              {/* Simulator Top Bar Mockup */}
              <div className="h-10 bg-slate-900/90 border-b border-slate-800 px-4 flex items-center justify-between text-xs font-mono text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/80"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500/80"></span>
                  <span className="ml-2 text-cyan-300 font-semibold">SINGULARITY MISSION CONTROL // ORBITAL LIVE</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                    60 FPS
                  </span>
                  <span className="text-slate-500 hidden sm:inline">EPOCH: 2026.248</span>
                </div>
              </div>

              {/* Graphic Simulator Backdrop with Mission Overlay */}
              <div className="relative flex-1 bg-gradient-to-b from-[#040a18] via-[#02050f] to-[#010206] p-6 flex flex-col justify-between overflow-hidden">
                {/* Visual Grid Lines */}
                <div
                  className="absolute inset-0 opacity-15 pointer-events-none"
                  style={{
                    backgroundImage: `radial-gradient(#38bdf8 1px, transparent 1px)`,
                    backgroundSize: '28px 28px',
                  }}
                />

                {/* Top HUD Mockup */}
                <div className="relative z-10 flex justify-between items-start">
                  <div className="backdrop-blur-md bg-black/60 border border-cyan-500/20 p-3 rounded-lg flex flex-col gap-1 text-[11px] font-mono text-slate-300">
                    <div className="text-cyan-400 font-semibold">PACKET DISPATCH ROUTE</div>
                    <div>Source: <span className="text-white">NYC Ground Station</span> (40.71° N, 74.00° W)</div>
                    <div>Target: <span className="text-white">Tokyo Terminal</span> (35.67° N, 139.65° E)</div>
                    <div>Routing: <span className="text-emerald-400">Dynamic Dijkstra ISL</span> (5 Hops)</div>
                  </div>

                  <div className="backdrop-blur-md bg-black/60 border border-cyan-500/20 p-3 rounded-lg flex flex-col gap-1 text-[11px] font-mono text-right text-slate-300">
                    <div className="text-cyan-400 font-semibold">CHAOS INJECTION</div>
                    <div className="text-white/80">Solar EMP Event: <span className="text-emerald-400">STANDBY</span></div>
                    <div className="text-white/80">Active Mesh Relays: <span className="text-cyan-300">468 Links</span></div>
                  </div>
                </div>

                {/* Center Launch Overlay CTA */}
                <div className="relative z-10 flex flex-col items-center justify-center gap-3 my-auto">
                  <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-400/40 backdrop-blur-md flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.3)] group-hover:scale-110 transition-transform duration-300">
                    <Play className="w-8 h-8 text-cyan-400 fill-cyan-400/20 ml-1" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white font-['Outfit']">
                    Click to Enter Full Digital Twin
                  </h3>
                  <Button
                    onClick={onLaunchSimulator}
                    className="bg-cyan-400 hover:bg-cyan-300 text-black font-bold text-xs px-6 py-2 rounded-lg cursor-pointer"
                  >
                    Open Live 3D WebGL View
                  </Button>
                </div>

                {/* Bottom Status Feed Mockup */}
                <div className="relative z-10 flex items-center justify-between text-[10px] font-mono text-slate-400 border-t border-white/5 pt-3">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400">● DELIVERED</span>
                    <span>PKT #4120 • 38.2 ms • Hops: SAT-012 → SAT-014 → SAT-022 → SAT-045 → TYO</span>
                  </div>
                  <div className="hidden sm:inline text-cyan-400">
                    LoRa Bridge: 868.1 MHz OK
                  </div>
                </div>
              </div>
            </div>
          </ContainerScroll>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* 4. Interactive 3D Globe Section (Constellation Digital Twin) */}
        {/* ------------------------------------------------------------------ */}
        <section id="constellation" className="flex flex-col gap-8 pt-4">
          <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
            <div className="flex flex-col gap-2">
              <Badge variant="outline" className="w-fit border-cyan-500/30 text-cyan-400 font-mono">
                INTERACTIVE 3D ASTRODYNAMICS
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-['Outfit']">
                Global Constellation Digital Twin
              </h2>
              <p className="text-slate-400 text-sm max-w-xl">
                Inspect 5 inclined orbital planes, laser inter-satellite crosslinks, and 6 strategic ground stations in real-time.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
              <span>LIVE THREE.JS RENDERER</span>
            </div>
          </div>

          {/* Main 3D Globe & Technical Telemetry Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Globe Canvas Container */}
            <div className="lg:col-span-8 h-[480px] sm:h-[560px]">
              <Globe3D autoRotateSpeed={0.4} />
            </div>

            {/* Right Telemetry & Architecture Cards */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              <Card className="bg-slate-950/60 border-cyan-500/20 backdrop-blur-md flex-1">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2 text-cyan-400">
                    <Radio className="w-4 h-4" />
                    <CardTitle className="text-sm font-semibold uppercase tracking-wider font-mono">
                      Orbital Configuration
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs text-slate-400">
                    Walker Star 100/5/1 Astrodynamics
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 text-xs font-mono text-slate-300">
                  <div className="flex justify-between py-1.5 border-b border-white/5">
                    <span className="text-slate-400">Orbital Planes:</span>
                    <span className="text-cyan-300 font-bold">5 Planes (72° RAAN spacing)</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-white/5">
                    <span className="text-slate-400">Sats per Plane:</span>
                    <span className="text-cyan-300 font-bold">20 Satellites</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-white/5">
                    <span className="text-slate-400">Orbital Inclination:</span>
                    <span className="text-cyan-300 font-bold">53.0° Polar-Optimized</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-white/5">
                    <span className="text-slate-400">Mean Orbital Speed:</span>
                    <span className="text-emerald-400 font-bold">7.56 km/s (27,216 km/h)</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-400">Optical Wavelength:</span>
                    <span className="text-indigo-400 font-bold">1550 nm (C-band Laser)</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-950/60 border-cyan-500/20 backdrop-blur-md">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2 text-cyan-400">
                    <Globe className="w-4 h-4" />
                    <CardTitle className="text-sm font-semibold uppercase tracking-wider font-mono">
                      Strategic Gateway Grid
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-xs font-mono">
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-slate-900/80 p-2 rounded border border-white/5">
                      <div className="text-cyan-300 font-semibold">NYC Gateway</div>
                      <div className="text-slate-500">40.71° N, 74.00° W</div>
                    </div>
                    <div className="bg-slate-900/80 p-2 rounded border border-white/5">
                      <div className="text-cyan-300 font-semibold">London Station</div>
                      <div className="text-slate-500">51.50° N, 0.12° W</div>
                    </div>
                    <div className="bg-slate-900/80 p-2 rounded border border-white/5">
                      <div className="text-blue-300 font-semibold">Frankfurt Hub</div>
                      <div className="text-slate-500">50.11° N, 8.68° E</div>
                    </div>
                    <div className="bg-slate-900/80 p-2 rounded border border-white/5">
                      <div className="text-emerald-300 font-semibold">Tokyo Terminal</div>
                      <div className="text-slate-500">35.67° N, 139.65° E</div>
                    </div>
                    <div className="bg-slate-900/80 p-2 rounded border border-white/5">
                      <div className="text-purple-300 font-semibold">Singapore Hub</div>
                      <div className="text-slate-500">1.35° N, 103.81° E</div>
                    </div>
                    <div className="bg-slate-900/80 p-2 rounded border border-white/5">
                      <div className="text-pink-300 font-semibold">Sydney Station</div>
                      <div className="text-slate-500">33.86° S, 151.20° E</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* 5. Physics Comparison: Undersea Cables vs Space Laser Mesh */}
        {/* ------------------------------------------------------------------ */}
        <section id="physics" className="flex flex-col gap-8 pt-4">
          <div className="flex flex-col items-center text-center gap-3">
            <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 font-mono">
              THE FUNDAMENTAL ADVANTAGE
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-['Outfit']">
              Why Space Lasers Beat Undersea Fiber
            </h2>
            <p className="text-slate-400 text-sm max-w-2xl mx-auto">
              Terrestrial undersea cables are bound by glass refraction and undersea geography.
              Space laser mesh routing exploits fundamental vacuum physics to cut latency by nearly 50%.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Terrestrial Fiber Card */}
            <Card className="bg-gradient-to-b from-red-950/20 to-slate-950/80 border-red-500/20 backdrop-blur-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Badge variant="destructive" className="bg-red-500/20 text-red-300 border-red-500/30">
                    CONVENTIONAL TERRESTRIAL
                  </Badge>
                  <span className="font-mono text-xs text-red-400/80">Refractive Index n = 1.47</span>
                </div>
                <CardTitle className="text-xl font-bold text-white mt-2">Undersea Fiber Cables</CardTitle>
                <CardDescription className="text-slate-400">
                  Light trapped inside silica glass glass core
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 text-xs">
                <div className="flex items-center justify-between p-3 rounded-lg bg-red-950/30 border border-red-500/20 font-mono">
                  <span className="text-slate-400">Propagation Speed:</span>
                  <span className="text-red-300 font-bold">~204,000 km/s (Slowed by glass)</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-red-950/30 border border-red-500/20 font-mono">
                  <span className="text-slate-400">Routing Geometry:</span>
                  <span className="text-red-300 font-bold">Detours around continental shelves</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-red-950/30 border border-red-500/20 font-mono">
                  <span className="text-slate-400">Vulnerability:</span>
                  <span className="text-red-300 font-bold">Anchor drags, deep-sea seismic fault severing</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-red-950/30 border border-red-500/20 font-mono">
                  <span className="text-slate-400">NYC → Tokyo RTT:</span>
                  <span className="text-red-400 font-extrabold text-sm">~108 - 118 ms</span>
                </div>
              </CardContent>
            </Card>

            {/* Singularity Laser Mesh Card */}
            <Card className="bg-gradient-to-b from-cyan-950/20 to-slate-950/80 border-cyan-500/30 backdrop-blur-md relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Badge className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                    SINGULARITY LEO MESH
                  </Badge>
                  <span className="font-mono text-xs text-cyan-400">Refractive Index n = 1.000</span>
                </div>
                <CardTitle className="text-xl font-bold text-white mt-2">Space Optical Crosslinks (ISL)</CardTitle>
                <CardDescription className="text-slate-400">
                  Coherent laser beams in the pure vacuum of orbit
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 text-xs">
                <div className="flex items-center justify-between p-3 rounded-lg bg-cyan-950/30 border border-cyan-500/20 font-mono">
                  <span className="text-slate-400">Propagation Speed:</span>
                  <span className="text-cyan-300 font-bold">299,792 km/s (Speed of Light, c)</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-cyan-950/30 border border-cyan-500/20 font-mono">
                  <span className="text-slate-400">Routing Geometry:</span>
                  <span className="text-cyan-300 font-bold">Great Circle geodesic shortest-path arcs</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-cyan-950/30 border border-cyan-500/20 font-mono">
                  <span className="text-slate-400">Resilience:</span>
                  <span className="text-emerald-400 font-bold">Self-healing mesh rerouting in &lt;1 ms</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-cyan-950/30 border border-cyan-500/20 font-mono">
                  <span className="text-slate-400">NYC → Tokyo RTT:</span>
                  <span className="text-emerald-400 font-extrabold text-sm">~38.4 ms (47% Faster!)</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* 6. Bento Architecture Grid */}
        {/* ------------------------------------------------------------------ */}
        <section id="architecture" className="flex flex-col gap-8 pt-4">
          <div className="flex flex-col gap-2">
            <Badge variant="outline" className="w-fit border-cyan-500/30 text-cyan-400 font-mono">
              SYSTEM ARCHITECTURE
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-['Outfit']">
              Core Engineering Pillars
            </h2>
            <p className="text-slate-400 text-sm max-w-xl">
              Engineered with real-world aerospace paradigms, from orbital perturbation mathematics to physical radio hardware.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: SGP4 Propagator */}
            <Card className="bg-slate-950/60 border-cyan-500/15 backdrop-blur-md p-6 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4">
                  <Compass className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white font-['Outfit'] mb-2">SGP4 Orbital Propagator</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Computes precise satellite trajectories accounting for Earth oblateness (J2 perturbation), atmospheric drag, and solar radiation pressure at 60 updates per second.
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-cyan-400">
                <span>ASTRODYNAMICS</span>
                <span>J2 HARMONICS</span>
              </div>
            </Card>

            {/* Card 2: Optical Laser Crosslinks */}
            <Card className="bg-slate-950/60 border-cyan-500/15 backdrop-blur-md p-6 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4">
                  <Zap className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white font-['Outfit'] mb-2">Coherent Laser Crosslinks</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Four simultaneous optical transceivers per node create an intra-plane and inter-plane mesh grid. Features continuous line-of-sight raytracing and geometric Earth occlusion tests.
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-blue-400">
                <span>1550nm COHERENT</span>
                <span>10 Gbps ISL</span>
              </div>
            </Card>

            {/* Card 3: Store-Carry-Forward Buffer */}
            <Card className="bg-slate-950/60 border-cyan-500/15 backdrop-blur-md p-6 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4">
                  <Server className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white font-['Outfit'] mb-2">Store-Carry-Forward Routing</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  When crossing sparse oceanic expanses or when crosslinks drop, satellites buffer packets in radiation-hardened memory and carry them until the destination gateway rises above 10° elevation.
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-indigo-400">
                <span>DTN PROTOCOL</span>
                <span>RFC 5050 BUNDLE</span>
              </div>
            </Card>

            {/* Card 4: Chaos Engine */}
            <Card className="bg-slate-950/60 border-cyan-500/15 backdrop-blur-md p-6 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center text-yellow-400 mb-4">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white font-['Outfit'] mb-2">Solar Storm & Chaos Engine</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Simulate coronal mass ejections (CMEs) and localized anti-satellite kinetic events. Inject unexpected node failures and watch the mesh dynamically recompute alternate paths via Dijkstra.
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-yellow-400">
                <span>CHAOS MONKEY</span>
                <span>AUTO-FAILOVER</span>
              </div>
            </Card>

            {/* Card 5: Hardware-in-the-Loop Bridge */}
            <Card className="bg-slate-950/60 border-cyan-500/15 backdrop-blur-md p-6 flex flex-col justify-between md:col-span-2">
              <div>
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4">
                  <Cpu className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white font-['Outfit'] mb-2">Hardware-in-the-Loop LoRa Bridge</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Bridge the virtual digital twin with physical reality. Connect an ESP32 microcontroller with a SX1276/SX1262 LoRa transceiver over USB serial; simulated packet dispatches trigger real physical sub-GHz radio transmissions over the airwaves.
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-emerald-400">
                <span>PHYSICAL RADIO INTERFACE</span>
                <span>ESP32 • SX1276 • 868 / 915 MHz</span>
              </div>
            </Card>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* 7. Radial Orbital Timeline (Evolutionary Roadmap) */}
        {/* ------------------------------------------------------------------ */}
        <section id="timeline" className="flex flex-col gap-6 pt-4">
          <div className="flex flex-col items-center text-center gap-3">
            <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 font-mono">
              PROJECT ROADMAP
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-['Outfit']">
              Radial Orbital Development Timeline
            </h2>
            <p className="text-slate-400 text-sm max-w-xl mx-auto">
              Click any node in the orbital ring to inspect the system milestone, energy metrics, and interlinked aerospace capabilities.
            </p>
          </div>

          {/* Radial Timeline Container */}
          <div className="w-full h-[620px] rounded-2xl border border-cyan-500/20 bg-slate-950/80 backdrop-blur-xl overflow-hidden relative shadow-2xl">
            <RadialOrbitalTimeline timelineData={SINGULARITY_TIMELINE} />
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* 8. Bottom CTA Banner */}
        {/* ------------------------------------------------------------------ */}
        <section className="relative rounded-3xl p-8 sm:p-12 overflow-hidden border border-cyan-500/30 bg-gradient-to-r from-cyan-950/60 via-slate-950/90 to-blue-950/60 shadow-[0_0_80px_rgba(6,182,212,0.15)] flex flex-col items-center text-center gap-6">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />
          
          <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 px-3 py-1 font-mono text-xs">
            READY FOR DEPLOYMENT
          </Badge>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white font-['Outfit'] max-w-2xl leading-tight">
            Take Command of the Constellation Mesh
          </h2>

          <p className="text-slate-300 text-sm sm:text-base max-w-xl">
            Experience real-time packet hops, trigger solar chaos events, and inspect low-level telemetry in the full 3D Mission Control.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
            <Button
              onClick={onLaunchSimulator}
              size="lg"
              className="bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-bold px-10 py-6 rounded-xl shadow-xl shadow-cyan-500/30 hover:shadow-cyan-400/50 transition-all cursor-pointer text-sm"
            >
              <Rocket className="w-5 h-5 mr-2 fill-current" />
              Enter Mission Control Simulator
            </Button>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* 9. Footer */}
        {/* ------------------------------------------------------------------ */}
        <footer className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-500">
          <div className="flex items-center gap-2">
            <Satellite className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-300 font-semibold font-['Outfit']">SINGULARITY</span>
            <span>— LEO Satellite Mesh Simulator</span>
          </div>
          <div>
            Built with Three.js • FastAPI • Framer Motion • Tailwind CSS
          </div>
          <div className="text-cyan-400/80">
            AEROSPACE GRADE DIGITAL TWIN
          </div>
        </footer>
      </main>
    </div>
  );
};
