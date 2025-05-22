import { StrictMode } from 'react'
import React from 'react'
import ReactDOM from 'react-dom/client' 
import { BrowserRouter,Routes, Route } from 'react-router-dom'
//import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ProfileCreation from './pages/ProfileCreation'

const Notes = () => <div>Notes Page To Be Created</div>

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/profile" element={<ProfileCreation />} />
        <Route path="/notes" element={<Notes />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
