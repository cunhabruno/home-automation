import { MqttClient } from 'mqtt'

export class Lib {
  private client: MqttClient
  constructor(client: MqttClient) {
    this.client = client
  }
  switchLights(state: 'ON' | 'OFF', lightName: string) {
    const topic = `zigbee2mqtt/${lightName}/set`
    const payload = { state }

    this.client.publish(topic, JSON.stringify(payload), (err) => {
      if (err) {
        console.error(`Failed to turn on ${lightName} lights:`, err)
      } else {
        console.log(`${lightName} lights turned ` + state)
      }
    })
  }

  getSensorData(sensorName: string) {
    const topic = `zigbee2mqtt/${sensorName}/get`

    this.client.publish(topic, JSON.stringify({}), (err) => {
      if (err) {
        console.error(`Failed to get data from ${sensorName}:`, err)
      } else {
        console.log(`Requested data from ${sensorName}`)
      }
    })
  }
}
