import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'

// 玩家端頁面
import PlayerLayout from './pages/Player/PlayerLayout'
import GameLobby from './pages/Player/GameLobby'
import GamePlay from './pages/Player/GamePlay'
import MapView from './pages/Player/MapView'
import Leaderboard from './pages/Player/Leaderboard'

// 管理端頁面
import AdminLayout from './pages/Admin/AdminLayout'
import Dashboard from './pages/Admin/Dashboard'
import GameEditor from './pages/Admin/GameEditor'
import DeviceManagement from './pages/Admin/DeviceManagement'

// 認證頁面
import Login from './pages/Auth/Login'
import Register from './pages/Auth/Register'

function App() {
  const { user } = useAuthStore()

  return (
    <Routes>
      {/* 認證路由 */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* 玩家端路由 */}
      <Route path="/player" element={<PlayerLayout />}>
        <Route index element={<GameLobby />} />
        <Route path="game/:sessionId" element={<GamePlay />} />
        <Route path="map/:sessionId" element={<MapView />} />
        <Route path="leaderboard/:gameId" element={<Leaderboard />} />
      </Route>

      {/* 管理端路由 */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="editor/:gameId?" element={<GameEditor />} />
        <Route path="devices" element={<DeviceManagement />} />
      </Route>

      {/* 預設重定向 */}
      <Route path="/" element={<Navigate to="/player" replace />} />
      <Route path="*" element={<Navigate to="/player" replace />} />
    </Routes>
  )
}

export default App
