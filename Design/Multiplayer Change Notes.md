# Multiplayer Change Notes

## PVP Duel Setup

- Added Multiplayer -> PVP -> Host/Join flow with room-code based sessions.
- Host can configure duel level and pendant rule before hero selection.
- Pendant rules support Disabled, Tier 1, and Tier 2:
  - Tier 1 allows one Tier 1 pendant.
  - Tier 2 allows one Tier 1 pendant and one Tier 2 pendant.
- PVP build screen now shows Skills, Stats, Talents, Pendants, and Start Duel together.
- Build screen supports keyboard and mouse:
  - Click skills/stats to add points; shift-click removes.
  - Click talents to cycle choices; shift-click clears.
  - Click pendants to toggle allowed selections.
  - Hover tooltips describe skills, stats, talents, pendants, and Start Duel.
- Plasticity in PVP now exposes a primary-stat selector.

## PVP Start Flow

- Players no longer spawn into the arena immediately after finishing their build.
- Each player sends a ready signal after locking their build.
- The duel starts only after both players are ready.
- A countdown plays before entering the stage 8 duel arena.
- Stage 8 art is used as the arena background and monsters are not spawned in PVP.

## Multiplayer Sync Fixes

- Rooms are joinable once the PVP host reaches the hero build screen.
- Joiners no longer create default rooms by accident.
- Server stores host PVP rules and sends them to joiners.
- Fixed the bug where a joiner could enter with default level 5 when the host selected another level.
- Improved room isolation so clients only receive events from their room.
- Improved host disconnect handling by migrating host ownership where possible.

## Combat Sync Fixes

- Host-authoritative enemy logic can target host or clients in co-op.
- Enemy projectile and hazard damage can be forwarded to remote clients.
- Network positions use normalized coordinates to reduce mismatch between different browser sizes.
- PVP player projectiles can damage opposing players.
- Fixed a PVP projectile ownership bug where a remote fireball could damage the shooter.
