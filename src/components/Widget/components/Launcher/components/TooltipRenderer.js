/**
 * TooltipRenderer - Renders tooltip with messages
 * Extracted from Launcher component to improve code organization
 */

import React from 'react';
import PropTypes from 'prop-types';
import ImmutablePropTypes from 'react-immutable-proptypes';
import Slider from 'react-slick';

import { MESSAGES_TYPES } from 'constants';
import { Image, Message, Buttons } from 'messagesComponents';
import closeIcon from 'assets/clear-button-grey.svg';

const SLIDER_SETTINGS = {
  dots: true,
  infinite: false,
  adaptiveHeight: true
};

export const TooltipRenderer = ({
  lastMessages,
  toggle,
  closeTooltip,
  domHighlight,
  sendPayload,
  referenceElement,
  popperElement,
  arrowElement,
  popperStyles,
  popperAttributes,
  assistBackgoundColor,
  onDragHandlers
}) => {
  const getComponentToRender = (message, buttonSeparator = false) => {
    const ComponentToRender = (() => {
      switch (message.get('type')) {
        case MESSAGES_TYPES.TEXT:
          return Message;
        case MESSAGES_TYPES.IMGREPLY.IMAGE:
          return Image;
        case MESSAGES_TYPES.BUTTONS:
          return Buttons;
        default:
          return null;
      }
    })();

    if (ComponentToRender) {
      return <ComponentToRender separateButtons={buttonSeparator} id={-1} params={{}} message={message} isLast />;
    }
    // Open chat if tooltip doesn't know how to display the component
    toggle();
  };

  const renderSequenceTooltip = (lastMessagesSeq) => (
    <div className="rw-slider-safe-zone" onClick={e => e.stopPropagation()}>
      <Slider {...SLIDER_SETTINGS}>
        {lastMessagesSeq.map((message, index) => (
          <div
            key={index}
            className="rw-tooltip-response"
            onMouseDown={onDragHandlers.onMouseDown}
            onMouseUp={(event) => onDragHandlers.onMouseUp(event, toggle)}
          >
            {getComponentToRender(message)}
          </div>
        ))}
      </Slider>
    </div>
  );

  const renderTooltipContent = () => (
    <React.Fragment>
      <div className="rw-tooltip-close">
        <button
          onClick={(e) => {
            e.stopPropagation();
            const payload = domHighlight.get('tooltipClose');
            if (domHighlight && payload) {
              sendPayload(`/${payload}`);
            }
            closeTooltip();
          }}
        >
          <img src={closeIcon} alt="close" />
        </button>
      </div>
      {lastMessages.length === 1 ? (
        <div onMouseUp={() => toggle()}>
          {getComponentToRender(lastMessages[0], true)}
        </div>
      ) : (
        renderSequenceTooltip(lastMessages)
      )}
    </React.Fragment>
  );

  const renderPlacedTooltip = () => (
    <div
      className="rw-tooltip-body"
      ref={popperElement}
      style={popperStyles.popper}
      {...popperAttributes.popper}
    >
      {renderTooltipContent()}
      <div
        className="rw-tooltip-decoration rw-popper-arrow"
        ref={arrowElement}
        style={popperStyles.arrow}
      />
    </div>
  );

  const renderToolTip = () => (
    <div
      className="rw-tooltip-body"
      style={{ backgroundColor: assistBackgoundColor }}
      onClick={(e) => { e.stopPropagation(); }}
    >
      {renderTooltipContent()}
      <div className="rw-tooltip-decoration" style={{ backgroundColor: assistBackgoundColor }} />
    </div>
  );

  return referenceElement ? renderPlacedTooltip() : renderToolTip();
};

TooltipRenderer.propTypes = {
  lastMessages: PropTypes.arrayOf(ImmutablePropTypes.map).isRequired,
  toggle: PropTypes.func.isRequired,
  closeTooltip: PropTypes.func.isRequired,
  domHighlight: PropTypes.shape({
    get: PropTypes.func
  }),
  sendPayload: PropTypes.func.isRequired,
  referenceElement: PropTypes.any,
  popperElement: PropTypes.func,
  arrowElement: PropTypes.func,
  popperStyles: PropTypes.object.isRequired,
  popperAttributes: PropTypes.object.isRequired,
  assistBackgoundColor: PropTypes.string,
  onDragHandlers: PropTypes.shape({
    onMouseDown: PropTypes.func,
    onMouseUp: PropTypes.func
  }).isRequired
};
