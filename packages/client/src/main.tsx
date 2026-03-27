import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router'
import { LandingScreen } from './screens/LandingScreen'
import { LobbyScreen } from './screens/LobbyScreen'
import { GameScreen } from './screens/GameScreen'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingScreen />} />
        <Route path="/lobby/:roomCode" element={<LobbyScreen />} />
        <Route path="/game/:roomCode" element={<GameScreen />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
