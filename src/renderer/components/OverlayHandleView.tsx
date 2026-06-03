import { useCallback, useState } from 'react'

interface OverlayHandleViewProps {
  channelName: string
}

export function OverlayHandleView({ channelName }: OverlayHandleViewProps) {
  const [isLocked, setIsLocked] = useState(false)

  const handleToggleLock = useCallback(() => {
    const nextLocked = !isLocked
    setIsLocked(nextLocked)
    void window.eveBabel.setOverlayPenetration(nextLocked)
  }, [isLocked])

  const handleClose = useCallback(() => {
    void window.eveBabel.closeOverlayWindow()
  }, [])

  return (
    <div className="overlay-handle">
      <div className="overlay-handle-drag-region">
        <span className="overlay-handle-channel-name">{channelName}</span>
      </div>
      <div className="overlay-handle-actions">
        <button
          aria-label={isLocked ? 'Unlock overlay' : 'Lock overlay (click-through)'}
          className={`overlay-handle-btn ${isLocked ? 'is-locked' : ''}`}
          onClick={handleToggleLock}
          title={isLocked ? 'Click to make overlay interactive' : 'Click to enable click-through'}
          type="button"
        >
          {isLocked ? '🔒' : '🔓'}
        </button>
        <button
          aria-label="Close overlay"
          className="overlay-handle-btn overlay-handle-close-btn"
          onClick={handleClose}
          title="Close overlay"
          type="button"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
