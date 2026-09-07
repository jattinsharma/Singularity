import asyncio
import json
import websockets
import time
import sys
from esp32_bridge import ESP32LoRaBridge, crc16_ccitt, MSG_TYPE_DISPATCH, MSG_TYPE_HOP

async def test_phase5():
    uri = "ws://localhost:8765"
    print(f"Connecting to Singularity daemon at {uri}...")

    # -----------------------------------------------------------------------
    # 1. ESP32 LoRa Bridge Standalone Unit Tests
    # -----------------------------------------------------------------------
    print("\n--- 1. ESP32 LoRa BRIDGE PROTOCOL & FRAMING TESTS ---")
    bridge = ESP32LoRaBridge(port="COM99", baudrate=115200, mock_mode=True)
    assert bridge.mock_mode is True, "Bridge should operate in mock mode when port is simulated"

    # Test Binary Frame packing & CRC16 calculation
    bin_frame = bridge.build_binary_frame(
        msg_type=MSG_TYPE_DISPATCH,
        pkt_id=42,
        src_id=102, # Tokyo
        dst_id=103, # Sydney
        next_hop=15, # Satellite 15
        hops=0,
        latency_ms=0.0,
        payload_str="Tokyo->Sydney"
    )
    print(f"Binary Frame generated: length={len(bin_frame)} bytes")
    assert len(bin_frame) >= 15, f"Binary frame too short: {len(bin_frame)}"
    assert bin_frame[0] == 0x7E and bin_frame[1] == 0x53, "Invalid preamble"

    # Verify CRC16 matches
    payload_data = bin_frame[2:-2]
    frame_crc = (bin_frame[-2] << 8) | bin_frame[-1]
    computed_crc = crc16_ccitt(payload_data)
    print(f"Frame CRC16: 0x{frame_crc:04X} | Computed CRC16: 0x{computed_crc:04X}")
    assert frame_crc == computed_crc, "CRC16 checksum mismatch"

    # Test JSON Stream formatting
    json_line = bridge.build_json_frame("HOP", 42, "Tokyo", "Sydney", "STARLINK-1008", "STARLINK-1067", 2, 38.45, 8420.5)
    parsed = json.loads(json_line)
    print(f"JSON Frame verified: {parsed}")
    assert parsed["packet_id"] == 42
    assert parsed["latency_ms"] == 38.45
    assert parsed["distance_km"] == 8420.5
    print(">>> ESP32 Bridge Protocol tests PASSED! <<<")

    # -----------------------------------------------------------------------
    # 2. WebSocket & 6 Global Gateway Verification
    # -----------------------------------------------------------------------
    print("\n--- 2. GLOBAL 6-GATEWAY GRID VERIFICATION ---")
    async with websockets.connect(uri) as ws:
        msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
        data = json.loads(msg)

        satellites = data.get("satellites", [])
        gs = data.get("ground_stations", [])
        links = data.get("active_links", [])
        sat_count = data.get("total_nodes_count", len(satellites))

        print(f"Satellites Count: {len(satellites)}")
        print(f"Ground Stations Count: {len(gs)}")
        print(f"Total Links: {len(links)}")

        assert len(satellites) == 100, f"Expected 100 satellites, got {len(satellites)}"
        assert len(gs) == 6, f"Expected 6 continental ground stations, got {len(gs)}"

        expected_hubs = [
            ("NYC", 100, 40.7128),
            ("London", 101, 51.5074),
            ("Tokyo", 102, 35.6762),
            ("Sydney", 103, -33.8688),
            ("Frankfurt", 104, 50.1109),
            ("Singapore", 105, 1.3521),
        ]

        for name, expected_id, expected_lat in expected_hubs:
            hub = next((g for g in gs if g["name"] == name), None)
            assert hub is not None, f"Gateway {name} missing from ground_stations"
            assert hub["id"] == expected_id, f"Gateway {name} ID mismatch: expected {expected_id}, got {hub['id']}"
            assert abs(hub["lat"] - expected_lat) < 0.01, f"Gateway {name} latitude mismatch"
            print(f"  [OK] {hub['name']} Gateway: ID={hub['id']}, Pos=({hub['lat']} deg, {hub['lon']} deg)")

        # Verify active GSL links to ground stations
        gsl_links = [l for l in links if l[0] >= 100 or l[1] >= 100]
        print(f"Active GSL Links count: {len(gsl_links)}")
        assert len(gsl_links) >= 6, f"Expected at least 6 GSL links across the globe, got {len(gsl_links)}"

        # -------------------------------------------------------------------
        # 3. Real-Time QoS Analytics Engine Verification
        # -------------------------------------------------------------------
        print("\n--- 3. REAL-TIME QoS ENGINE PAYLOAD VERIFICATION ---")
        qos = data.get("qos")
        print(f"QoS payload keys: {list(qos.keys()) if qos else 'NONE'}")
        assert qos is not None, "Missing 'qos' dictionary in WebSocket payload"
        for key in ["avg_latency_ms", "packet_loss_rate_pct", "throughput_mbps", "queue_saturation_pct", "bottleneck_node"]:
            assert key in qos, f"Missing key '{key}' in qos payload"
        print(f"  [OK] Initial QoS: Avg Latency={qos['avg_latency_ms']}ms, Loss={qos['packet_loss_rate_pct']}%, Saturation={qos['queue_saturation_pct']}%")

        # -------------------------------------------------------------------
        # 4. Cross-Continental Trans-Pacific Routing & Physical Latency
        # -------------------------------------------------------------------
        print("\n--- 4. TRANS-PACIFIC ROUTING (Tokyo -> Sydney) ---")
        print("Dispatching packet: Tokyo (102) -> Sydney (103)...")
        await ws.send(json.dumps({"type": "dispatch_packet", "source": "Tokyo", "destination": "Sydney"}))

        # Observe routing progress and physics-based delay
        packet_tracked = False
        hop_completed = False
        for tick in range(35):
            msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
            data = json.loads(msg)
            pkts = data.get("packets", [])
            dels = data.get("delivered_packets", [])

            if pkts:
                p = pkts[0]
                packet_tracked = True
                if p.get('latency_ms', 0) > 0 or p.get('distance_km', 0) > 0:
                    hop_completed = True
                    print(f"  [OK] Hop completed: Pkt #{p['id']} [{p['source']}->{p['destination']}] "
                          f"at node={p['from']}, Latency={p.get('latency_ms'):.1f}ms, Dist={p.get('distance_km'):.0f}km")
                    break

            if dels:
                d = dels[-1]
                print(f"  [OK] DELIVERED! Pkt #{d['id']}: {d['source']} -> {d['destination']} "
                      f"in {d['hops']} hops, Latency={d.get('latency_ms')}ms, Distance={d.get('distance_km')}km")
                assert d.get('latency_ms', 0) > 0, "Delivered packet must have non-zero physics latency"
                assert d.get('distance_km', 0) > 0, "Delivered packet must have non-zero distance"
                hop_completed = True
                break

        assert packet_tracked, "No active packet tracked during Tokyo -> Sydney dispatch"
        assert hop_completed, "Hop did not record physics latency/distance within allotted ticks"

        # -------------------------------------------------------------------
        # 5. Packet Loss Tracking Under Chaos / EMP Event
        # -------------------------------------------------------------------
        print("\n--- 5. PACKET LOSS TRACKING UNDER EMP CHAOS ---")
        await ws.send(json.dumps({"type": "dispatch_packet", "source": "Frankfurt", "destination": "Singapore"}))
        await asyncio.sleep(0.1)
        await ws.recv()

        await ws.send(json.dumps({"type": "dispatch_packet", "source": "NYC", "destination": "Tokyo"}))
        await asyncio.sleep(0.1)
        await ws.recv()

        print("Triggering 20% EMP Blast...")
        await ws.send(json.dumps({"type": "chaos_event"}))

        emp_seen = False
        qos = {}
        for _ in range(10):
            msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
            data = json.loads(msg)
            qos = data.get("qos", {})
            if data['stats'].get('active_nodes_count', 100) < 100:
                emp_seen = True
                print(f"  [OK] Post-EMP QoS: Dispatched={qos.get('total_dispatched')}, "
                      f"Dropped={qos.get('packet_loss_count')}, Loss Rate={qos.get('packet_loss_rate_pct')}%, "
                      f"Active Sats={data['stats'].get('active_nodes_count')}/100")
                break

        assert emp_seen, "EMP should have reduced active satellites"
        assert qos.get('total_dispatched', 0) >= 3, "Total dispatched count should be >= 3"

        # -------------------------------------------------------------------
        # 6. Reset Constellation
        # -------------------------------------------------------------------
        print("\n--- 6. RESET SIMULATION ---")
        await ws.send(json.dumps({"type": "reset"}))

        reset_seen = False
        for _ in range(10):
            msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
            data = json.loads(msg)
            if data['stats'].get('active_nodes_count') == 100:
                reset_seen = True
                assert data['qos']['packet_loss_count'] == 0, "Reset should clear packet loss counter"
                print("  [OK] Constellation restored (100/100 Sats), QoS reset cleanly.")
                break

        assert reset_seen, "Reset should restore all 100 satellites"

    print("\n==========================================")
    print(">>> ALL PHASE 5 INTEGRATION TESTS PASSED! <<<")
    print("==========================================")

if __name__ == "__main__":
    asyncio.run(test_phase5())
