import { AxiosInstance } from 'axios'

export class HueLib {
  hueApi: AxiosInstance

  constructor(hueApi: AxiosInstance) {
    this.hueApi = hueApi
  }

  getHueRoomByName = async (roomName: string) => {
    const response = await this.hueApi.get(
      '/clip/v2/resource/device/edd98d47-4d42-4159-be6e-158f47c7ac06',
    )
    const rooms = response.data
    console.log(JSON.stringify(rooms, null, 2))
  }

  getLightStatus = async (lightId: string) => {
    const response = await this.hueApi.get(`/clip/v2/resource/light/${lightId}`)
    return response.data.data[0].on.on
  }

  turnLightOnOff = async (lightId: string, on: boolean) => {
    const payload = {
      on: {
        on,
      },
    }
    await this.hueApi.put(`/clip/v2/resource/light/${lightId}`, payload)
  }
}
