import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const Portal: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [portalElement] = useState(() => document.createElement('div'));

  useEffect(() => {
    document.body.appendChild(portalElement);

    return () => {
      document.body.removeChild(portalElement);
    };
  }, [portalElement]);

  return createPortal(<div>{children}</div>, portalElement);
};

export default Portal;
