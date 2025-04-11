import { useEffect, useState } from 'react';
import Header from '../components/Header';
import VersionList from '../components/VersionList';
import { fetchVersions } from '../utils/api';

const Home = () => {
   const [versions, setVersions] = useState([]);

   useEffect(() => {
      const loadVersions = async () => {
         const versionsData = await fetchVersions();
         setVersions(versionsData);
      };

      loadVersions();
   }, []);

   const handleDeploy = (versionTag) => {
      console.log(`Deploying version: ${versionTag}`);
      // Here you can add the logic to call your deployment engine API
   };

   return (
      <div>
         <Header />
         <VersionList versions={versions} onDeploy={handleDeploy} />
      </div>
   );
};

export default Home;