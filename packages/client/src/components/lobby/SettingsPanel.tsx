import type { GameSettings } from '@uno/shared'
import { UNIVERSAL_HOUSE_RULES, MAX_PLAYERS, MIN_PLAYERS, MAX_TURN_TIME } from '@uno/shared'

interface SettingsPanelProps {
  settings: GameSettings | null
  isHost: boolean
  onUpdateSettings: (settings: Partial<GameSettings>) => void
  rememberHouseRules: boolean
  onToggleRememberHouseRules: () => void
}

export function SettingsPanel({ settings, isHost, onUpdateSettings, rememberHouseRules, onToggleRememberHouseRules }: SettingsPanelProps) {
  if (!settings) return null

  const handleHouseRuleToggle = (ruleId: string) => {
    onUpdateSettings({
      houseRules: {
        ...settings.houseRules,
        [ruleId]: !settings.houseRules[ruleId],
      },
    })
  }

  const handleHouseRuleNumber = (ruleId: string, value: number) => {
    onUpdateSettings({
      houseRules: {
        ...settings.houseRules,
        [ruleId]: value,
      },
    })
  }

  return (
    <div className="bg-gray-800/50 rounded-xl p-6 w-80 max-h-[500px] overflow-y-auto">
      <h3 className="font-semibold mb-4 text-lg">Game Settings</h3>

      {/* Core settings */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="text-sm text-gray-400 block mb-1">Gamemode</label>
          <div className="text-white font-medium capitalize">
            {settings.gamemode.replace('-', ' ')}
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.isPublic}
            onChange={() => onUpdateSettings({ isPublic: !settings.isPublic })}
            disabled={!isHost}
            className="accent-blue-500 w-4 h-4"
          />
          <div>
            <div className="text-sm">Public Game</div>
            <div className="text-xs text-gray-500">Visible in the public game browser</div>
          </div>
        </label>

        <div>
          <label className="text-sm text-gray-400 block mb-1">
            Turn Time: {settings.turnTimeLimit}s
          </label>
          {isHost ? (
            <input
              type="range"
              min={5}
              max={MAX_TURN_TIME}
              step={5}
              value={settings.turnTimeLimit}
              onChange={(e) =>
                onUpdateSettings({ turnTimeLimit: Number(e.target.value) })
              }
              className="w-full accent-blue-500"
            />
          ) : (
            <div className="text-white">{settings.turnTimeLimit}s</div>
          )}
        </div>

        <div>
          <label className="text-sm text-gray-400 block mb-1">
            Max Players: {settings.maxPlayers}
          </label>
          {isHost ? (
            <input
              type="range"
              min={MIN_PLAYERS}
              max={MAX_PLAYERS}
              step={1}
              value={settings.maxPlayers}
              onChange={(e) =>
                onUpdateSettings({ maxPlayers: Number(e.target.value) })
              }
              className="w-full accent-blue-500"
            />
          ) : (
            <div className="text-white">{settings.maxPlayers}</div>
          )}
        </div>
      </div>

      {/* House Rules */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-sm text-gray-400 uppercase tracking-wider">
          House Rules
        </h4>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={rememberHouseRules}
            onChange={onToggleRememberHouseRules}
            className="accent-blue-500 w-3.5 h-3.5"
          />
          <span className="text-xs text-gray-400">Remember</span>
        </label>
      </div>
      <div className="space-y-3">
        {UNIVERSAL_HOUSE_RULES.map((rule) => (
          <div key={rule.id}>
            {rule.type === 'boolean' ? (
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={!!settings.houseRules[rule.id]}
                  onChange={() => handleHouseRuleToggle(rule.id)}
                  disabled={!isHost}
                  className="accent-blue-500 w-4 h-4"
                />
                <div>
                  <div className="text-sm group-hover:text-white transition-colors">
                    {rule.label}
                  </div>
                  <div className="text-xs text-gray-500">{rule.description}</div>
                </div>
              </label>
            ) : (
              <div>
                <div className="text-sm mb-1">{rule.label}: {String(settings.houseRules[rule.id] ?? rule.default)}</div>
                <div className="text-xs text-gray-500 mb-1">{rule.description}</div>
                {isHost ? (
                  <input
                    type="range"
                    min={rule.min ?? 1}
                    max={rule.max ?? 10}
                    step={1}
                    value={Number(settings.houseRules[rule.id] ?? rule.default)}
                    onChange={(e) => handleHouseRuleNumber(rule.id, Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                ) : null}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
