import React from 'react';

const DeployButton = ({ version, onDeploy }) => {
   return (
      <button onClick={() => onDeploy(version.tag)}>Deploy</button>
   );
};

export default DeployButton;