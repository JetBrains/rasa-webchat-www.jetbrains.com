/* eslint-disable react/require-default-props */
import React, { PureComponent } from 'react';
import { PROP_TYPES } from 'constants';

import './styles.scss';

class ImgReply extends PureComponent {
  render() {
    // eslint-disable-next-line react/prop-types
    const { params: { images: { dims = {} } = {} } } = this.props;
    const { width, height } = dims;
    // Convert map to object
    // eslint-disable-next-line react/destructuring-assignment
    const message = this.props.message.toJS();
    const { title, image } = message;
    // eslint-disable-next-line react/destructuring-assignment
    const customCss = this.props.message.get('customCss') && this.props.message.get('customCss').toJS();

    if (customCss && customCss.style === 'class') {
      // eslint-disable-next-line no-param-reassign
      customCss.css = customCss.css.replace(/^\./, '');
    }

    return (

      <div
        className={customCss && customCss.style === 'class' ?
          `image ${customCss.css}` :
          'image'}
        // eslint-disable-next-line react/forbid-dom-props, react/no-unknown-property
        style={{ cssText: customCss && customCss.style === 'custom' ?
          customCss.css :
          undefined }}
      >
        <b className="rw-image-title">
          { title }
        </b>
        <div className="rw-image-details" style={{ width, height }}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <img className="rw-image-frame" src={image} />
        </div>
      </div>
    );
  }
}

ImgReply.propTypes = {
  message: PROP_TYPES.IMGREPLY
};

ImgReply.defaultProps = {
  // eslint-disable-next-line react/default-props-match-prop-types
  params: {}
};

export default ImgReply;
