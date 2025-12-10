// Action Types
export const INITIALIZE = 'INITIALIZE';
export const CONNECT = 'CONNECT';
export const DISCONNECT = 'DISCONNECT';
export const GET_OPEN_STATE = 'GET_OPEN_STATE';
export const GET_VISIBLE_STATE = 'GET_VISIBLE_STATE';
export const GET_FULLSCREEN_STATE = 'GET_FULLSCREEN_STATE';
export const SHOW_CHAT = 'SHOW_CHAT';
export const HIDE_CHAT = 'HIDE_CHAT';
export const TOGGLE_CHAT = 'TOGGLE_CHAT';
export const OPEN_CHAT = 'OPEN_CHAT';
export const CLOSE_CHAT = 'CLOSE_CHAT';
export const TOGGLE_FULLSCREEN = 'TOGGLE_FULLSCREEN';
export const TOGGLE_INPUT_DISABLED = 'TOGGLE_INPUT_DISABLED';
export const ADD_NEW_USER_MESSAGE = 'ADD_NEW_USER_MESSAGE';
export const EMIT_NEW_USER_MESSAGE = 'EMIT_NEW_USER_MESSAGE';
export const ADD_NEW_RESPONSE_MESSAGE = 'ADD_NEW_RESPONSE_MESSAGE';
export const ADD_CAROUSEL = 'ADD_CAROUSEL';
export const ADD_NEW_VIDEO_VIDREPLY = 'ADD_NEW_VIDEO_VIDREPLY';
export const ADD_NEW_IMAGE_IMGREPLY = 'ADD_NEW_IMAGE_IMGREPLY';
export const ADD_COMPONENT_MESSAGE = 'ADD_COMPONENT_MESSAGE';
export const ADD_BUTTONS = 'ADD_BUTTONS';
export const SET_BUTTONS = 'SET_BUTTONS';
export const INSERT_NEW_USER_MESSAGE = 'INSERT_NEW_USER_MESSAGE';
export const DROP_MESSAGES = 'DROP_MESSAGES';
export const CLEAR_MESSAGES = 'CLEAR_MESSAGES';
export const PULL_SESSION = 'PULL_SESSION';
export const NEW_UNREAD_MESSAGE = 'NEW_UNREAD_MESSAGE';
export const TRIGGER_MESSAGE_DELAY = 'TRIGGER_MESSAGE_DELAY';
export const TRIGGER_TOOLTIP_SENT = 'TRIGGER_TOOLTIP_SENT';
export const SHOW_TOOLTIP = 'SHOW_TOOLTIP';
export const CLEAR_METADATA = 'CLEAR_METADATA';
export const SET_LINK_TARGET = 'SET_LINK_TARGET';
export const SET_USER_INPUT = 'SET_USER_INPUT';
export const SET_PAGECHANGE_CALLBACKS = 'SET_PAGECHANGE_CALLBACKS';
export const SET_DOM_HIGHLIGHT = 'SET_DOM_HIGHLIGHT';
export const SET_HINT_TEXT = 'SET_HINT_TEXT';
export const SET_OLD_URL = 'SET_OLD_URL';
export const EVAL_URL = 'EVAL_URL';
export const SET_CUSTOM_CSS = 'SET_CUSTOM_CSS';
export const SET_FIRST_CHAT_STARTED = 'SET_FIRST_CHAT_STARTED';
export const SET_BOT_PROCESSING = 'SET_BOT_PROCESSING';

// Action Creators
export function initialize() {
  return {
    type: INITIALIZE
  };
}

export function connectServer() {
  return {
    type: CONNECT
  };
}

export function disconnectServer() {
  return {
    type: DISCONNECT
  };
}

export function getOpenState() {
  return {
    type: GET_OPEN_STATE
  };
}

export function getVisibleState() {
  return {
    type: GET_VISIBLE_STATE
  };
}

export function showChat() {
  return {
    type: SHOW_CHAT
  };
}

