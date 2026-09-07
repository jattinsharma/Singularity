import asyncio
import json
import websockets

async def test_chaos_engine():
    uri = "ws://localhost:8765"
    async with websockets.connect(uri) as ws:
        # 1. Receive initial state
        raw = await ws.recv()
        data = json.loads(raw)
        sats = data['satellites']
        stats = data['stats']
        assert len(sats) == 50, f"Expected 50 sats, got {len(sats)}"
        assert stats['active_nodes_count'] == 50, f"Expected 50 active sats, got {stats['active_nodes_count']}"
        assert all(s.get('is_active') is True for s in sats), "All sats should initially be active"
        print("[PASS] Initial state: 50 active satellites, 100% online.")

        # 2. Test Kill Node (target SAT-7)
        await ws.send(json.dumps({'type': 'kill_node', 'target_id': 7}))
        await asyncio.sleep(0.15)
        raw = await ws.recv()
        data = json.loads(raw)
        sats = data['satellites']
        stats = data['stats']
        assert sats[7]['is_active'] is False, f"SAT-7 should be inactive! Got {sats[7]['is_active']}"
        assert stats['active_nodes_count'] == 49, f"Active count should be 49! Got {stats['active_nodes_count']}"
        assert 7 in stats['offline_nodes'], "SAT-7 should be listed in offline_nodes"
        links_with_7 = [l for l in data['active_links'] if l[0] == 7 or l[1] == 7]
        assert len(links_with_7) == 0, f"SAT-7 should have 0 active links! Found {len(links_with_7)}"
        print("[PASS] Kill Node SAT-7: is_active=False, 49 online, 0 active links to node 7.")

        # 3. Test Chaos Event (20% EMP blast)
        await ws.send(json.dumps({'type': 'chaos_event'}))
        for _ in range(10):
            raw = await ws.recv()
            data = json.loads(raw)
            stats = data['stats']
            active_count = stats['active_nodes_count']
            if active_count < 49:
                break
        offline_count = len(stats['offline_nodes'])
        assert active_count < 49, f"Active count should have dropped after EMP! Got {active_count}"
        assert active_count + offline_count == 50, "Total sats must equal 50"
        print(f"[PASS] EMP / Chaos Event: destroyed ~20% of satellites ({offline_count} offline, {active_count} remaining online).")

        # 4. Test Reset Simulation
        await ws.send(json.dumps({'type': 'reset'}))
        for _ in range(10):
            raw = await ws.recv()
            data = json.loads(raw)
            stats = data['stats']
            if stats['active_nodes_count'] == 50:
                break
        sats = data['satellites']
        assert stats['active_nodes_count'] == 50, f"Active count should be 50 after reset! Got {stats['active_nodes_count']}"
        assert len(stats['offline_nodes']) == 0, f"Offline nodes should be empty! Got {stats['offline_nodes']}"
        assert all(s.get('is_active') is True for s in sats), "All sats should be active after reset"
        print("[PASS] Reset Simulation: all 50 satellites restored to active status.")

        # 5. Dispatch packet test
        await ws.send(json.dumps({'type': 'dispatch_packet', 'source': 'NYC', 'destination': 'London'}))
        await asyncio.sleep(0.2)
        raw = await ws.recv()
        data = json.loads(raw)
        assert len(data['packets']) >= 1, "Packet should be in active queue"
        print(f"[PASS] Packet dispatch: successfully created packet #{data['packets'][0]['id']}")

        print("\nALL PHASE 3 BACKEND TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(test_chaos_engine())
