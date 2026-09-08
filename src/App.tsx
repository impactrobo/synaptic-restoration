import { useState } from 'react'
import AuthScreen from './components/AuthScreen'
import ReviewScreen from './components/ReviewScreen'
import TitleScreen from './components/TitleScreen'
import { useSession } from './hooks/useSession'

function Booting() {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-void">
      <div className="scanlines" />
      <div className="breathe text-[10px] tracking-[0.4em] text-violet">
        RESTORING LINK...
      </div>
    </div>
  )
}

export default function App() {
  const { session, loading, urlError } = useSession()
  const [reviewing, setReviewing] = useState(false)

  if (loading) return <Booting />
  if (!session) return <AuthScreen urlError={urlError} />
  if (reviewing) return <ReviewScreen onExit={() => setReviewing(false)} />

  return <TitleScreen onJackIn={() => setReviewing(true)} />
}
