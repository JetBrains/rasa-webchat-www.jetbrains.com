import React, { Component } from 'react';
import PropTypes from 'prop-types';
import ImmutablePropTypes from 'react-immutable-proptypes';
import { connect } from 'react-redux';

import { MESSAGES_TYPES } from 'constants';
import { Video, Image, Message, Carousel, Buttons } from 'messagesComponents';

import './styles.scss';
import ThemeContext from '../../../../ThemeContext';

const isToday = (date) => {
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
};

const formatDate = (date) => {
  const dateToFormat = new Date(date);
  const showDate = isToday(dateToFormat) ? '' : `${dateToFormat.toLocaleDateString()} `;
  return `${showDate}${dateToFormat.toLocaleTimeString('en-US', { timeStyle: 'short' })}`;
};

const isUserAtBottom = () => {
  const messagesDiv = document.getElementById('rw-messages');
  if (!messagesDiv) return true;

  // Check if user is near the bottom
  const indent = 50; // 50px from the bottom
  const position = messagesDiv.scrollTop + messagesDiv.clientHeight;
  const height = messagesDiv.scrollHeight;

  return position >= height - indent;
};

const scrollToBottom = () => {
  const messagesDiv = document.getElementById('rw-messages');
  if (messagesDiv) {
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }
};

class Messages extends Component {
  constructor(props) {
    super(props);
    this.wasAtBottom = true; // Track if user was at bottom before update
    this.state = {
      hasUnreadMessages: false
    };
  }

  componentDidMount() {
    // Always scroll to bottom on initial mount
    scrollToBottom();
    // Add scroll event listener to detect when user scrolls back to bottom
    const messagesDiv = document.getElementById('rw-messages');
    if (messagesDiv) {
      messagesDiv.addEventListener('scroll', this.handleScroll);
    }
  }

  componentWillUnmount() {
    // Clean up scroll event listener
    const messagesDiv = document.getElementById('rw-messages');
    if (messagesDiv) {
      messagesDiv.removeEventListener('scroll', this.handleScroll);
    }
  }

  handleScroll = () => {
    // If user scrolls to bottom manually, clear unread indicator
    // Only update state if it actually changed to avoid unnecessary re-renders
    // eslint-disable-next-line react/destructuring-assignment
    if (isUserAtBottom() && this.state.hasUnreadMessages) {
      this.setState({ hasUnreadMessages: false });
    }
  }

  getSnapshotBeforeUpdate() {
    // Check if user is at bottom BEFORE the new message is rendered
    this.wasAtBottom = isUserAtBottom();
    return null;
  }

  // eslint-disable-next-line react/sort-comp
  componentDidUpdate(prevProps) {
    const { messages } = this.props;
    const hasNewMessages = prevProps.messages.size < messages.size;

    // Check if the new message is from user (client) - if so, always scroll to bottom
    let isUserMessage = false;
    if (hasNewMessages) {
      const lastMessage = messages.last();
      isUserMessage = lastMessage && lastMessage.get('sender') === 'client';
    }

    // Always auto-scroll if user sent a message
    if (isUserMessage) {
      scrollToBottom();
      this.setState({ hasUnreadMessages: false });
      return;
    }

    // Only auto-scroll if user was at the bottom before the update
    if (this.wasAtBottom) {
      scrollToBottom();
      // Clear unread indicator if we auto-scrolled
      // eslint-disable-next-line react/destructuring-assignment
      if (this.state.hasUnreadMessages) {
        this.setState({ hasUnreadMessages: false });
      }
    } else if (hasNewMessages) {
      // User is not at bottom and new messages arrived - show unread indicator
      this.setState({ hasUnreadMessages: true });
    }
  }

  handleScrollToBottom = () => {
    scrollToBottom();
    this.setState({ hasUnreadMessages: false });
  }

