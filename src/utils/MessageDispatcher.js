/**
 * MessageDispatcher - Dispatches messages to Redux store based on type
 * Extracted from Widget component to improve code organization
 */

import {
  addResponseMessage,
  addButtons,
  addCarousel,
  addVideoSnippet,
  addImageSnippet,
  renderCustomComponent,
  setCustomCss
} from 'actions';
import { isText, isButtons, isCarousel, isVideo, isImage } from '../handlers/msgProcessor';

export class MessageDispatcher {
  constructor(dispatch, customComponent) {
    this.dispatch = dispatch;
    this.customComponent = customComponent;
  }

  /**
   * Dispatch message to Redux store based on its type
   * @param {Object} message - Message to dispatch
   */
  dispatchMessage(message) {
    if (Object.keys(message).length === 0) {
      return;
    }

    const { customCss, ...messageClean } = message;

    if (isText(messageClean)) {
      this.dispatch(addResponseMessage(messageClean.text));
    } else if (isButtons(messageClean)) {
      this.dispatch(addButtons(messageClean));
    } else if (isCarousel(messageClean)) {
      this.dispatch(addCarousel(messageClean));
    } else if (isVideo(messageClean)) {
      this.dispatchVideo(messageClean);
    } else if (isImage(messageClean)) {
      this.dispatchImage(messageClean);
    } else {
      // Custom message type
      this.dispatchCustom(messageClean);
    }

    if (customCss) {
      this.dispatch(setCustomCss(message.customCss));
    }
  }

  /**
   * Dispatch video message
   * @param {Object} message - Video message
   */
  dispatchVideo(message) {
    const element = message.attachment.payload;
    this.dispatch(
      addVideoSnippet({
        title: element.title,
        video: element.src
      })
    );
  }

  /**
   * Dispatch image message
   * @param {Object} message - Image message
   */
  dispatchImage(message) {
    const element = message.attachment.payload;
    this.dispatch(
      addImageSnippet({
        title: element.title,
        image: element.src
      })
    );
  }

  /**
   * Dispatch custom component message
   * @param {Object} props - Custom component props
   */
  dispatchCustom(props) {
    if (this.customComponent) {
      this.dispatch(renderCustomComponent(this.customComponent, props, true));
    }
  }
}
