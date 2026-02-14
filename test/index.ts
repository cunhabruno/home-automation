import { config } from '@dotenvx/dotenvx'
import { BEDROOM_LIGHT, BUTTON_1, TOPICS } from '../src/topics'
import { TuyaButtonState } from '../src/button-lib'
import { loadConfig, setupServices } from '../src/config'

config()

const testConfig = loadConfig()
const { mqttClient: client, hueLib } = setupServices(testConfig)

console.log(`Test environment connecting to:`)
console.log(`  MQTT: ${testConfig.brokerUrl}`)
console.log(`  Hue: ${testConfig.hueUrl}`)
console.log(`  User: ${testConfig.hueUser || '(not set)'}`)

client.on('connect', () => {
  console.log('Connected to MQTT broker')

  client.subscribe(TOPICS, (err) => {
    if (err) {
      console.error(`Failed to subscribe to topics: `, err)
    } else {
      console.log(`Subscribed to ${TOPICS.join(', ')}`)
    }
  })
})

client.on('message', async (topic: string, message: Buffer) => {
  const msg = message.toString()
  console.log(`Received message on topic ${topic}: ${msg}`)
  if (topic === BUTTON_1) {
    const buttonState: TuyaButtonState = JSON.parse(msg)
    if (buttonState.action === 'single') {
      console.log(`Button 1 single press detected`)
      const status = await hueLib.getLightStatus(BEDROOM_LIGHT)
      console.log(`Button 1 pressed! Bedroom light status: ${status}`)
      await hueLib.turnLightOnOff(BEDROOM_LIGHT, !status)
    } else if (buttonState.action === 'double') {
      console.log(`Button 1 double press detected`)
    } else if (buttonState.action === 'hold') {
      console.log(`Button 1 long press detected`)
    } else {
      console.log(`Button 1 unknown action: ${buttonState.action}`)
    }
  }
})

client.on('error', (err) => {
  console.error('MQTT Error:', err)
})
