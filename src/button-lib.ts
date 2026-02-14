export type TuyaButtonState = {
  action: 'single' | 'double' | 'hold'
}
export class ButtonLib {
  handleButtonPress(buttonId: string, state: TuyaButtonState) {
    console.log(`Button ${buttonId} pressed! Action: ${state.action}`)
  }
}
