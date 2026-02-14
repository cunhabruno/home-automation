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
const LIGHT_DURATION_MS = 10 * 60 * 1000

client.on('connect', () => {
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
      console.log('Kitchen motion cleared')
    }
  } catch (err) {
    console.error('Failed to parse kitchen motion sensor message:', err)
  }
}

const handleButtonPress = async (msg: string) => {
  try {
    const buttonState: TuyaButtonState = JSON.parse(msg)
    console.log(`Button action: ${buttonState.action}`)

    if (buttonState.action === 'single') {
      const status = await hueLib.getLightStatus(BEDROOM_LIGHT)
      console.log(`Toggling bedroom light (current: ${status ? 'ON' : 'OFF'})`)
      await hueLib.turnLightOnOff(BEDROOM_LIGHT, !status)
    } else if (buttonState.action === 'double') {
      const newState = kitchenLightState === 'OFF' ? 'ON' : 'OFF'
      console.log(`Double press - toggling kitchen lights to ${newState}`)
      turnOnKitchenLights(newState)
      if (newState === 'OFF' && kitchenLightsTimer) {
        clearTimeout(kitchenLightsTimer)
        kitchenLightsTimer = null
      }
    } else if (buttonState.action === 'hold') {
      console.log('Hold detected (no action configured)')
    }
  } catch (err) {
    console.error('Failed to handle button press:', err)
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
