import axios, { AxiosInstance } from 'axios'
import https from 'https'
import mqtt, { MqttClient } from 'mqtt'
import { HueLib } from './hue-lib'

export interface Config {
  brokerUrl: string
  hueUrl: string
  hueUser?: string
}

export const loadConfig = (): Config => {
  return {
    brokerUrl:
      process.env.MQTT_BROKER_URL ||
      'mqtt://mosquitto.mqtt.svc.cluster.local:1883',
    hueUrl: process.env.HUE_URL || 'https://192.168.1.111',
    hueUser: process.env.HUE_USER,
  }
}

export const createHueApi = (
  hueUrl: string,
  hueUser?: string,
): AxiosInstance => {
  return axios.create({
    baseURL: hueUrl,
    headers: {
      'Content-Type': 'application/json',
      'hue-application-key': hueUser,
    },
    httpsAgent: new https.Agent({
      rejectUnauthorized: false,
    }),
  })
}

export const createMqttClient = (brokerUrl: string): MqttClient => {
  return mqtt.connect(brokerUrl)
}

export const setupServices = (config: Config) => {
  const mqttClient = createMqttClient(config.brokerUrl)
  const hueApi = createHueApi(config.hueUrl, config.hueUser)
  const hueLib = new HueLib(hueApi)

  return { mqttClient, hueApi, hueLib }
}
