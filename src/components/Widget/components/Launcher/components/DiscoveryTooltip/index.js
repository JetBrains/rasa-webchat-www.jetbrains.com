import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import './style.scss';

const DiscoveryTooltip = ({ 
  firstChatStarted,
  isChatOpen,
  isHovered 
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    // Don't show tooltip if user already has open chat or sent some message before
    if (firstChatStarted || isChatOpen) {
      setShowTooltip(false);
      return;
    }

    // Show tooltip on hover or scroll page
    if (isHovered || hasScrolled) {
      setShowTooltip(true);
    } else {
      setShowTooltip(false);
    }
  }, [isHovered, hasScrolled, firstChatStarted, isChatOpen]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 100 && !firstChatStarted && !isChatOpen) {
        setHasScrolled(true);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [firstChatStarted, isChatOpen]);



  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showTooltip && !event.target.closest('.rw-discovery-tooltip')) {
        setShowTooltip(false);
        setHasScrolled(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showTooltip]);

  if (!showTooltip || firstChatStarted || isChatOpen) {
    return null;
  }

  return (
    <div className="rw-discovery-tooltip">
      <div className="rw-discovery-tooltip__text">
        Need help? Ask me anything about our products, and I&apos;ll find answers or create a support ticket for you
      </div>
    </div>
  );
};

DiscoveryTooltip.propTypes = {
  firstChatStarted: PropTypes.bool,
  isChatOpen: PropTypes.bool,
  isHovered: PropTypes.bool
};

const mapStateToProps = (state) => ({
  isChatOpen: state.behavior.get('isChatOpen')
});

export { DiscoveryTooltip };
export default connect(mapStateToProps)(DiscoveryTooltip);