export function hideChat() {
  return {
    type: HIDE_CHAT
  };
}

export function toggleChat() {
  return {
    type: TOGGLE_CHAT
  };
}

export function openChat() {
  return {
    type: OPEN_CHAT
  };
}

export function closeChat() {
  return {
    type: CLOSE_CHAT
  };
}

export function toggleFullScreen() {
  return {
    type: TOGGLE_FULLSCREEN
  };
}

export function toggleInputDisabled(disable) {
  return {
    type: TOGGLE_INPUT_DISABLED,
    disable
  };
}

export function addUserMessage(text, nextMessageIsTooltip = false, hidden = false) {
  return {
    type: ADD_NEW_USER_MESSAGE,
    text,
    nextMessageIsTooltip,
    hidden
  };
}

export function emitUserMessage(text) {
  return {
    type: EMIT_NEW_USER_MESSAGE,
    text
  };
}

export function addResponseMessage(text) {
  return {
    type: ADD_NEW_RESPONSE_MESSAGE,
    text
  };
}

export function addCarousel(carousel) {
  return {
    type: ADD_CAROUSEL,
    carousel
  };
}

export function addVideoSnippet(video) {
  return {
    type: ADD_NEW_VIDEO_VIDREPLY,
    video
  };
}

export function addImageSnippet(image) {
  return {
    type: ADD_NEW_IMAGE_IMGREPLY,
    image
  };
}

export function addButtons(buttons) {
  return {
    type: ADD_BUTTONS,
    buttons
  };
}

export function setButtons(id, title) {
  return {
    type: SET_BUTTONS,
    id,
    title
  };
}

export function insertUserMessage(index, text) {
  return {
    type: INSERT_NEW_USER_MESSAGE,
    index,
    text
  };
}

export function renderCustomComponent(component, props, showAvatar) {
  return {
    type: ADD_COMPONENT_MESSAGE,
    component,
    props,
    showAvatar
  };
}

export function dropMessages() {
  return {
    type: DROP_MESSAGES
  };
}

export function clearMessages() {
  return {
    type: CLEAR_MESSAGES
  };
}

export function pullSession() {
  return {
    type: PULL_SESSION
  };
}

export function newUnreadMessage() {
  return {
    type: NEW_UNREAD_MESSAGE
  };
}

export function triggerMessageDelayed(messageDelayed) {
  return {
    type: TRIGGER_MESSAGE_DELAY,
    messageDelayed
  };
}

export function showTooltip(visible) {
  return {
    type: SHOW_TOOLTIP,
    visible
  };
}


export function triggerTooltipSent(payloadSent) {
  return {
    type: TRIGGER_TOOLTIP_SENT,
    payloadSent
  };
}

export function clearMetadata() {
  return {
    type: CLEAR_METADATA
  };
}

export function setLinkTarget(target) {
  return {
    type: SET_LINK_TARGET,
    target
  };
}

export function setUserInput(userInputState) {
  return {
    type: SET_USER_INPUT,
    userInputState
  };
}

export function setPageChangeCallbacks(pageChangeCallbacks) {
  return {
    type: SET_PAGECHANGE_CALLBACKS,
    pageChangeCallbacks
  };
}


export function setDomHighlight(domHighlight) {
  return {
    type: SET_DOM_HIGHLIGHT,
    domHighlight
  };
}

export function hintText(hint) {
  return {
    type: SET_HINT_TEXT,
    hint
  };
}


export function changeOldUrl(url) {
  return {
    type: SET_OLD_URL,
    url
  };
}

export function evalUrl(url) {
  return {
    type: EVAL_URL,
    url
  };
}

export function setCustomCss(customCss) {
  return {
    type: SET_CUSTOM_CSS,
    customCss
  };
}

export function setFirstChatStarted() {
  return {
    type: SET_FIRST_CHAT_STARTED
  };
}

export function setBotProcessing(isProcessing) {
  return {
    type: SET_BOT_PROCESSING,
    isProcessing
  };
}
