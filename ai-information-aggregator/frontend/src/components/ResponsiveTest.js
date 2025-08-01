import React, { useState, useEffect } from 'react';
import styled from 'styled-components';

const TestContainer = styled.div`
  position: fixed;
  top: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 10px;
  border-radius: 4px;
  font-size: 12px;
  z-index: 9999;
  display: ${props => props.show ? 'block' : 'none'};
`;

const DeviceInfo = styled.div`
  margin-bottom: 5px;
`;

const BreakpointInfo = styled.div`
  color: ${props => {
    switch (props.breakpoint) {
      case 'mobile': return '#ff6b6b';
      case 'tablet': return '#4ecdc4';
      case 'desktop': return '#45b7d1';
      case 'large': return '#96ceb4';
      default: return '#feca57';
    }
  }};
  font-weight: bold;
`;

const ResponsiveTest = () => {
  const [dimensions, setDimensions] = useState({
    width: 0,
    height: 0
  });
  const [breakpoint, setBreakpoint] = useState('');
  const [show, setShow] = useState(process.env.NODE_ENV === 'development');

  useEffect(() => {
    const updateDimensions = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      setDimensions({ width, height });
      
      // Determine breakpoint based on common responsive breakpoints
      if (width < 576) {
        setBreakpoint('mobile');
      } else if (width < 768) {
        setBreakpoint('tablet-small');
      } else if (width < 992) {
        setBreakpoint('tablet');
      } else if (width < 1200) {
        setBreakpoint('desktop');
      } else {
        setBreakpoint('large');
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Toggle visibility with keyboard shortcut
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'R') {
        setShow(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <TestContainer show={show}>
      <DeviceInfo>
        Screen: {dimensions.width} × {dimensions.height}
      </DeviceInfo>
      <BreakpointInfo breakpoint={breakpoint}>
        Breakpoint: {breakpoint}
      </BreakpointInfo>
      <DeviceInfo>
        Ratio: {(dimensions.width / dimensions.height).toFixed(2)}
      </DeviceInfo>
      <DeviceInfo style={{ fontSize: '10px', marginTop: '5px' }}>
        Ctrl+Shift+R to toggle
      </DeviceInfo>
    </TestContainer>
  );
};

export default ResponsiveTest;