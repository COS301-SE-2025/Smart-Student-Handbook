'use client'

import { Loader2 } from "lucide-react"
import { motion } from "framer-motion"

export function FullScreenLoader() {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 dark:bg-black/70"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <Loader2 className="w-12 h-12 animate-spin text-primary" />
    </motion.div>
  )
}
