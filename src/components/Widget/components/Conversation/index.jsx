import React, { useState } from 'react';
import PropTypes from 'prop-types';

import Header from './components/Header';
import Messages from './components/Messages';
import Sender from './components/Sender';
import { RefreshPopup } from './components/RefreshPopup';
import { AuthPlaceholder } from './components/AuthPlaceholder/index.tsx';
import './style.scss';

// eslint-disable-next-line react/function-component-definition
const Conversation = (props) => {
  const [showRefreshPopup, setShowRefreshPopup] = useState(false);

  /* eslint-disable react/destructuring-assignment */
  const content = (
    <>
      <Messages
        profileAvatar={props.profileAvatar}
        params={props.params}
        customComponent={props.customComponent}
        showMessageDate={props.showMessageDate}
      />
      <Sender
        sendMessage={props.sendMessage}
        disabledInput={props.disabledInput}
        inputTextFieldHint={props.inputTextFieldHint}
      />
    </>
  );

  const handleRefreshClick = () => {
    props.refreshSession();
    setShowRefreshPopup(false);
  };

  return (
    <div className="rw-conversation-container">
      {showRefreshPopup ? (
        <RefreshPopup onRefresh={handleRefreshClick} onCancel={() => setShowRefreshPopup(false)} />
      ) : null}
      <Header
        title={props.title}
        subtitle={props.subtitle}
        toggleChat={props.toggleChat}
        refreshSession={() => setShowRefreshPopup(true)}
        toggleFullScreen={props.toggleFullScreen}
        fullScreenMode={props.fullScreenMode}
        showCloseButton={props.showCloseButton}
        showFullScreenButton={props.showFullScreenButton}
        showRefreshButton={!props.onAuthButtonClick}
        connected={props.connected}
        connectingText={props.connectingText}
        closeImage={props.closeImage}
        profileAvatar={props.profileAvatar}
      />
      {props.onAuthButtonClick ? <AuthPlaceholder onClick={props.onAuthButtonClick} /> : content}
    </div>
  );
  /* eslint-enable react/destructuring-assignment */
};
Conversation.propTypes = {
  // eslint-disable-next-line react/require-default-props
  title: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
  // eslint-disable-next-line react/require-default-props
  subtitle: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
  // eslint-disable-next-line react/require-default-props
  sendMessage: PropTypes.func,
  // eslint-disable-next-line react/require-default-props
  profileAvatar: PropTypes.string,
  // eslint-disable-next-line react/require-default-props
  toggleFullScreen: PropTypes.func,
  // eslint-disable-next-line react/require-default-props
  fullScreenMode: PropTypes.bool,
  // eslint-disable-next-line react/require-default-props
  toggleChat: PropTypes.func,
  // eslint-disable-next-line react/require-default-props
  showCloseButton: PropTypes.bool,
  // eslint-disable-next-line react/require-default-props
  showFullScreenButton: PropTypes.bool,
  // eslint-disable-next-line react/require-default-props
  disabledInput: PropTypes.bool,
  // eslint-disable-next-line react/require-default-props
  inputTextFieldHint: PropTypes.string,
  // eslint-disable-next-line react/forbid-prop-types, react/require-default-props
  params: PropTypes.object,
  // eslint-disable-next-line react/require-default-props
  connected: PropTypes.bool,
  // eslint-disable-next-line react/require-default-props
  connectingText: PropTypes.string,
  // eslint-disable-next-line react/require-default-props
  closeImage: PropTypes.string,
  // eslint-disable-next-line react/require-default-props
  customComponent: PropTypes.func,
  // eslint-disable-next-line react/require-default-props
  showMessageDate: PropTypes.oneOfType([PropTypes.bool, PropTypes.func]),
  // eslint-disable-next-line react/require-default-props
  onAuthButtonClick: PropTypes.func,
  // eslint-disable-next-line react/require-default-props
  refreshSession: PropTypes.func,
};

export default Conversation;
