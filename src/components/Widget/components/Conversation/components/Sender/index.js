import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import TextareaAutosize from 'react-textarea-autosize';
import Send from 'assets/send_button';
import './style.scss';

function Sender({ sendMessage, inputTextFieldHint, userInput, isBotProcessing }) {
  const [inputValue, setInputValue] = useState('');
  const formRef = useRef('');
  function handleChange(e) {
    setInputValue(e.target.value);
  }

  function handleSubmit(e) {
    if (isBotProcessing) {
      e.preventDefault();
      return;
    }
    sendMessage(e);
    setInputValue('');
  }

  function onEnterPress(e) {
    if (e.keyCode === 13 && e.shiftKey === false) {
      e.preventDefault();
      if (!isBotProcessing) {
        // by dispatching the event we trigger onSubmit
        // formRef.current.submit() would not trigger onSubmit
        formRef.current.dispatchEvent(new Event('submit', { cancelable: true }));
      }
    }
  }

  const isDisabled = !(inputValue && inputValue.trim().length > 0) || isBotProcessing;

  return userInput === 'hide' ? (
    <div />
  ) : (
    <form ref={formRef} className="rw-sender" onSubmit={handleSubmit}>
      <TextareaAutosize
        type="text"
        minRows={1}
        onKeyDown={(e) => {
          onEnterPress(e);
        }}
        maxRows={3}
        onChange={(e) => {
          handleChange(e);
        }}
        className="rw-new-message"
        name="message"
        placeholder={inputTextFieldHint}
        autoFocus
        autoComplete="off"
      />
      <button type="submit" className="rw-send" disabled={isDisabled}>
        <Send className="rw-send-icon" ready={!isDisabled} alt="send" />
      </button>
    </form>
  );
}
const mapStateToProps = (state) => ({
  userInput: state.metadata.get('userInput'),
  isBotProcessing: state.behavior.get('isBotProcessing'),
});

Sender.propTypes = {
  sendMessage: PropTypes.func,
  inputTextFieldHint: PropTypes.string,
  userInput: PropTypes.string,
  isBotProcessing: PropTypes.bool,
};

export default connect(mapStateToProps)(Sender);
