// App.jsx

import { Routes, Route } from 'react-router-dom'
import Hub from './pages/hub.jsx'
import Login from './pages/login.jsx'
import Signup from './pages/signup.jsx'
import Write from './pages/write.jsx'
import Article from './pages/article.jsx'
import Profile from './pages/profile.jsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Hub />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/write" element={<Write />} />
      <Route path="/write/:id" element={<Write />} />
      <Route path="/article/:id" element={<Article />} />
      <Route path="/profile" element={<Profile />} />
    </Routes>
  )
}

export default App