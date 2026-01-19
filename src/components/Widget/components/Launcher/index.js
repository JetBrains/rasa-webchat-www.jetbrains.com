/* eslint-disable jsx-a11y/no-static-element-interactions, react/jsx-props-no-spreading */
import React, { useState, useEffect, useContext, useRef } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Map } from 'immutable';
import ImmutablePropTypes from 'react-immutable-proptypes';
import { usePopper } from 'react-popper';
import Slider from 'react-slick';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

import { MESSAGES_TYPES } from 'constants';
import { Image, Message, Buttons } from 'messagesComponents';
import { showTooltip as showTooltipAction, emitUserMessage} from 'actions';

import openLauncher from 'assets/launcher_button.svg';
import closeIcon from 'assets/clear-button-grey.svg';
import close from 'assets/clear-button.svg';
import {onRemove,  safeQuerySelectorAll } from 'utils/dom';
import Badge from './components/Badge';
// eslint-disable-next-line import/no-named-as-default
import DiscoveryTooltip from './components/DiscoveryTooltip';
import './style.scss';
import ThemeContext from '../../ThemeContext';

// eslint-disable-next-line react/function-component-definition
const Launcher = ({
  toggle,
  isChatOpen,
  badge,
  fullScreenMode,
  openLauncherImage,
  closeImage,
  unreadCount,
  displayUnreadCount,
  showTooltip,
  lastMessages,
  // eslint-disable-next-line react/prop-types
  closeTooltip,
  lastUserMessage,
  // eslint-disable-next-line react/prop-types
  domHighlight,
  // eslint-disable-next-line react/prop-types
  sendPayload,
  firstChatStarted
}) => {
  const { mainColor, assistBackgoundColor } = useContext(ThemeContext);
  const [isHovered, setIsHovered] = useState(false);

  const [referenceElement, setReferenceElement] = useState(null);

  useEffect(() => {
    const setReference = (selector) => {
      const reference = safeQuerySelectorAll(selector)
      if (reference && reference.length === 1) {
        onRemove(reference[0], () => setReferenceElement(null));
        setReferenceElement(reference[0]);
      } else {
        setReferenceElement(null);
      }
    };
    if (lastUserMessage && lastUserMessage.get('nextMessageIsTooltip')) {
      setReference(lastUserMessage.get('nextMessageIsTooltip'));
      // eslint-disable-next-line react/prop-types
    } else if (domHighlight && domHighlight.get('selector')) {
      // eslint-disable-next-line react/prop-types
      setReference(domHighlight.get('selector'));
    } else {
      setReferenceElement(null);
    }
  }, [lastUserMessage, domHighlight]);

  const [popperElement, setPopperElement] = useState(null);
  const [arrowElement, setArrowElement] = useState(null);

  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    modifiers: [
      // The arrow padding ensures it never get on the border where it looks ugly
      { name: 'arrow', options: { element: arrowElement, padding: 5 } },
      {
        name: 'preventOverflow',
        options: {
          padding: 15 // 0 by default
        }
      }
    ],
    // eslint-disable-next-line react/prop-types
    placement: (domHighlight && domHighlight.get('tooltipPlacement')) || 'auto'
  });

  const className = ['rw-launcher'];

  const sliderSettings = {
    dots: true,
    infinite: false,
    adaptiveHeight: true
  };
  const lastMessage = lastMessages ? lastMessages.slice(-1)[0] : new Map();
  // This is used to distinguish bw drag and click events in the tooltips sequences.
  const dragStatus = useRef({
    x: 0,
    y: 0
  });

  if (isChatOpen) className.push('rw-hide-sm');
  if (isChatOpen) className.push('rw-hide');
  if (fullScreenMode && isChatOpen) className.push('rw-full-screen rw-hide');
