import { TuyaButtonState } from './button-lib'
import { BEDROOM_LIGHT, BUTTON_1 } from './topics'
import { loadConfig, setupServices } from './config'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const config = loadConfig()
const { mqttClient: client, hueLib } = setupServices(config)

const KITCHEN_SENSOR_TOPIC = 'zigbee2mqtt/kitchen_sensor'
const KITCHEN_LIGHT_TOPIC = 'zigbee2mqtt/kitchen_switch/set'

let kitchenOccupied = false
let kitchenLightsTimer: NodeJS.Timeout | null = null
let kitchenLightState: 'ON' | 'OFF' = 'OFF'
let isProcessingButtonPress = false
let lastButtonPressTime = 0
const LIGHT_DURATION_MS = 5 * 60 * 1000
const BUTTON_DEBOUNCE_MS = 2000

client.on('connect', async () => {
  console.log('Connected to MQTT broker')
  const topics = [KITCHEN_SENSOR_TOPIC, BUTTON_1]

  client.subscribe(topics, (err) => {
    if (err) {
      console.error('Failed to subscribe to topics:', err)
    } else {
      console.log(`Subscribed to: ${topics.join(', ')}`)
    }
  })
})

client.on('message', async (topic: string, message: Buffer) => {
  const msg = message.toString()

  if (topic === KITCHEN_SENSOR_TOPIC) {
    await handleKitchenMotion(msg)
  } else if (topic === BUTTON_1) {
    await handleButtonPress(msg)
  }
})

const handleKitchenMotion = async (msg: string) => {
  try {
    const payload = JSON.parse(msg)

    if (typeof payload.occupancy !== 'boolean') return

    kitchenOccupied = payload.occupancy

    if (payload.occupancy) {
      console.log('Kitchen motion detected - turning on lights')

      if (kitchenLightsTimer) {
        clearTimeout(kitchenLightsTimer)
        kitchenLightsTimer = null
      }

      turnOnKitchenLights('ON')
      kitchenLightsTimer = setTimeout(
        checkAndTurnOffKitchenLights,
        LIGHT_DURATION_MS,
      )
    } else {
      console.log('Kitchen motion cleared - scheduling turn off')

      if (kitchenLightsTimer) {
        clearTimeout(kitchenLightsTimer)
      }
      kitchenLightsTimer = setTimeout(
        checkAndTurnOffKitchenLights,
        LIGHT_DURATION_MS,
      )
    }
  } catch (err) {
    console.error('Failed to parse kitchen motion sensor message:', err)
  }
}

const handleButtonPress = async (msg: string) => {
  // Debounce: ignore if a press is already being processed
  if (isProcessingButtonPress) {
    console.log('⏭️  Ignoring button press - previous press still processing')
    return
  }

  // Debounce: ignore if pressed too recently
  const now = Date.now()
  if (now - lastButtonPressTime < BUTTON_DEBOUNCE_MS) {
    console.log('⏭️  Ignoring button press - too soon after last press')
    return
  }

  isProcessingButtonPress = true
  lastButtonPressTime = now

  try {
    const buttonState: TuyaButtonState = JSON.parse(msg)
    console.log(`Button action: ${buttonState.action}`)

    if (buttonState.action === 'single') {
      try {
        // Fetch actual current state from the light before toggling
        console.log('🔍 Fetching current bedroom light state...')
        const currentState = await hueLib.getLightStatus(BEDROOM_LIGHT)
        console.log(`📊 Current state: ${currentState ? 'ON' : 'OFF'}`)

        const newState = !currentState
        console.log(
          `Attempting to turn bedroom light ${newState ? 'ON' : 'OFF'}`,
        )

        await hueLib.turnLightOnOff(BEDROOM_LIGHT, newState)

        // Verify the light actually changed state
        const verifiedState = await hueLib.getLightStatus(BEDROOM_LIGHT)
        console.log(
          `🔍 Verified state after toggle: ${verifiedState ? 'ON' : 'OFF'}`,
        )

        if (verifiedState === newState) {
          console.log(
            `✓ Bedroom light successfully turned ${newState ? 'ON' : 'OFF'}`,
          )
        } else {
          console.error(
            `❌ Light state verification failed! Expected ${newState ? 'ON' : 'OFF'}, but got ${verifiedState ? 'ON' : 'OFF'}`,
          )
        }
      } catch (err) {
        console.error('Failed to control bedroom light:', err)
      }
    } else if (
      buttonState.action === 'double' ||
      buttonState.action === 'hold'
    ) {
      const newState = kitchenLightState === 'OFF' ? 'ON' : 'OFF'
      console.log(`Double press - toggling kitchen lights to ${newState}`)
      turnOnKitchenLights(newState)
      if (newState === 'OFF' && kitchenLightsTimer) {
        clearTimeout(kitchenLightsTimer)
        kitchenLightsTimer = null
      }
    }
  } catch (err) {
    console.error('Failed to handle button press:', err)
  } finally {
    isProcessingButtonPress = false
  }
}

const checkAndTurnOffKitchenLights = () => {
  if (!kitchenOccupied) {
    console.log('Kitchen unoccupied - turning off lights')
    turnOnKitchenLights('OFF')
    kitchenLightsTimer = null
  } else {
    console.log('Kitchen still occupied - extending timer')
    kitchenLightsTimer = setTimeout(
      checkAndTurnOffKitchenLights,
      LIGHT_DURATION_MS,
    )
  }
}

const turnOnKitchenLights = (state: 'ON' | 'OFF') => {
  const payload = { state }

  client.publish(KITCHEN_LIGHT_TOPIC, JSON.stringify(payload), (err) => {
    if (err) {
      console.error('Failed to control kitchen lights:', err)
    } else {
      kitchenLightState = state
      console.log(`Kitchen lights: ${state}`)
    }
  })
}

// Handle errors
client.on('error', (err) => {
  console.error('MQTT Error:', err)
})
