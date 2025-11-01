import axios from 'axios'
import { get } from 'http'
import mqtt, { MqttClient } from 'mqtt'
import { off } from 'process'
// MQTT broker details
const brokerUrl =
  process.env.MQTT_BROKER_URL || 'mqtt://mosquitto.mqtt.svc.cluster.local:1883'
const hueUrl = process.env.HUE_URL || 'https://api.meethue.com/bridge'
const hueUser = process.env.HUE_USER

const openuvApiUrl =
  process.env.OPENUV_API_URL || 'https://api.openuv.io/api/v1'
const openuvApiKey = process.env.OPENUV_API_KEY
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const hueApi = axios.create({
  baseURL: hueUrl,
  headers: {
    'Content-Type': 'application/json',
    'hue-application-key': hueUser,
  },
})

const openUvApi = axios.create({
  baseURL: openuvApiUrl,
  headers: {
    'Content-Type': 'application/json',
    'x-access-token': openuvApiKey,
  },
})

const kitchenSensorName = 'kitchen_sensor'
const kitchenLightName = 'kitchen_switch'
const officeSensorName = 'office_sensor'

let kitchenOccupied = false
let kitchenLightsTimer: NodeJS.Timeout | null = null
const LIGHT_DURATION_MS = 10 * 60 * 1000

const client: MqttClient = mqtt.connect(brokerUrl)

client.on('connect', () => {
  console.log('Connected to MQTT broker')
  const motionSensorTopic = `zigbee2mqtt/${kitchenSensorName}`
  const officeSensorTopic = `zigbee2mqtt/${officeSensorName}`
  client.subscribe([motionSensorTopic, officeSensorTopic], (err) => {
    if (err) {
      console.error(`Failed to subscribe to topics: `, err)
    } else {
      console.log(`Subscribed to ${motionSensorTopic} and ${officeSensorTopic}`)
    }
  })
})

client.on('message', async (topic: string, message: Buffer) => {
  const msg = message.toString()
  if (topic === `zigbee2mqtt/${kitchenSensorName}`) {
    try {
      const payload = JSON.parse(msg)

      // Update occupancy state
      kitchenOccupied = payload.occupancy

      if (payload.occupancy) {
        console.log('Motion detected! Turning on kitchen lights.')

        // Clear any existing timer since there's activity
        if (kitchenLightsTimer) {
          clearTimeout(kitchenLightsTimer)
          kitchenLightsTimer = null
        }

        // Turn on lights
        turnOnKitchenLights('ON')

        // Set timer to check and potentially turn off lights after 10 minutes
        kitchenLightsTimer = setTimeout(
          checkAndTurnOffKitchenLights,
          LIGHT_DURATION_MS
        )
      } else {
        console.log('No motion detected.')
        // Don't turn off immediately - let the timer handle it
      }
    } catch (err) {
      console.error('Failed to parse motion sensor message:', err)
    }
  } else if (topic === `zigbee2mqtt/${officeSensorName}`) {
    // try {
    //   const payload = JSON.parse(msg)
    //   if (payload.occupancy) {
    //     console.log('Motion detected! Turning on office lights.')
    //     // if ((await getMyHomeUvData()) < 0.01) {
    //     switchHueGroupedLightByName('Office', true)
    //     // }
    //   } else {
    //     console.log('No motion detected.')
    //     switchHueGroupedLightByName('Office', false)
    //   }
    // } catch (err) {
    //   console.error('Failed to parse office motion sensor message:', err)
    // }
  }
})

// Helper function to check occupancy and turn off lights if unoccupied
const checkAndTurnOffKitchenLights = () => {
  if (!kitchenOccupied) {
    console.log(
      'Checking occupancy - no one present. Turning off kitchen lights.'
    )
    turnOnKitchenLights('OFF')
    kitchenLightsTimer = null
  } else {
    console.log(
      'Checking occupancy - room still occupied. Keeping lights on and checking again in 10 minutes.'
    )
    // Room is still occupied, check again in 10 minutes
    kitchenLightsTimer = setTimeout(
      checkAndTurnOffKitchenLights,
      LIGHT_DURATION_MS
    )
  }
}

// Function to turn on kitchen lights
const turnOnKitchenLights = (state: 'ON' | 'OFF') => {
  const topic = `zigbee2mqtt/${kitchenLightName}/set`
  const payload = { state }

  client.publish(topic, JSON.stringify(payload), (err) => {
    if (err) {
      console.error('Failed to turn on kitchen lights:', err)
    } else {
      console.log('Kitchen lights turned ' + state)
    }
  })
}

const getHueRoomByName = async (roomName: string) => {
  const response = await hueApi.get('resource/room')
  const rooms = response.data
  return rooms.data.find((room: any) => room.metadata.name === roomName)
}

const switchHueGroupedLightByName = async (roomName: string, on = true) => {
  const room = await getHueRoomByName(roomName)
  const group = room.services[0].rid
  return await hueApi.put(`resource/grouped_light/${group}`, {
    on: {
      on,
    },
  })
}

const getMyHomeUvData = async () => {
  const response = await openUvApi.get('/uv', {
    params: {
      lat: 51.46,
      lng: 0.01,
    },
  })
  return response.data.result.uv
}
// Handle errors
client.on('error', (err) => {
  console.error('MQTT Error:', err)
})
