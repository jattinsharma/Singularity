# Singularity - LEO Data Mesh Simulator

A web-based, visually interactive Low Earth Orbit (LEO) Data Mesh Simulator that acts as a "digital twin" sandbox for testing complex orbital network routing.

## Project Structure

- `/backend`: Python server that computes satellite orbital mechanics using sgp4 and broadcasts positions via WebSocket.
- `/frontend`: React/TypeScript application that visualizes the satellite positions in 3D using Three.js.

## Backend

The backend script (`orbital_server.py`) does the following:
- Generates 50 virtual satellites in a circular LEO orbit (approx. 400 km altitude, 51.6° inclination).
- Uses the sgp4 library to propagate their orbits and compute Earth-centered inertial (ECS) coordinates (X, Y, Z) in kilometers.
- Sets up a WebSocket server on `ws://localhost:8765` that broadcasts the positions of all satellites as a JSON array every second.

### Requirements
- Python 3.x
- sgp4 library
- websockets library

Install dependencies:
```bash
cd backend
pip install -r requirements.txt
```

### Run the Backend
```bash
cd backend
python orbital_server.py
```

## Frontend

The frontend is a React/TypeScript application that:
- Connects to the WebSocket backend at `ws://localhost:8765`.
- Receives satellite positions and renders them as glowing dots orbiting a 3D Earth.
- Uses Three.js for rendering.

### Dependencies
- React
- TypeScript
- Three.js
- @types/three

Install dependencies:
```bash
cd frontend
npm install
```

### Run the Frontend (Development)
```bash
cd frontend
npm run dev
```

The frontend will be available at `http://localhost:5173` (or another port if 5173 is in use).

## How It Works
1. Start the backend server: it begins broadcasting satellite positions every second.
2. Start the frontend development server: it opens a browser window and connects to the backend via WebSocket.
3. The frontend renders a 3D Earth and updates the positions of the satellites in real-time.

## Notes
- The backend uses a simplified orbital model: all satellites are in nearly circular LEO orbits with the same altitude and inclination but different RAAN, argument of perigee, and mean anomaly to distribute them in the orbital shell.
- The frontend scales the satellite positions from kilometers to the Three.js scene units based on Earth's radius.
- For a more realistic visualization, you could add textures to the Earth and improve the satellite representation.

## Future Enhancements
- Implement actual Store-Carry-Forward routing logic in the backend.
- Add UI controls to adjust simulation parameters (altitude, inclination, number of satellites, etc.).
- Improve the visual fidelity with textures, atmospheric scattering, and better satellite models.
- Implement packet visualization to show data routing between satellites.

