import Start from '../public/audio/car-start.mp3'
import Engine from '../public/audio/car-engine.mp3'
import Hole from '../public/audio/car-hole.mp3'
import Crash from '../public/audio/car-crash.mp3'
import Horn from '../public/audio/car-horn.mp3'
import HornLee from '../public/audio/car-lee-horn.mp3'
import Break from '../public/audio/car-break.mp3'
import Bonus from '../public/audio/car-bonus.mp3'
import GameOver from '../public/audio/game-over.mp3'
import GameWin from '../public/audio/game-win.mp3'

export const audio = {
    start : new Audio(Start),
    engine : new Audio(Engine),
    hole: new Audio(Hole),
    crash : new Audio(Crash),
    horn : new Audio(Horn),
    hornLee : new Audio(HornLee),
    break : new Audio(Break),
    bonus : new Audio(Bonus),
    gameover : new Audio(GameOver),
    gamewin : new Audio(GameWin),
}