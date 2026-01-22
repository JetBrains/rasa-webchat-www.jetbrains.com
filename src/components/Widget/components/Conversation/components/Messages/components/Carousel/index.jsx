/* eslint-disable react/jsx-fragments, react/no-array-index-key, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, react/require-default-props */
import React, { useRef, useState, useContext } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';

import { addUserMessage, emitUserMessage, setBotProcessing } from 'actions';
import { PROP_TYPES } from 'constants';
import Arrow from 'assets/arrow';
import ThemeContext from '../../../../../../ThemeContext';
import { startBotProcessingTimeout } from '../../../../../../../../utils/botProcessingTimeout';

import './styles.scss';

// eslint-disable-next-line react/function-component-definition
const Carousel = (props) => {
  // eslint-disable-next-line react/destructuring-assignment
  const carousel = props.message.toJS();

  const handleClick = (action) => {
    // eslint-disable-next-line consistent-return
    if (!action || action.type !== 'postback') return;
    // eslint-disable-next-line react/destructuring-assignment
    const { chooseReply } = props;
    chooseReply(action.payload, action.title);
  };

  const scrollContainer = useRef();
  const [leftButton, setLeftButton] = useState(false);
  const [rightButton, setRightButton] = useState(true);
  const { mainColor, assistTextColor } = useContext(ThemeContext);


  const handleScroll = () => {
    // eslint-disable-next-line prefer-destructuring
    const current = scrollContainer.current;
    if (current.scrollLeft > 0) {
      setLeftButton(true);
    } else {
      setLeftButton(false);
    }
    if (current.clientWidth === current.scrollWidth - current.scrollLeft) {
      setRightButton(false);
    } else {
      setRightButton(true);
    }
  };

  const handleLeftArrow = () => {
    scrollContainer.current.scrollTo({
      left: scrollContainer.current.scrollLeft - 230,
      behavior: 'smooth'
    });
  };

  const handleRightArrow = () => {
    scrollContainer.current.scrollTo({
      left: scrollContainer.current.scrollLeft + 230,
      behavior: 'smooth'
    });
  };

  // eslint-disable-next-line react/destructuring-assignment
  const { linkTarget } = props;

  return (
    <React.Fragment>
      <div className="rw-carousel-container" ref={scrollContainer} onScroll={() => handleScroll()}>
        {carousel.elements.map((carouselCard, index) => {
          const defaultActionUrl =
            carouselCard.default_action && carouselCard.default_action.type === 'web_url'
              ? carouselCard.default_action.url
              : null;
          return (
            // eslint-disable-next-line react/no-array-index-key
            <div className="rw-carousel-card" key={index}>
              <a
                href={defaultActionUrl}
                target={linkTarget || '_blank'}
                rel="noopener noreferrer"
                onClick={() => handleClick(carouselCard.default_action)}
              >
                {carouselCard.image_url ? (
                  <img
                    className="rw-carousel-card-image"
                    src={carouselCard.image_url}
                    alt={`${carouselCard.title} ${carouselCard.subtitle}}}`}
                  />
                ) : (
                  <div className="rw-carousel-card-image" />
                )}
              </a>
              <a
                className="rw-carousel-card-title"
                href={defaultActionUrl}
                target={linkTarget || '_blank'}
                rel="noopener noreferrer"
                onClick={() => handleClick(carouselCard.default_action)}
                style={{ color: assistTextColor }}
              >
                {carouselCard.title}
              </a>
              <a
                className="rw-carousel-card-subtitle"
                href={defaultActionUrl}
                target={linkTarget || '_blank'}
                rel="noopener noreferrer"
                onClick={() => handleClick(carouselCard.default_action)}
                style={{ color: assistTextColor }}
              >
                {carouselCard.subtitle}
              </a>
              <div className="rw-carousel-buttons-container">
                {carouselCard.buttons.map((button, buttonIndex) => {
                  if (button.type === 'web_url') {
                    return (
                      // eslint-disable-next-line react/no-array-index-key
                      <a
                        key={buttonIndex}
                        href={button.url}
                        target={linkTarget || '_blank'}
                        rel="noopener noreferrer"
                        className="rw-reply"
                        style={{ borderColor: mainColor, color: mainColor }}
                      >
                        <span>{button.title}</span>
                      </a>
                    );
                  }
                  return (
                    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, react/no-array-index-key
                    <div
                      key={buttonIndex}
                      className="rw-reply"
                      onClick={() => handleClick(button)}
                      role="button"
                      tabIndex={0}
                      style={{ borderColor: mainColor, color: mainColor }}
                    >
                      <span>{button.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="rw-carousel-arrows-container">
        {leftButton && (
          // eslint-disable-next-line jsx-a11y/no-static-element-interactions
          <div
            className="rw-left-arrow rw-carousel-arrow"
            onClick={handleLeftArrow}
            role="button"
            tabIndex={0}
          >
            <div className="rw-arrow" alt="left carousel arrow" ><Arrow /></div>
          </div>
        )}
        {rightButton && (
          // eslint-disable-next-line jsx-a11y/no-static-element-interactions
          <div
            className="rw-right-arrow rw-carousel-arrow"
            onClick={handleRightArrow}
            role="button"
            tabIndex={0}
          >
            <div className="rw-arrow" alt="right carousel arrow"><Arrow /></div>
          </div>
        )}
      </div>
    </React.Fragment>
  );
};


Carousel.propTypes = {
  message: PROP_TYPES.CAROUSEL,
  // completely bugged, it's actually used in handle click
  // eslint-disable-next-line react/no-unused-prop-types
  chooseReply: PropTypes.func.isRequired,
  // eslint-disable-next-line react/require-default-props
  linkTarget: PropTypes.string
};

const mapStateToProps = (state) => ({
  linkTarget: state.metadata.get('linkTarget')
});

const mapDispatchToProps = (dispatch) => ({
  chooseReply: (payload, title) => {
    if (title) dispatch(addUserMessage(title));
    dispatch(emitUserMessage(payload));
    dispatch(setBotProcessing(true));
    // Start 30-second timeout to reset bot processing if backend hangs
    startBotProcessingTimeout(dispatch);
  }
});

export default connect(mapStateToProps, mapDispatchToProps)(Carousel);