  getComponentToRender = (message, index, isLast) => {
    // eslint-disable-next-line react/prop-types, react/destructuring-assignment
    const { params } = this.props;
    const ComponentToRender = (() => {
      switch (message.get('type')) {
        case MESSAGES_TYPES.TEXT: {
          return Message;
        }
        case MESSAGES_TYPES.CAROUSEL: {
          return Carousel;
        }
        case MESSAGES_TYPES.VIDREPLY.VIDEO: {
          return Video;
        }
        case MESSAGES_TYPES.IMGREPLY.IMAGE: {
          return Image;
        }
        case MESSAGES_TYPES.BUTTONS: {
          return Buttons;
        }
        case MESSAGES_TYPES.CUSTOM_COMPONENT:
          return connect(
            (store) => ({ store }),
            (dispatch) => ({ dispatch })
            // eslint-disable-next-line react/destructuring-assignment
          )(this.props.customComponent);
        default:
          return null;
      }
    })();
    if (message.get('type') === 'component') {
      const messageProps = message.get('props');
      return (<ComponentToRender
        id={index}
        // eslint-disable-next-line react/jsx-props-no-spreading
        {...(messageProps.toJS ? messageProps.toJS() : messageProps)}
        isLast={isLast}
      />);
    }
    return <ComponentToRender id={index} params={params} message={message} isLast={isLast} />;
  }

  render() {
    const { displayTypingIndication, profileAvatar } = this.props;

    const renderMessages = () => {
      const {
        messages,
        showMessageDate
      } = this.props;

      if (messages.isEmpty()) return null;

      const groups = [];
      let group = null;

      // eslint-disable-next-line no-nested-ternary
      const dateRenderer = typeof showMessageDate === 'function' ? showMessageDate :
        showMessageDate === true ? formatDate : null;

      const renderMessageDate = (message) => {
        const timestamp = message.get('timestamp');

        if (!dateRenderer || !timestamp) return null;
        const dateToRender = dateRenderer(message.get('timestamp', message));
        return dateToRender
          ? <span className="rw-message-date">{dateRenderer(message.get('timestamp'), message)}</span>
          : null;
      };

      const renderMessage = (message, index) => (
        <div className={`rw-message ${profileAvatar && 'rw-with-avatar'}`} key={index}>
          {
            profileAvatar &&
            message.get('showAvatar') &&
            <img src={profileAvatar} className="rw-avatar" alt="profile" />
          }
          {this.getComponentToRender(message, index, index === messages.size - 1)}
          {renderMessageDate(message)}
        </div>
      );

      messages.forEach((msg, index) => {
        if (msg.get('hidden')) return;
        if (group === null || group.from !== msg.get('sender')) {
          if (group !== null) groups.push(group);

          group = {
            from: msg.get('sender'),
            messages: []
          };
        }

        group.messages.push(renderMessage(msg, index));
      });

      groups.push(group); // finally push last group of messages.

      return groups.map((g, index) => (
        // eslint-disable-next-line react/no-array-index-key
        <div className={`rw-group-message rw-from-${g && g.from}`} key={`group_${index}`}>
          {g.messages}
        </div>
      ));
    };
    const { assistBackgoundColor } = this.context;
    const { hasUnreadMessages } = this.state;

    return (
      <div id="rw-messages" className="rw-messages-container">
        { renderMessages() }
        {displayTypingIndication && (
          <div className={`rw-message rw-typing-indication ${profileAvatar && 'rw-with-avatar'}`}>
            {
              profileAvatar &&
              <img src={profileAvatar} className="rw-avatar" alt="profile" />
            }
            <div style={{ backgroundColor: assistBackgoundColor }} className="rw-response">
              <div id="wave">
                <span className="rw-dot" />
                <span className="rw-dot" />
                <span className="rw-dot" />
              </div>
            </div>
          </div>
        )}
        {hasUnreadMessages && (
          // eslint-disable-next-line react/button-has-type
          <button
            className="rw-new-messages-indicator"
            onClick={this.handleScrollToBottom}
            aria-label="Scroll to new messages"
          >
            <span className="rw-new-messages-text">New messages</span>
            <span className="rw-arrow-down">↓</span>
          </button>
        )}
      </div>
    );
  }
}
Messages.contextType = ThemeContext;
Messages.propTypes = {
  // eslint-disable-next-line react/require-default-props
  messages: ImmutablePropTypes.listOf(ImmutablePropTypes.map),
  // eslint-disable-next-line react/require-default-props
  profileAvatar: PropTypes.string,
  // eslint-disable-next-line react/require-default-props
  customComponent: PropTypes.func,
  // eslint-disable-next-line react/require-default-props
  showMessageDate: PropTypes.oneOfType([PropTypes.bool, PropTypes.func]),
  // eslint-disable-next-line react/require-default-props
  displayTypingIndication: PropTypes.bool
};

Message.defaultTypes = {
  displayTypingIndication: false
};

export default connect((store) => ({
  messages: store.messages,
  displayTypingIndication: store.behavior.get('isBotProcessing')
}))(Messages);
