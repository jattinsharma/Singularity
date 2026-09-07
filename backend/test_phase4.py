import asyncio
import json
import websockets
import sys

async def test_phase4():
    uri = "ws://localhost:8765"
    print(f"Connecting to {uri}...")
    
    async with websockets.connect(uri) as ws:
        # 1. Receive initial broadcast
        msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
        data = json.loads(msg)
        
        satellites = data.get("satellites", [])
        gs = data.get("ground_stations", [])
        links = data.get("active_links", [])
        stats = data.get("stats", {})
        total_count = data.get("total_nodes_count", len(satellites))
        
        print("\n--- 1. INITIAL PAYLOAD VERIFICATION ---")
        print(f"Total Nodes Count: {total_count}")
        print(f"Satellites Count: {len(satellites)}")
        print(f"Ground Stations Count: {len(gs)}")
        print(f"Active Links: {len(links)}")
        print(f"Active Nodes in Stats: {stats.get('active_nodes_count')}")
        
        assert len(satellites) == 100, f"Expected 100 satellites, got {len(satellites)}"
        assert total_count == 100, f"Expected total_nodes_count == 100, got {total_count}"
        assert len(gs) == 2, f"Expected 2 ground stations, got {len(gs)}"
        assert gs[0]["id"] == 100, f"Expected NYC ID 100, got {gs[0]['id']}"
        assert gs[1]["id"] == 101, f"Expected London ID 101, got {gs[1]['id']}"
        
        # Check first and last satellite names
        first_sat = satellites[0]
        last_sat = satellites[-1]
        print(f"First Sat: ID={first_sat.get('id')} Name={first_sat.get('name')}")
        print(f"Last Sat: ID={last_sat.get('id')} Name={last_sat.get('name')}")
        assert "STARLINK" in first_sat.get("name", ""), f"Satellite name does not contain STARLINK: {first_sat.get('name')}"
        assert "STARLINK" in last_sat.get("name", ""), f"Satellite name does not contain STARLINK: {last_sat.get('name')}"
        
        # Check GSL connections
        gsl_links = [link for link in links if link[0] >= 100 or link[1] >= 100]
        isl_links = [link for link in links if link[0] < 100 and link[1] < 100]
        print(f"ISL Links: {len(isl_links)}, GSL Links: {len(gsl_links)}")
        assert len(isl_links) >= 100, f"Expected at least 100 ISL links, got {len(isl_links)}"
        assert len(gsl_links) >= 1, f"Expected at least 1 GSL link, got {len(gsl_links)}"
        
        # 2. Test KILL NODE
        print("\n--- 2. KILL NODE VERIFICATION ---")
        target_id = 12
        print(f"Sending kill_node for target_id={target_id} ({satellites[target_id].get('name')})...")
        await ws.send(json.dumps({"type": "kill_node", "target_id": target_id}))
        
        # Receive next tick
        msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
        data = json.loads(msg)
        killed_sat = data["satellites"][target_id]
        print(f"Target Sat status: is_active={killed_sat.get('is_active')}")
        print(f"Active Nodes Count: {data['stats'].get('active_nodes_count')}")
        assert killed_sat.get("is_active") is False, "Satellite was not set to is_active=False"
        assert data["stats"].get("active_nodes_count") == 99, f"Expected 99 active nodes, got {data['stats'].get('active_nodes_count')}"
        
        # 3. Test EMP / CHAOS EVENT
        print("\n--- 3. EMP / CHAOS EVENT VERIFICATION ---")
        print("Sending chaos_event (20% of satellites destruction)...")
        await ws.send(json.dumps({"type": "chaos_event"}))
        
        msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
        data = json.loads(msg)
        active_nodes = data["stats"].get("active_nodes_count")
        print(f"Active Nodes Count after EMP: {active_nodes} / 100")
        assert active_nodes <= 81, f"Expected <= 81 active nodes after 20% EMP, got {active_nodes}"
        
        # 4. Test RESET SIMULATION
        print("\n--- 4. RESET SIMULATION VERIFICATION ---")
        print("Sending reset...")
        await ws.send(json.dumps({"type": "reset"}))
        
        msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
        data = json.loads(msg)
        active_nodes_after_reset = data["stats"].get("active_nodes_count")
        print(f"Active Nodes Count after reset: {active_nodes_after_reset} / 100")
        assert active_nodes_after_reset == 100, f"Expected 100 active nodes after reset, got {active_nodes_after_reset}"
        assert data["satellites"][target_id].get("is_active") is True, "Target satellite should be active after reset"
        
        # 5. Test DISPATCH PACKET
        print("\n--- 5. PACKET DISPATCH VERIFICATION ---")
        print("Sending dispatch_packet: NYC -> London...")
        await ws.send(json.dumps({"type": "dispatch_packet", "source": "NYC", "destination": "London"}))
        
        # Monitor for 5 ticks to verify packet routing
        packet_seen = False
        for tick in range(5):
            msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
            data = json.loads(msg)
            packets = data.get("packets", [])
            delivered = data.get("delivered_packets", [])
            print(f"Tick {tick+1}: Active packets={len(packets)}, Delivered={len(delivered)}")
            if len(packets) > 0 or len(delivered) > 0:
                packet_seen = True
                if len(packets) > 0:
                    p = packets[0]
                    from_name = data["satellites"][p["from"]]["name"] if p["from"] < 100 else "GS"
                    to_name = data["satellites"][p["to"]]["name"] if p["to"] < 100 else "GS"
                    print(f"   Packet #{p['id']}: {p['source']} -> {p['destination']} | {from_name} ({p['from']}) -> {to_name} ({p['to']}) | progress={p['progress']:.2f} | hops={p['hops']}")
                break
        
        assert packet_seen, "No packet found in transit or delivered after dispatch"
        
        print("\n==========================================")
        print(">>> ALL PHASE 4 BACKEND TESTS PASSED! <<<")
        print("==========================================")

if __name__ == "__main__":
    asyncio.run(test_phase4())
