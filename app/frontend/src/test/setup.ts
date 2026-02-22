import * as React from 'react';
import * as ReactDOM from 'react-dom';

if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  const axe = require('@axe-core/react');
  axe(React, ReactDOM, 1000);
}
