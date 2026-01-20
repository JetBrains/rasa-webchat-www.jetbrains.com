import React, { Component } from 'react';
import PropTypes from 'prop-types';

import Portal from 'utils/portal.tsx';
import './style.scss';

class DocViewer extends Component {
  constructor() {
    super();
    this.iframeLoaded = this.iframeLoaded.bind(this);
    this.updateIframeSrc = this.updateIframeSrc.bind(this);
    this.handleOpenModal = this.handleOpenModal.bind(this);
    this.handleCloseModal = this.handleCloseModal.bind(this);
    this.state = {
      openedModal: false,
      iFrameLoading: true,
    };
  }

  getIframeLink() {
    // eslint-disable-next-line react/destructuring-assignment
    return `https://docs.google.com/viewer?url=${this.props.src}&embedded=true`;
  }

  iframeLoaded() {
    clearInterval(this.iframeTimeoutId);
    this.setState({ iFrameLoading: false });
  }

  updateIframeSrc() {
    if (this.iframe) this.iframe.src = this.getIframeLink();
    else clearInterval(this.iframeTimeoutId);
  }

  // eslint-disable-next-line react/sort-comp
  handleOpenModal() {
    this.setState({ openedModal: true });
    this.iframeTimeoutId = setInterval(this.updateIframeSrc, 1000 * 4);
  }

  handleCloseModal() {
    this.setState({ openedModal: false, iFrameLoading: true });
  }

  render() {
    const iframeSrc = this.getIframeLink();

    return (
      <span>
        {/* eslint-disable-next-line react/button-has-type */}
        <button onClick={this.handleOpenModal} className="rw-doc-viewer-open-modal-link">
          {/* eslint-disable-next-line react/prop-types, react/destructuring-assignment */}
          {this.props.children}
        </button>
        {/* eslint-disable-next-line react/destructuring-assignment */}
        {this.state.openedModal && (
          <Portal>
            <div
              className="rw-doc-viewer-modal-fade"
              aria-hidden="true"
              onClick={this.handleCloseModal}
            />
            <div className="rw-doc-viewer-modal">
              <div className="rw-doc-viewer-modal-body">
                {/* eslint-disable-next-line react/destructuring-assignment */}
                {this.state.iFrameLoading && <div className="rw-doc-viewer-spinner" />}
                <iframe
                  src={iframeSrc}
                  title="viewer"
                  className="rw-doc-viewer-modal-iframe"
                  onLoad={this.iframeLoaded}
                  onError={this.updateIframeSrc}
                  ref={(iframe) => {
                    this.iframe = iframe;
                  }}
                />
              </div>
              <div className="rw-doc-viewer-modal-footer">
                <button
                  type="button"
                  className="rw-doc-viewer-close-modal"
                  onClick={this.handleCloseModal}
                >
                  X
                </button>
              </div>
            </div>
          </Portal>
        )}
      </span>
    );
  }
}

DocViewer.propTypes = {
  src: PropTypes.string.isRequired,
};

export default DocViewer;
