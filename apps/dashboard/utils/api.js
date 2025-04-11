export const fetchVersions = async () => {
    const response = await fetch('/api/versions');
    if (!response.ok) {
       throw new Error('Network response was not ok');
    }
    return response.json();
 };