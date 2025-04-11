import React from 'react';
import DeployButton from './DeployButton';

const VersionList = ({ versions, onDeploy }) => {
   return (
      <div>
         <h2>Available Versions</h2>
         <ul>
            {versions.map((version) => (
               <li key={version.tag}>
                  {version.tag} - {version.status}
                  <DeployButton version={version} onDeploy={onDeploy} />
               </li>
            ))}
         </ul>
      </div>
   );
};

export default VersionList;