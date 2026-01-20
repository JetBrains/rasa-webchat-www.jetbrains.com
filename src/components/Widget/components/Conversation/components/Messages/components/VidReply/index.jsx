import React, { PureComponent } from 'react';
import { PROP_TYPES } from 'constants';

import './styles.scss';

class VidReply extends PureComponent {
  render() {
    return (
      <div className="rw-video">
        <b className="rw-video-title">
          {/* eslint-disable-next-line react/destructuring-assignment */}
          { this.props.message.get('title') }
        </b>
        <div className="rw-video-details">
          {/* eslint-disable-next-line jsx-a11y/iframe-has-title, react/destructuring-assignment */}
          <iframe src={this.props.message.get('video')} className="rw-videoFrame" />
        </div>
      </div>
    );
  }
}

VidReply.propTypes = {
  // eslint-disable-next-line react/require-default-props
  message: PROP_TYPES.VIDREPLY
};

export default VidReply;
