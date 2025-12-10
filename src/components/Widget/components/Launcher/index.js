/* eslint-disable jsx-a11y/no-static-element-interactions */
import React, { useState, useContext } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Map } from 'immutable';
import ImmutablePropTypes from 'react-immutable-proptypes';
import { usePopper } from 'react-popper';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

import { showTooltip as showTooltipAction, emitUserMessage } from 'actions';
import openLauncher from 'assets/launcher_button.svg';
import close from 'assets/clear-button.svg';
import Badge from './components/Badge';
import DiscoveryTooltip from './components/DiscoveryTooltip';
import { TooltipRenderer } from './components/TooltipRenderer';
import { useTooltipReference } from './hooks/useTooltipReference';
import { useDragDetection } from './hooks/useDragDetection';
import { getLastBotMessages, getLastUserMessage } from './utils/messageSelectors';
import './style.scss';
import ThemeContext from '../../ThemeContext';

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
  closeTooltip,
  lastUserMessage,
  domHighlight,
  sendPayload,
  firstChatStarted
}) => {
  const { mainColor, assistBackgoundColor } = useContext(ThemeContext);
  const [isHovered, setIsHovered] = useState(false);

  // Use custom hooks
  const referenceElement = useTooltipReference(lastUserMessage, domHighlight);
  const dragHandlers = useDragDetection();

  const [popperElement, setPopperElement] = useState(null);
  const [arrowElement, setArrowElement] = useState(null);

  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    modifiers: [
      { name: 'arrow', options: { element: arrowElement, padding: 5 } },
      { name: 'preventOverflow', options: { padding: 15 } }
    ],
    placement: (domHighlight && domHighlight.get('tooltipPlacement')) || 'auto'
  });

  const className = ['rw-launcher'];
  const lastMessage = lastMessages ? lastMessages.slice(-1)[0] : new Map();

  if (isChatOpen) className.push('rw-hide-sm');
  if (isChatOpen) className.push('rw-hide');
  if (fullScreenMode && isChatOpen) className.push('rw-full-screen rw-hide');

  const renderOpenLauncherImage = () => (
    <div className="rw-open-launcher__container">
      {unreadCount > 0 && displayUnreadCount && (
        <div className="rw-unread-count-pastille">{unreadCount}</div>
      )}
      <img src={openLauncherImage || openLauncher} className="rw-open-launcher" alt="" />
      {showTooltip && lastMessage && lastMessage.get('sender') === 'response' && (
        <TooltipRenderer
          lastMessages={lastMessages}
          toggle={toggle}
          closeTooltip={closeTooltip}
          domHighlight={domHighlight}
          sendPayload={sendPayload}
          referenceElement={referenceElement}
          popperElement={setPopperElement}
          arrowElement={setArrowElement}
          popperStyles={styles}
          popperAttributes={attributes}
          assistBackgoundColor={assistBackgoundColor}
          onDragHandlers={dragHandlers}
        />
      )}
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
  toggle: PropTypes.func,
  isChatOpen: PropTypes.bool,
  badge: PropTypes.number,
  fullScreenMode: PropTypes.bool,
  openLauncherImage: PropTypes.string,
  closeImage: PropTypes.string,
  unreadCount: PropTypes.number,
  displayUnreadCount: PropTypes.bool,
  showTooltip: PropTypes.bool,
  lastUserMessage: PropTypes.oneOfType([ImmutablePropTypes.map, PropTypes.bool]),
  domHighlight: PropTypes.shape({}),
  lastMessages: PropTypes.arrayOf(ImmutablePropTypes.map),
  firstChatStarted: PropTypes.bool
};

const mapStateToProps = state => ({
  lastMessages: getLastBotMessages(state),
  unreadCount: state.behavior.get('unreadCount') || 0,
  showTooltip: state.metadata.get('showTooltip'),
  linkTarget: state.metadata.get('linkTarget'),
  lastUserMessage: getLastUserMessage(state),
  domHighlight: state.metadata.get('domHighlight')
});

const mapDispatchToProps = dispatch => ({
  closeTooltip: () => dispatch(showTooltipAction(false)),
  sendPayload: (payload) => dispatch(emitUserMessage(payload))
});

export default connect(mapStateToProps, mapDispatchToProps)(Launcher);
