import os
import json
import math
import asyncio
import websockets
import urllib.request
from sgp4.api import Satrec, jday
from datetime import datetime, timezone
import time
import collections
import random
import sys
import argparse

# Hardware-in-the-Loop LoRa Bridge
try:
    from esp32_bridge import ESP32LoRaBridge
except ImportError:
    ESP32LoRaBridge = None

# ---------------------------------------------------------------------------
# Physical & Orbital Constants
# ---------------------------------------------------------------------------
EARTH_RADIUS_KM = 6371.0
EARTH_MU = 398600.4418
SATELLITE_ALTITUDE_KM = 550.0
MAX_ISL_DISTANCE_KM = 3800.0   # Max inter-satellite laser link range
MAX_GSL_DISTANCE_KM = 2800.0   # Max ground-to-satellite link range
HOP_DURATION_SEC = 1.0         # Visual animation flight time per hop
SPEED_OF_LIGHT_KM_MS = 299.792458 # Speed of light in vacuum (km / millisecond)

# Local 24-hour cache for CelesTrak Starlink TLE data
CACHE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'starlink_tle_cache.txt')
CACHE_EXPIRY_SECONDS = 86400  # 24 hours

# Optional global hardware bridge instance
GLOBAL_HW_BRIDGE = None


# ---------------------------------------------------------------------------
# CelesTrak Starlink TLE Loader with 24-hour caching
# ---------------------------------------------------------------------------
def get_starlink_tle_data():
    # 1. Check local cache
    if os.path.exists(CACHE_FILE):
        file_age = time.time() - os.path.getmtime(CACHE_FILE)
        if file_age < CACHE_EXPIRY_SECONDS and os.path.getsize(CACHE_FILE) > 1000:
            print(f"[CACHE] Loading Starlink TLE from local cache ({file_age / 3600:.1f} hours old)...")
            try:
                with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                    return f.read()
            except Exception as e:
                print(f"[CACHE] Error reading cache file: {e}")

    # 2. Fetch live from CelesTrak if cache is missing or older than 24 hours
    urls = [
        'https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle',
        'https://celestrak.org/NORAD/elements/gp.php?NAME=STARLINK&FORMAT=tle'
    ]
    for url in urls:
        print(f"[CELESTRAK] Fetching live Starlink TLE from {url}...")
        try:
            req = urllib.request.Request(
                url,
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Singularity/1.0'}
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                content = resp.read().decode('utf-8')
                if "Data is updated once every 2 hours" not in content and len(content) > 5000:
                    with open(CACHE_FILE, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print(f"[CACHE] Saved fresh Starlink TLE ({len(content)} bytes) to local cache.")
                    return content
                else:
                    print(f"[CELESTRAK] Response was rate-limit notice or short: {content[:80]}")
        except Exception as e:
            print(f"[CELESTRAK] Fetch failed for {url}: {e}")

    # 3. Fallback: If network failed or rate limited, but cache exists (even if >24h), use it
    if os.path.exists(CACHE_FILE) and os.path.getsize(CACHE_FILE) > 1000:
        print("[CACHE] Network fetch failed, falling back to existing cache file.")
        with open(CACHE_FILE, 'r', encoding='utf-8') as f:
            return f.read()

    raise RuntimeError("Unable to load Starlink TLE data from CelesTrak or cache.")


# ---------------------------------------------------------------------------
# Constellation generator — First 100 consecutive valid Starlink satellites
# ---------------------------------------------------------------------------
def load_starlink_constellation(target_count=100):
    content = get_starlink_tle_data()
    lines = [l.strip() for l in content.strip().splitlines() if l.strip()]

    now = datetime.now(timezone.utc)
    jd, fr = jday(now.year, now.month, now.day, now.hour, now.minute, now.second)

    satellites = []
    satellite_names = []

    for i in range(0, len(lines) - 2, 3):
        name = lines[i].strip()
        l1 = lines[i+1].strip()
        l2 = lines[i+2].strip()
        if l1.startswith('1 ') and l2.startswith('2 '):
            try:
                sat = Satrec.twoline2rv(l1, l2)
                err, r, v = sat.sgp4(jd, fr)
                if err == 0:
                    satellites.append(sat)
                    satellite_names.append(name)
                    if len(satellites) == target_count:
                        break
            except Exception:
                continue

    print(f"[CONSTELLATION] Loaded {len(satellites)} consecutive Starlink satellites ({satellite_names[0]} to {satellite_names[-1]}).")
    return satellites, satellite_names


# ---------------------------------------------------------------------------
# Astronomy helper: Greenwich Mean Sidereal Time (GMST) in radians
# ---------------------------------------------------------------------------
def get_gmst_rad(jd, fr):
    d = (jd + fr) - 2451545.0
    gmst_deg = (280.46061837 + 360.98564736629 * d) % 360.0
    return math.radians(gmst_deg)


# ---------------------------------------------------------------------------
# Propagate satellites → list of {x, y, z} in synchronized coordinate frame
# ---------------------------------------------------------------------------
def get_satellite_positions(satellites, jd, fr):
    positions = []
    for sat in satellites:
        error_code, r, v = sat.sgp4(jd, fr)
        if error_code == 0:
            positions.append({
                'x': r[0],
                'y': r[2],
                'z': -r[1]
            })
        else:
            positions.append({'x': 0.0, 'y': 0.0, 'z': 0.0})
    return positions


# ---------------------------------------------------------------------------
# Global Continental Ground Station Grid (6 strategic hubs)
# IDs are dynamically assigned: SAT_COUNT + offset (e.g. 100..105)
# ---------------------------------------------------------------------------
GROUND_STATIONS_CONFIG = [
    {'offset': 0, 'name': 'NYC',       'lat': 40.7128,  'lon': -74.0060,  'desc': 'North America Hub'},
    {'offset': 1, 'name': 'London',    'lat': 51.5074,  'lon': -0.1278,   'desc': 'Europe West Hub'},
    {'offset': 2, 'name': 'Tokyo',     'lat': 35.6762,  'lon': 139.6503,  'desc': 'Asia-Pacific Hub'},
    {'offset': 3, 'name': 'Sydney',    'lat': -33.8688, 'lon': 151.2093,  'desc': 'Oceania Hub'},
    {'offset': 4, 'name': 'Frankfurt', 'lat': 50.1109,  'lon': 8.6821,    'desc': 'Central Europe Hub'},
    {'offset': 5, 'name': 'Singapore', 'lat': 1.3521,   'lon': 103.8198,  'desc': 'Equatorial SEA Hub'}
]

def get_ground_station_positions(gmst_rad, sat_count):
    stations = []
    R = EARTH_RADIUS_KM
    for gs in GROUND_STATIONS_CONFIG:
        gs_id = sat_count + gs['offset']
        lat = math.radians(gs['lat'])
        lon = math.radians(gs['lon'])
        theta = gmst_rad + lon
        stations.append({
            'id': gs_id,
            'name': gs['name'],
            'desc': gs['desc'],
            'lat': gs['lat'],
            'lon': gs['lon'],
            'pos': {
                'x': R * math.cos(lat) * math.cos(theta),
                'y': R * math.sin(lat),
                'z': -R * math.cos(lat) * math.sin(theta)
            }
        })
    return stations


# ---------------------------------------------------------------------------
# Line-of-sight check — returns False if Earth blocks the line segment
# ---------------------------------------------------------------------------
def has_line_of_sight(p1, p2):
    dx = p2['x'] - p1['x']
    dy = p2['y'] - p1['y']
    dz = p2['z'] - p1['z']
    a = dx * dx + dy * dy + dz * dz
    if a < 1e-10:
        return True

    b = 2.0 * (p1['x'] * dx + p1['y'] * dy + p1['z'] * dz)
    c = p1['x']**2 + p1['y']**2 + p1['z']**2 - (EARTH_RADIUS_KM - 50.0)**2

    disc = b * b - 4.0 * a * c
    if disc < 0:
        return True

    sqrt_disc = math.sqrt(disc)
    t1 = (-b - sqrt_disc) / (2.0 * a)
    t2 = (-b + sqrt_disc) / (2.0 * a)
    if (0.0 < t1 < 1.0) or (0.0 < t2 < 1.0):
        return False
    return True


def dist_xyz(p1, p2):
    return math.sqrt(
        (p1['x'] - p2['x'])**2 +
        (p1['y'] - p2['y'])**2 +
        (p1['z'] - p2['z'])**2
    )


# ---------------------------------------------------------------------------
# Routing: Shortest-path search (BFS) over active dynamic link adjacency graph
# ---------------------------------------------------------------------------
def find_shortest_path(adj, start_id, target_id, all_nodes):
    if start_id == target_id:
        return [start_id]

    queue = collections.deque([[start_id]])
    visited = {start_id}

    while queue:
        path = queue.popleft()
        node = path[-1]

        neighbors = sorted(adj[node], key=lambda nb: dist_xyz(all_nodes[nb], all_nodes[target_id]))

        for nb in neighbors:
            if nb == target_id:
                return path + [nb]
            if nb not in visited:
                visited.add(nb)
                queue.append(path + [nb])

    return None


# ---------------------------------------------------------------------------
# WebSocket Client Connection Handler
# ---------------------------------------------------------------------------
async def handle_client(websocket):
    print("New client connected")
    satellites, satellite_names = load_starlink_constellation(100)
    sat_count = len(satellites)

    # Dynamic map of Gateway Name -> Gateway ID and ID -> Display Name
    name_to_gs = {gs['name']: sat_count + gs['offset'] for gs in GROUND_STATIONS_CONFIG}
    gs_to_name = {sat_count + gs['offset']: gs['name'] for gs in GROUND_STATIONS_CONFIG}

    all_node_names = {i: satellite_names[i] for i in range(sat_count)}
    for gs in GROUND_STATIONS_CONFIG:
        all_node_names[sat_count + gs['offset']] = f"{gs['name']} Gateway"

    node_active = [True] * sat_count
    packets = []
    delivered_packets = []
    delivered_ids = set()
    next_packet_id = 1

    # Real-Time QoS Analytics Tracking
    total_dispatched = 0
    total_delivered = 0
    packet_loss_count = 0
    recent_latencies = collections.deque(maxlen=25)
    throughput_samples = collections.deque(maxlen=60) # (timestamp, bits)

    hw_bridge = GLOBAL_HW_BRIDGE

    while True:
        # 1. Handle incoming dispatch and chaos commands
        try:
            message = await asyncio.wait_for(websocket.recv(), timeout=0.01)
            data = json.loads(message)
            msg_type = data.get('type')

            if msg_type == 'dispatch_packet':
                src_name = data.get('source', 'NYC')
                dst_name = data.get('destination', 'London')
                
                src_id = name_to_gs.get(src_name, sat_count)
                dst_id = name_to_gs.get(dst_name, sat_count + 1)
                
                new_pkt = {
                    'id': next_packet_id,
                    'source': src_id,
                    'destination': dst_id,
                    'source_name': src_name,
                    'dest_name': dst_name,
                    'from': src_id,
                    'to': src_id,
                    'progress': 0.0,
                    'startTime': time.time(),
                    'duration': HOP_DURATION_SEC,
                    'status': 'queued',
                    'hops': 0,
                    'path': [src_id],
                    'latency_ms': 0.0,
                    'propagation_delay_ms': 0.0,
                    'queue_delay_ms': 0.0,
                    'distance_km': 0.0
                }
                next_packet_id += 1
                total_dispatched += 1
                packets.append(new_pkt)
                print(f"[DISPATCH] Packet #{new_pkt['id']}: {src_name} ({src_id}) -> {dst_name} ({dst_id})")

                if hw_bridge:
                    hw_bridge.broadcast_packet_event('DISPATCH', new_pkt, all_node_names)

            elif msg_type == 'kill_node':
                target_id = data.get('target_id')
                if target_id is not None and isinstance(target_id, int) and 0 <= target_id < sat_count:
                    node_active[target_id] = False
                    dropped = 0
                    surviving = []
                    for p in packets:
                        if p['from'] == target_id or p['to'] == target_id:
                            dropped += 1
                            packet_loss_count += 1
                            if hw_bridge:
                                hw_bridge.broadcast_packet_event('DROPPED', p, all_node_names)
                            print(f"[CHAOS] Packet #{p['id']} DROPPED at killed {satellite_names[target_id]} (ID {target_id})!")
                        else:
                            surviving.append(p)
                    packets = surviving
                    print(f"[KILL NODE] {satellite_names[target_id]} (ID {target_id}) killed! Dropped {dropped} packet(s).")

            elif msg_type == 'chaos_event':
                active_sats = [i for i in range(sat_count) if node_active[i]]
                if active_sats:
                    count_to_kill = max(1, int(len(active_sats) * 0.20))
                    victims = random.sample(active_sats, count_to_kill)
                    victim_set = set(victims)
                    for v in victims:
                        node_active[v] = False
                    dropped = 0
                    surviving = []
                    for p in packets:
                        if p['from'] in victim_set or p['to'] in victim_set:
                            dropped += 1
                            packet_loss_count += 1
                            if hw_bridge:
                                hw_bridge.broadcast_packet_event('DROPPED', p, all_node_names)
                            print(f"[CHAOS] Packet #{p['id']} DROPPED due to EMP blast destroying node!")
                        else:
                            surviving.append(p)
                    packets = surviving
                    print(f"[EMP EVENT] 20% EMP blast! Destroyed {len(victims)} satellites. Dropped {dropped} packet(s).")

            elif msg_type == 'reset':
                node_active = [True] * sat_count
                packets.clear()
                delivered_packets.clear()
                delivered_ids.clear()
                total_delivered = 0
                total_dispatched = 0
                packet_loss_count = 0
                recent_latencies.clear()
                throughput_samples.clear()
                next_packet_id = 1
                print(f"[RESET] Constellation restored (all {sat_count} sats online), 6 gateways ready, QoS counters reset.")

        except asyncio.TimeoutError:
            pass
        except websockets.exceptions.ConnectionClosed:
            print("Client disconnected")
            break
        except Exception as e:
            print(f"Error reading message: {e}")
            break

        # Check for hardware-injected packets from ESP32 LoRa transceiver
        if hw_bridge:
            for hw_pkt in hw_bridge.get_injected_dispatches():
                src_name = hw_pkt.get('source', 'Tokyo')
                dst_name = hw_pkt.get('destination', 'Sydney')
                src_id = name_to_gs.get(src_name, sat_count)
                dst_id = name_to_gs.get(dst_name, sat_count + 1)
                new_pkt = {
                    'id': next_packet_id,
                    'source': src_id,
                    'destination': dst_id,
                    'source_name': src_name,
                    'dest_name': dst_name,
                    'from': src_id,
                    'to': src_id,
                    'progress': 0.0,
                    'startTime': time.time(),
                    'duration': HOP_DURATION_SEC,
                    'status': 'queued',
                    'hops': 0,
                    'path': [src_id],
                    'latency_ms': 0.0,
                    'propagation_delay_ms': 0.0,
                    'queue_delay_ms': 0.0,
                    'distance_km': 0.0
                }
                next_packet_id += 1
                total_dispatched += 1
                packets.append(new_pkt)
                print(f"[HW-BRIDGE:INJECT] Injected packet #{new_pkt['id']} ({src_name} -> {dst_name}) from LoRa radio mesh")

        # 2. Time & Astronomy
        now = datetime.now(timezone.utc)
        jd, fr = jday(now.year, now.month, now.day,
                       now.hour, now.minute,
                       now.second + now.microsecond / 1e6)
        gmst = get_gmst_rad(jd, fr)

        # 3. Propagate Satellites and 6 Continental Ground Stations
        sat_positions = get_satellite_positions(satellites, jd, fr)
        gs_data = get_ground_station_positions(gmst, sat_count)
        gs_positions = [gs['pos'] for gs in gs_data]

        all_nodes = sat_positions + gs_positions
        n_nodes = len(all_nodes)

        # 4. Compute Dynamic Active Links
        active_links = []
        adj = collections.defaultdict(list)

        for i in range(n_nodes):
            is_i_gs = (i >= sat_count)
            if not is_i_gs and not node_active[i]:
                continue

            for j in range(i + 1, n_nodes):
                is_j_gs = (j >= sat_count)
                if not is_j_gs and not node_active[j]:
                    continue

                # No direct terrestrial links between ground terminals
                if is_i_gs and is_j_gs:
                    continue

                max_range = MAX_GSL_DISTANCE_KM if (is_i_gs or is_j_gs) else MAX_ISL_DISTANCE_KM
                d = dist_xyz(all_nodes[i], all_nodes[j])

                if d <= max_range and has_line_of_sight(all_nodes[i], all_nodes[j]):
                    active_links.append([i, j])
                    adj[i].append(j)
                    adj[j].append(i)

        # 5. Route Packets across the Mesh & Calculate Physics-Based QoS Delay
        current_time = time.time()
        active_packets = []

        for p in packets:
            # Check if current holding node became offline
            if p['from'] < sat_count and not node_active[p['from']]:
                packet_loss_count += 1
                if hw_bridge:
                    hw_bridge.broadcast_packet_event('DROPPED', p, all_node_names)
                print(f"[ROUTING] Packet #{p['id']} dropped at offline holding node {satellite_names[p['from']]}")
                continue

            # Advance progress if currently in flight
            if p['from'] != p['to']:
                if p['to'] < sat_count and not node_active[p['to']]:
                    packet_loss_count += 1
                    if hw_bridge:
                        hw_bridge.broadcast_packet_event('DROPPED', p, all_node_names)
                    print(f"[ROUTING] Packet #{p['id']} dropped in flight to killed node {satellite_names[p['to']]}")
                    continue
                elapsed = current_time - p['startTime']
                p['progress'] = min(elapsed / p['duration'], 1.0)
            else:
                p['progress'] = 1.0

            # Arrived at current hop target node
            if p['progress'] >= 1.0:
                prev_node = p['from']
                p['from'] = p['to']

                # If this was a real hop traversal, compute speed-of-light delay & distance
                if prev_node != p['to']:
                    hop_dist = dist_xyz(all_nodes[prev_node], all_nodes[p['to']])
                    prop_delay = hop_dist / SPEED_OF_LIGHT_KM_MS
                    node_queue_depth = sum(1 for o in packets if o['from'] == p['to'] and o['id'] != p['id'])
                    queue_delay = 2.0 + (node_queue_depth * 1.5)

                    p['distance_km'] += hop_dist
                    p['propagation_delay_ms'] += prop_delay
                    p['queue_delay_ms'] += queue_delay
                    p['latency_ms'] += (prop_delay + queue_delay)

                    if hw_bridge:
                        hw_bridge.broadcast_packet_event('HOP', p, all_node_names)

                # Check if arrived at final destination ground station
                if p['from'] == p['destination']:
                    p['status'] = 'delivered'
                    p['progress'] = 1.0
                    if p['id'] not in delivered_ids:
                        delivered_ids.add(p['id'])
                        total_delivered += 1
                        recent_latencies.append(p['latency_ms'])
                        # Standard 1 MB packet payload = 8 Mbits for throughput tracking
                        throughput_samples.append((time.time(), 8.0))

                        delivery_info = {
                            'id': p['id'],
                            'source': p['source_name'],
                            'destination': p['dest_name'],
                            'hops': p['hops'],
                            'latency_ms': round(p['latency_ms'], 2),
                            'distance_km': round(p['distance_km'], 1),
                            'propagation_delay_ms': round(p['propagation_delay_ms'], 2),
                            'queue_delay_ms': round(p['queue_delay_ms'], 2),
                            'delivered_at': time.strftime("%H:%M:%S")
                        }
                        delivered_packets.append(delivery_info)
                        if len(delivered_packets) > 10:
                            delivered_packets.pop(0)

                        if hw_bridge:
                            hw_bridge.broadcast_packet_event('DELIVERED', p, all_node_names)

                        print(f"[DELIVERED] Packet #{p['id']} reached {p['dest_name']} in {p['hops']} hops! "
                              f"(Latency: {p['latency_ms']:.1f}ms, Distance: {p['distance_km']:.0f}km)")
                    continue

                # Calculate next hop toward destination over active mesh
                curr_node = p['from']
                route = find_shortest_path(adj, curr_node, p['destination'], all_nodes)

                if route and len(route) >= 2:
                    next_node = route[1]
                    p['to'] = next_node
                    p['progress'] = 0.0
                    p['startTime'] = current_time
                    p['status'] = 'in_transit'
                    p['hops'] += 1
                    p['path'] = route
                else:
                    # Store-Carry-Forward: greedy heuristic towards destination if closer neighbor exists
                    dest_pos = all_nodes[p['destination']]
                    curr_dist = dist_xyz(all_nodes[curr_node], dest_pos)
                    best_nb = None
                    best_dist = curr_dist

                    for nb in adj[curr_node]:
                        if nb < sat_count and not node_active[nb]:
                            continue
                        d = dist_xyz(all_nodes[nb], dest_pos)
                        if d < best_dist:
                            best_dist = d
                            best_nb = nb

                    if best_nb is not None:
                        p['to'] = best_nb
                        p['progress'] = 0.0
                        p['startTime'] = current_time
                        p['status'] = 'in_transit'
                        p['hops'] += 1
                    else:
                        # Hold in satellite buffer until constellation movement connects link
                        p['to'] = curr_node
                        p['status'] = 'stored'

            active_packets.append(p)

        packets = active_packets

        # 6. Aggregate Real-Time QoS Metrics
        now_ts = time.time()
        # Throughput over rolling 3-second window (Mbps)
        recent_mbits = sum(m for t, m in throughput_samples if now_ts - t <= 3.0)
        throughput_mbps = round(recent_mbits / 3.0, 2) if recent_mbits > 0 else 0.0

        avg_lat = sum(recent_latencies) / len(recent_latencies) if recent_latencies else 0.0
        min_lat = min(recent_latencies) if recent_latencies else 0.0
        max_lat = max(recent_latencies) if recent_latencies else 0.0

        loss_pct = (packet_loss_count / total_dispatched * 100.0) if total_dispatched > 0 else 0.0

        # Identify bottleneck node with deepest queue
        node_queue_counts = collections.Counter(p['from'] for p in packets if p['from'] < sat_count)
        bottleneck_id = None
        bottleneck_depth = 0
        if node_queue_counts:
            bottleneck_id, bottleneck_depth = node_queue_counts.most_common(1)[0]
        bottleneck_name = satellite_names[bottleneck_id] if bottleneck_id is not None else "Normal"

        queue_sat_pct = min(100.0, round((len(packets) / max(1, sat_count * 2)) * 100.0, 1))

        qos_data = {
            'avg_latency_ms': round(avg_lat, 2),
            'min_latency_ms': round(min_lat, 2),
            'max_latency_ms': round(max_lat, 2),
            'total_dispatched': total_dispatched,
            'total_delivered': total_delivered,
            'packet_loss_count': packet_loss_count,
            'packet_loss_rate_pct': round(loss_pct, 2),
            'throughput_mbps': throughput_mbps,
            'queue_saturation_pct': queue_sat_pct,
            'bottleneck_node': {
                'id': bottleneck_id,
                'name': bottleneck_name,
                'queue_depth': bottleneck_depth
            },
            'latency_history': [round(l, 1) for l in recent_latencies]
        }

        # 7. Build Payload
        sat_data = [
            {
                'x': sat_positions[i]['x'],
                'y': sat_positions[i]['y'],
                'z': sat_positions[i]['z'],
                'id': i,
                'name': satellite_names[i],
                'is_active': node_active[i]
            }
            for i in range(sat_count)
        ]
        active_count = sum(1 for a in node_active if a)
        offline_nodes = [i for i, a in enumerate(node_active) if not a]

        payload = {
            'earth_rotation': gmst,
            'total_nodes_count': sat_count,
            'satellites': sat_data,
            'ground_stations': gs_data,
            'active_links': active_links,
            'packets': [
                {
                    'id': p['id'],
                    'source': p['source_name'],
                    'destination': p['dest_name'],
                    'from': p['from'],
                    'to': p['to'],
                    'progress': p['progress'],
                    'status': p['status'],
                    'hops': p['hops'],
                    'latency_ms': round(p['latency_ms'], 2),
                    'distance_km': round(p['distance_km'], 1),
                    'path': p.get('path', [])
                }
                for p in packets
            ],
            'delivered_packets': list(delivered_packets),
            'qos': qos_data,
            'stats': {
                'active_links_count': len(active_links),
                'active_packets_count': len(packets),
                'total_delivered': total_delivered,
                'delivered_history': list(delivered_packets),
                'delivered_packets': list(delivered_packets),
                'active_nodes_count': active_count,
                'total_nodes_count': sat_count,
                'offline_nodes': offline_nodes,
                'qos': qos_data
            }
        }

        try:
            await websocket.send(json.dumps(payload))
        except websockets.exceptions.ConnectionClosed:
            print("Client disconnected during send")
            break

        await asyncio.sleep(0.05)


# ---------------------------------------------------------------------------
# Server Startup & CLI Interface
# ---------------------------------------------------------------------------
async def main():
    global GLOBAL_HW_BRIDGE

    parser = argparse.ArgumentParser(description="Singularity LEO Data Mesh & QoS Analytics Daemon")
    parser.add_argument('--hw-bridge', action='store_true', help="Enable ESP32 LoRa radio mesh hardware bridge")
    parser.add_argument('--serial-port', type=str, default='COM3', help="ESP32 serial port (default: COM3)")
    parser.add_argument('--baud', type=int, default=115200, help="Serial baud rate (default: 115200)")
    parser.add_argument('--port', type=int, default=8765, help="WebSocket port (default: 8765)")
    args, unknown = parser.parse_known_args()

    if args.hw_bridge and ESP32LoRaBridge:
        GLOBAL_HW_BRIDGE = ESP32LoRaBridge(port=args.serial_port, baudrate=args.baud, mock_mode=False)
        print(f"[STARTUP] ESP32 LoRa Hardware Bridge initialized on {args.serial_port}.")

    async with websockets.serve(handle_client, "localhost", args.port):
        print(f"LEO Data Mesh WebSocket server listening on ws://localhost:{args.port}")
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())