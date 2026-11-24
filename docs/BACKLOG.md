# Backlog

Ideas and fixes not started yet. When one is built, record the call in `DECISIONS.md` and
remove it here.

## Phone steering: swipe to steer, not drag to a point (Jay, 2026-11-24)

On a phone the saucer follows the finger, so it can only go as far as the thumb reaches: Jay
gets most of the way across the screen and then it stops, because it has caught up with the
thumb. Jay wants to **steer**: drag or swipe left and the saucer keeps moving left until the
finger lifts (or swipes back the other way), like a joystick.

- **Likely approach:** treat the drag as a direction and speed (the offset from where the
  finger first touched, or the recent swipe direction), not a target position. The saucer keeps
  going while the finger is held off-center; it stops when the finger lifts or returns near its
  starting point. A small dead zone stops jitter.
- **Keep:** the beam control on phones, and the current mouse and keyboard behavior on desktop.
- **Check:** feels right at both phone sizes, upright and sideways; e2e for "hold a drag to the
  left, saucer reaches the left edge."
