// @flow
import {
    DISMISS_POPUP,
    DISMISS_POPUP_FAILED,
    DISMISS_POPUP_SUCCESS,
    DISPLAY_ALERT_MODAL,
    DISPLAY_CONFIRM_MODAL,
    DISPLAY_POPUP,
    DISPLAY_POPUP_FAILED,
    DISPLAY_POPUP_SUCCESS
} from './actionTypes'

export const displayPopup: ReduxAction = (payload: PopupParams) => ({
  type: DISPLAY_POPUP,
  payload: payload,
})

export const displayPopupSuccess: ReduxAction = (result) => ({
  type: DISPLAY_POPUP_SUCCESS,
  payload: result
})

export const displayPopupFailed: ReduxAction = () => ({
  type: DISPLAY_POPUP_FAILED,
})

export const dismissPopup: ReduxAction = (name = '') => ({
  type: DISMISS_POPUP,
  payload: name
})

export const dismissPopupSuccess: ReduxAction = () => ({
  type: DISMISS_POPUP_SUCCESS
})

export const dismissPopupFailed: ReduxAction = () => ({
  type: DISMISS_POPUP_FAILED
})

export const displayAlertModal: ReduxAction = (payload) => ({
  type: DISPLAY_ALERT_MODAL,
  payload: payload,
})

export const displayConfirmModal: ReduxAction = (payload) => ({
  type: DISPLAY_CONFIRM_MODAL,
  payload: payload,
})

export const displayProgressRequestPopup: ReduxAction = (total: number) => ({
  type: DISPLAY_POPUP,
  payload: {
    name: 'CardIssueProcessPopup',
    closable: false,
    params: {
      current: 0,
      total
    }
  }
})