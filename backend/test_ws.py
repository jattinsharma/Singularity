import asyncio
import websockets

async def test():
    try:
        async with websockets.connect('ws://localhost:8765') as ws:
            print("Connected to WebSocket server")
            for i in range(5):
                message = await ws.recv()
                print(f"Received message {i+1}: {message}")
    except Exception as e:
        print(f"Error: {e}")

asyncio.get_event_loop().run_until_complete(test())
