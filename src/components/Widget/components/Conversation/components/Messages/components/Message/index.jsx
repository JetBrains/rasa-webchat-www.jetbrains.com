/* eslint-disable react/require-default-props */
import React, { useContext } from 'react';
import ReactMarkdown from 'react-markdown';
import { connect } from 'react-redux';
import remarkGfm from 'remark-gfm';
import PropTypes from 'prop-types';

import { PROP_TYPES } from 'constants';
import DocViewer from '../docViewer';
import './styles.scss';
import ThemeContext from '../../../../../../ThemeContext';

function Message({ message, docViewer, linkTarget }) {
  const sender = message.get('sender');
  const text = message.get('text');
  const customCss = message.get('customCss') && message.get('customCss').toJS();

  if (customCss && customCss.style === 'class') {
    customCss.css = customCss.css.replace(/^\./, '');
  }

  const { userTextColor, userBackgroundColor, assistTextColor, assistBackgoundColor } = useContext(
    ThemeContext
  );

  let style;
  if (sender === 'response' && customCss && customCss.style === 'class') {
    style = undefined;
  } else if (sender === 'response' && customCss && customCss.style) {
    style = { cssText: customCss.css };
  } else if (sender === 'response') {
    style = { color: assistTextColor, backgroundColor: assistBackgoundColor };
  } else if (sender === 'client') {
    style = { color: userTextColor, backgroundColor: userBackgroundColor };
  }

  const conditionalCn =
    sender === 'response' && customCss && customCss.style === 'class'
      ? `rw-response ${customCss.css ? customCss.css : ''}`
      : `rw-${sender}`;

  return (
    <div className={conditionalCn} style={style}>
      <div className="rw-message-text">
        {sender === 'response' ? (
          <div className="rw-markdown">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // eslint-disable-next-line react/no-unstable-nested-components
                a: (props) =>
                  docViewer ? (
                    // eslint-disable-next-line react/prop-types
                    <DocViewer src={props.href}>{props.children}</DocViewer>
                  ) : (
                    <a
                      // eslint-disable-next-line react/prop-types
                      href={props.href}
                      target={linkTarget || '_blank'}
                      rel="noopener noreferrer"
                      onMouseUp={(e) => e.stopPropagation()}
                    >
                      {props.children}
                    </a>
                  ),
              }}
            >
              {text}
            </ReactMarkdown>
          </div>
        ) : (
          text
        )}
      </div>
    </div>
  );
}

Message.propTypes = {
  message: PROP_TYPES.MESSAGE,
  docViewer: PropTypes.bool,
  linkTarget: PropTypes.string,
};

Message.defaultTypes = {
  docViewer: false,
  linkTarget: '_blank',
};

const mapStateToProps = (state) => ({
  linkTarget: state.metadata.get('linkTarget'),
  docViewer: state.behavior.get('docViewer'),
});

export default connect(mapStateToProps)(Message);