// eslint-disable-next-line consistent-return
  const getComponentToRender = (message, buttonSeparator = false) => {
    const ComponentToRender = (() => {
      switch (message.get('type')) {
        case MESSAGES_TYPES.TEXT: {
          return Message;
        }
        case MESSAGES_TYPES.IMGREPLY.IMAGE: {
          return Image;
        }
        case MESSAGES_TYPES.BUTTONS: {
          return Buttons;
        }
        default:
          return null;
      }
    })();
    if (ComponentToRender) { return <ComponentToRender separateButtons={buttonSeparator} id={-1} params={{}} message={message} isLast />; }
    toggle(); // open the chat if the tooltip do not know how to display the compoment
  };


  const renderSequenceTooltip = (lastMessagesSeq) => (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
    <div className="rw-slider-safe-zone" onClick={(e) => e.stopPropagation()}>
      <Slider {...sliderSettings}>
        {lastMessagesSeq.map((message) => (
          // eslint-disable-next-line jsx-a11y/no-static-element-interactions, react/jsx-key
          <div
            className="rw-tooltip-response"
            onMouseDown={(event) => {
              dragStatus.current.x = event.clientX;
              dragStatus.current.y = event.clientY;
            }}
            onMouseUp={(event) => {
              if (
                Math.abs(dragStatus.current.x - event.clientX) +
                Math.abs(dragStatus.current.y - event.clientY) <
              15
              ) {
                toggle();
              }
            }}
          >
            {getComponentToRender(message)}
          </div>
        ))}
      </Slider>
    </div>
  )
    ;

  const renderTooltipContent = () => (
    // eslint-disable-next-line react/jsx-fragments
    <React.Fragment>
      <div className="rw-tooltip-close">
        {/* eslint-disable-next-line react/button-has-type */}
        <button
          onClick={(e) => {
            /* stop the propagation because the popup is also a button
            otherwise it would open the webchat when closing the tooltip */
            e.stopPropagation();

            // eslint-disable-next-line react/prop-types
            const payload = domHighlight.get('tooltipClose')
              if(domHighlight && payload){
                sendPayload(`/${payload}`)
              }
            closeTooltip();
          }}
        >
          <img src={closeIcon} alt="close" />
        </button>
      </div>
      { lastMessages.length === 1 ? (<div
        onMouseUp={() => toggle()}
      >
        {getComponentToRender(lastMessages[0], true)}
      </div>) : renderSequenceTooltip(lastMessages) }
    </React.Fragment>
  );

  const renderPlacedTooltip = () => (
    <div
      className="rw-tooltip-body"
      ref={setPopperElement}
      style={styles.popper}
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...attributes.popper}
    >
      {renderTooltipContent()}
      <div
        className="rw-tooltip-decoration rw-popper-arrow"
        ref={setArrowElement}
        style={styles.arrow}
      />
    </div>
  );

  const renderToolTip = () => (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div className="rw-tooltip-body" style={{ backgroundColor: assistBackgoundColor }} onClick={(e) => { e.stopPropagation(); }}>
      {renderTooltipContent()}
      <div className="rw-tooltip-decoration" style={{ backgroundColor: assistBackgoundColor }} />
    </div>
  );

  const renderOpenLauncherImage = () => (
    <div className="rw-open-launcher__container">
      {unreadCount > 0 && displayUnreadCount && (
        <div className="rw-unread-count-pastille">{unreadCount}</div>
      )}
      <img src={openLauncherImage || openLauncher} className="rw-open-launcher" alt="" />
      {showTooltip && lastMessage && lastMessage.get('sender') === 'response' && (referenceElement ? renderPlacedTooltip() : renderToolTip())}
    </div>
  );

  return (
    <div className="rw-launcher-wrapper">
      <button
        type="button"
        style={{ backgroundColor: mainColor }}
        className={className.join(' ')}
        onClick={toggle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Badge badge={badge} />
        {isChatOpen ? (
          <img
            src={closeImage || close}
            className={`rw-close-launcher ${closeImage ? '' : 'rw-default'}`}
            alt=""
          />
        ) : (
          renderOpenLauncherImage()
        )}
      </button>
      {!isChatOpen && (
        <DiscoveryTooltip isHovered={isHovered} firstChatStarted={firstChatStarted} />
      )}
    </div>
  );
};

Launcher.propTypes = {
  // eslint-disable-next-line react/require-default-props
  toggle: PropTypes.func,
  // eslint-disable-next-line react/require-default-props
  isChatOpen: PropTypes.bool,
  // eslint-disable-next-line react/require-default-props
  badge: PropTypes.number,
  // eslint-disable-next-line react/require-default-props
  fullScreenMode: PropTypes.bool,
  // eslint-disable-next-line react/require-default-props
  openLauncherImage: PropTypes.string,
  // eslint-disable-next-line react/require-default-props
  closeImage: PropTypes.string,
  // eslint-disable-next-line react/require-default-props
  unreadCount: PropTypes.number,
  // eslint-disable-next-line react/require-default-props
  displayUnreadCount: PropTypes.bool,
  // eslint-disable-next-line react/require-default-props
  showTooltip: PropTypes.bool,
  // eslint-disable-next-line react/require-default-props
  lastUserMessage: PropTypes.oneOfType([ImmutablePropTypes.map, PropTypes.bool]),
  // eslint-disable-next-line react/require-default-props
  domHighlight: PropTypes.shape({}),
  // eslint-disable-next-line react/require-default-props
  lastMessages: PropTypes.arrayOf(ImmutablePropTypes.map),
  // eslint-disable-next-line react/require-default-props
  firstChatStarted: PropTypes.bool
};

const mapStateToProps = (state) => ({
  lastMessages: (state.messages && (() => {
    const messages = [];
    for (let i = 1; i <= 10; i += 1) {
      if (state.messages.get(-i) && state.messages.get(-i).get('sender') !== 'response') break;
      if (!state.messages.get(-i)) break;
      messages.unshift(state.messages.get(-i));
    }
    return messages;
  })()) || new Map(),
  unreadCount: state.behavior.get('unreadCount') || 0,
  showTooltip: state.metadata.get('showTooltip'),
  linkTarget: state.metadata.get('linkTarget'),
  lastUserMessage: (function getLastUserMessage() {
    if (!state.messages) return false;
    let index = -1;
    while (index > -10) {
      const lastMessage = state.messages.get(index);
      if (lastMessage) {
        if (lastMessage.get('sender') === 'client') return lastMessage;
      } else {
        return false;
      }
      index -= 1;
    }
    return false;
  }()),
  domHighlight: state.metadata.get('domHighlight')
});

const mapDispatchToProps = (dispatch) => ({
  closeTooltip: () => dispatch(showTooltipAction(false)),
  sendPayload: (payload) => dispatch(emitUserMessage(payload))
});

export default connect(mapStateToProps, mapDispatchToProps)(Launcher);
