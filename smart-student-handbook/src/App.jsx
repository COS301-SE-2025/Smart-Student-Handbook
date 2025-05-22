import { useState } from 'react'
import {Link} from 'react-router-dom'
import './App.css'
import './index.css'

function App() {
  const [isLoggedIn] = useState(true);

  return (
<div className="flex items-center justify-center h-screen bg-gray-100">
      {isLoggedIn ? (
        <Link to="/profile" className="text-blue-600 underline">
          Go to Profile Creation
        </Link>
      ) : (
        <p>Please log in to create a profile.</p>
      )}
    </div>
  )
}

export default App
