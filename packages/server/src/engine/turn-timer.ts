import type * as Party from 'partykit/server'

/**
 * Turn timer using PartyKit's alarm API.
 * Call setTurnAlarm when a new turn starts, and handle onAlarm in the room.
 */
export function setTurnAlarm(room: Party.Room, timeoutMs: number): void {
  if (timeoutMs <= 0) return
  room.storage.setAlarm(Date.now() + timeoutMs)
}

export function cancelTurnAlarm(room: Party.Room): void {
  room.storage.deleteAlarm()
}
