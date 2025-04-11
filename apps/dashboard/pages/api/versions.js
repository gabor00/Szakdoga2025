export default async function handler(req, res) {
    // This is an example. In a real app, you'd likely fetch this data from a database or an external API.
    const versions = [
       { tag: 'release-1.0', status: 'deployed' },
       { tag: 'release-1.1', status: 'pending' },
       { tag: 'release-1.2', status: 'available' },
    ];
 
    res.status(200).json(versions);
 }