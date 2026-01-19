import React, { PureComponent } from 'react';
import { PROP_TYPES } from 'constants';

import './styles.scss';

class Snippet extends PureComponent {
  render() {
    return (
      <div className="rw-snippet">
        <b className="rw-snippet-title">
          {/* eslint-disable-next-line react/destructuring-assignment */}
          { this.props.message.get('title') }
        </b>
        <div className="rw-snippet-details">
          {/* eslint-disable-next-line react/destructuring-assignment */}
          <a href={this.props.message.get('link')} target={this.props.message.get('target')} className="rw-link">
            {/* eslint-disable-next-line react/destructuring-assignment */}
            { this.props.message.get('content') }
          </a>
        </div>
      </div>
    );
  }
}

Snippet.propTypes = {
  // eslint-disable-next-line react/require-default-props
  message: PROP_TYPES.SNIPPET
};

export default Snippet;
