import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import App from "./App"
import Login from "./pages/Login"
import Dashboard from "./pages/Dashboard" // create this next
import "./index.css"
import { Toaster } from "sonner"

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <>
        <Toaster richColors position="top-right" />
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/demo" element={<App />} />
        </Routes>
      </>
    </BrowserRouter>
  </React.StrictMode>
)
